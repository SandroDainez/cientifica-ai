import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import pptxgen from 'pptxgenjs'
import { formatarReferencia, ordenarReferencias } from '@/lib/referencias/formatar'
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'
import { extrairTextoParaSlide, extrairTextoSecao } from '@/lib/ai/utils'
import { removerTravessoes } from '@/lib/ai/validar-citacoes'
import { converterMathLatexParaTexto } from '@/lib/formatacao/latex'
import type { Trabalho, SecaoTrabalho, Referencia } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const trabalhoId = searchParams.get('id')
  if (!trabalhoId) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [{ data: tData }, { data: sData }, { data: pData }, { data: rData }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('*').eq('trabalho_id', trabalhoId).order('ordem'),
    supabase.from('profiles').select('nome, instituicao').eq('id', user.id).single(),
    supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at'),
  ])

  if (!tData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const trabalho = tData as Trabalho
  const secoes = (sData ?? []) as SecaoTrabalho[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  const secoesOrdenadas = fluxo
    ? fluxo.fases
        .map(f => secoes.find(s => s.chave_secao === f.chave_secao || s.chave_secao === f.id))
        .filter((s): s is SecaoTrabalho => !!s && !!s.conteudo?.trim())
    : secoes.filter(s => !!s.conteudo?.trim())

  // Só lista as referências EFETIVAMENTE CITADAS no corpo (mesma regra do DOCX/visualização)
  const corpoCitacoes = secoesOrdenadas.map(s => extrairTextoSecao(s.conteudo ?? '')).join('\n\n')
  const referencias = separarReferenciasCitadas(
    ordenarReferencias((rData ?? []) as Referencia[], trabalho.formato_citacao),
    corpoCitacoes,
    trabalho.formato_citacao ?? 'abnt',
  ).citadas

  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.theme = { headFontFace: 'Times New Roman', bodyFontFace: 'Times New Roman' }

  const AZUL = '1e40af'
  const BRANCO = 'FFFFFF'
  const CINZA = '6b7280'

  // ── Slide de título ─────────────────────────────────────────
  const slideTitulo = pptx.addSlide()
  slideTitulo.background = { color: AZUL }

  slideTitulo.addText(getTipoLabel(trabalho.tipo_trabalho).toUpperCase(), {
    x: 0.5, y: 0.6, w: 9, h: 0.4,
    color: 'BFDBFE', fontSize: 12, align: 'center',
  })

  slideTitulo.addText(trabalho.titulo || 'Título do Trabalho', {
    x: 0.5, y: 1.2, w: 9, h: 2.2,
    color: BRANCO, fontSize: 28, bold: true, align: 'center',
    valign: 'middle', wrap: true,
  })

  if (pData?.nome) {
    slideTitulo.addText(pData.nome, {
      x: 0.5, y: 4.2, w: 9, h: 0.5,
      color: 'BFDBFE', fontSize: 14, align: 'center',
    })
  }

  if (pData?.instituicao || trabalho.instituicao_destino) {
    slideTitulo.addText(pData?.instituicao ?? trabalho.instituicao_destino ?? '', {
      x: 0.5, y: 4.7, w: 9, h: 0.4,
      color: 'BFDBFE', fontSize: 11, align: 'center',
    })
  }

  slideTitulo.addText(String(new Date().getFullYear()), {
    x: 0.5, y: 5.2, w: 9, h: 0.3,
    color: '93c5fd', fontSize: 11, align: 'center',
  })

  // ── Slide de sumário ────────────────────────────────────────
  if (secoesOrdenadas.length > 0) {
    const slideSumario = pptx.addSlide()
    slideSumario.addText('SUMÁRIO', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      color: AZUL, fontSize: 20, bold: true,
    })
    slideSumario.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 0.9, w: 2, h: 0.05, fill: { color: AZUL },
    })

    const items = secoesOrdenadas.map((s, i) => `${i + 1}.  ${s.nome_secao}`)
    slideSumario.addText(items.join('\n'), {
      x: 0.5, y: 1.2, w: 9, h: 4.5,
      color: '374151', fontSize: 14, lineSpacingMultiple: 1.5,
      bullet: false,
    })
  }

  // ── Slides por seção ────────────────────────────────────────
  secoesOrdenadas.forEach((secao, i) => {
    const slide = pptx.addSlide()

    // Header colorido
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 1.1, fill: { color: AZUL },
    })

    slide.addText(`${i + 1}`, {
      x: 0.4, y: 0.1, w: 0.6, h: 0.9,
      color: '93c5fd', fontSize: 28, bold: true, valign: 'middle',
    })

    slide.addText(secao.nome_secao.toUpperCase(), {
      x: 1.1, y: 0.1, w: 8.4, h: 0.9,
      color: BRANCO, fontSize: 18, bold: true, valign: 'middle',
    })

    // Conteúdo — converte LaTeX e remove travessões antes de extrair p/ slide
    const resumo = extrairTextoParaSlide(converterMathLatexParaTexto(removerTravessoes(secao.conteudo ?? '')), 600)

    slide.addText(resumo, {
      x: 0.5, y: 1.3, w: 9, h: 4,
      color: '1f2937', fontSize: 12, valign: 'top',
      lineSpacingMultiple: 1.5, wrap: true,
    })

    // Rodapé
    slide.addText(trabalho.titulo ?? '', {
      x: 0.5, y: 5.4, w: 8, h: 0.3,
      color: CINZA, fontSize: 9, italic: true,
    })
    slide.addText(`${i + 1}/${secoesOrdenadas.length}`, {
      x: 8.5, y: 5.4, w: 1, h: 0.3,
      color: CINZA, fontSize: 9, align: 'right',
    })
  })

  // ── Slide de referências ────────────────────────────────────
  if (referencias.length > 0) {
    const isVancouver = trabalho.formato_citacao === 'vancouver'
    // Divide em grupos de até 8 refs por slide
    const grupos: Referencia[][] = []
    for (let i = 0; i < referencias.length; i += 8) {
      grupos.push(referencias.slice(i, i + 8))
    }

    grupos.forEach((grupo, gi) => {
      const slideRefs = pptx.addSlide()

      slideRefs.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.1, fill: { color: AZUL },
      })
      slideRefs.addText('REFERÊNCIAS', {
        x: 0.5, y: 0.1, w: 9, h: 0.9,
        color: BRANCO, fontSize: 18, bold: true, valign: 'middle',
      })
      if (grupos.length > 1) {
        slideRefs.addText(`${gi + 1}/${grupos.length}`, {
          x: 8.5, y: 0.3, w: 1, h: 0.5,
          color: '93c5fd', fontSize: 10, align: 'right',
        })
      }

      const linhas = grupo.map((ref, idx) => {
        const num = isVancouver ? gi * 8 + idx + 1 : undefined
        return formatarReferencia(ref, trabalho.formato_citacao, num)
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
      })

      slideRefs.addText(linhas.join('\n\n'), {
        x: 0.5, y: 1.3, w: 9, h: 4,
        color: '1f2937', fontSize: 9, valign: 'top',
        lineSpacingMultiple: 1.4, wrap: true,
      })

      slideRefs.addText(trabalho.titulo ?? '', {
        x: 0.5, y: 5.4, w: 8, h: 0.3,
        color: CINZA, fontSize: 9, italic: true,
      })
    })
  }

  // ── Slide final ─────────────────────────────────────────────
  const slideFinal = pptx.addSlide()
  slideFinal.background = { color: AZUL }
  slideFinal.addText('Obrigado(a)', {
    x: 0.5, y: 1.5, w: 9, h: 1.5,
    color: BRANCO, fontSize: 36, bold: true, align: 'center',
  })
  if (pData?.nome) {
    slideFinal.addText(pData.nome, {
      x: 0.5, y: 3.5, w: 9, h: 0.6,
      color: 'BFDBFE', fontSize: 16, align: 'center',
    })
  }

  const rawBuffer = await pptx.write({ outputType: 'nodebuffer' })
  const buffer = Buffer.from(rawBuffer as ArrayBuffer)
  const titulo = (trabalho.titulo ?? 'apresentacao').replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim().substring(0, 60)
  const filename = `${titulo || 'cientifica-ai'}.pptx`

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}
