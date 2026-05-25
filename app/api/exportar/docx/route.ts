import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { formatarReferencia, ordenarReferencias } from '@/lib/referencias/formatar'
import { extrairParagrafosParaDocx } from '@/lib/ai/utils'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, PageBreak, convertInchesToTwip,
  LineRuleType, UnderlineType,
} from 'docx'
import type { Trabalho, SecaoTrabalho, Referencia } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const trabalhoId = searchParams.get('id')
  if (!trabalhoId) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [{ data: tData }, { data: sData }, { data: rData }, { data: pData }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('*').eq('trabalho_id', trabalhoId).order('ordem'),
    supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at'),
    supabase.from('profiles').select('nome, instituicao').eq('id', user.id).single(),
  ])

  if (!tData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const trabalho = tData as Trabalho
  const secoes = (sData ?? []) as SecaoTrabalho[]
  const referencias = (rData ?? []) as Referencia[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  const secoesOrdenadas = fluxo
    ? fluxo.fases
        .map(f => secoes.find(s => s.chave_secao === f.chave_secao || s.chave_secao === f.id))
        .filter((s): s is SecaoTrabalho => !!s && !!s.conteudo?.trim())
    : secoes.filter(s => !!s.conteudo?.trim())

  // ── Helpers de estilo ──────────────────────────────────────
  const FONT = 'Times New Roman'
  const SIZE = 24 // half-points, 12pt

  function paragrafo(text: string, opts: {
    bold?: boolean
    center?: boolean
    size?: number
    indent?: boolean
    spacing?: number
    pageBreakBefore?: boolean
  } = {}): Paragraph {
    return new Paragraph({
      pageBreakBefore: opts.pageBreakBefore,
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: {
        line: opts.spacing ?? 360, // 1.5 line spacing = 360 twentieths
        lineRule: LineRuleType.AUTO,
        after: opts.indent === false ? 200 : 0,
      },
      indent: opts.indent !== false && !opts.center
        ? { firstLine: convertInchesToTwip(0.5) }
        : undefined,
      children: [
        new TextRun({
          text,
          font: FONT,
          size: opts.size ?? SIZE,
          bold: opts.bold,
        }),
      ],
    })
  }

  function secaoHeading(numero: number, nome: string): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 360, lineRule: LineRuleType.AUTO, before: 480, after: 240 },
      children: [
        new TextRun({
          text: `${numero} ${nome.toUpperCase()}`,
          font: FONT,
          size: SIZE,
          bold: true,
        }),
      ],
    })
  }

  function empty(): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: '', font: FONT, size: SIZE })],
      spacing: { line: 360, lineRule: LineRuleType.AUTO },
    })
  }

  /**
   * Converte texto com markdown **bold** e *italic* em TextRuns do docx.
   * ABNT usa **negrito** para periódicos; APA usa *itálico* para revistas/livros.
   */
  function textRunsFromMarkdown(text: string, opts: { size?: number } = {}): TextRun[] {
    const sz = opts.size ?? SIZE
    const runs: TextRun[] = []
    // Divide em tokens: **bold**, *italic*, texto normal
    const tokens = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/)
    for (const token of tokens) {
      if (!token) continue
      if (token.startsWith('**') && token.endsWith('**')) {
        runs.push(new TextRun({ text: token.slice(2, -2), font: FONT, size: sz, bold: true }))
      } else if (token.startsWith('*') && token.endsWith('*')) {
        runs.push(new TextRun({ text: token.slice(1, -1), font: FONT, size: sz, italics: true }))
      } else {
        runs.push(new TextRun({ text: token, font: FONT, size: sz }))
      }
    }
    return runs.length ? runs : [new TextRun({ text, font: FONT, size: sz })]
  }

  // ── Montar documento ────────────────────────────────────────
  const children: Paragraph[] = []

  // Capa
  children.push(
    empty(),
    empty(),
    ...(pData?.instituicao || trabalho.instituicao_destino
      ? [paragrafo((pData?.instituicao ?? trabalho.instituicao_destino ?? '').toUpperCase(), { center: true, bold: true, indent: false }), empty()]
      : []),
    empty(),
    empty(),
    ...(pData?.nome
      ? [paragrafo(pData.nome, { center: true, indent: false }), empty()]
      : []),
    empty(),
    empty(),
    paragrafo(
      (trabalho.titulo || 'TÍTULO DO TRABALHO').toUpperCase(),
      { center: true, bold: true, indent: false, size: 28 }
    ),
    empty(),
    empty(),
    ...(trabalho.orientador
      ? [paragrafo(`Orientador(a): ${trabalho.orientador}`, { center: true, indent: false }), empty()]
      : []),
    empty(),
    paragrafo(`${trabalho.area_conhecimento ? trabalho.area_conhecimento + '\n' : ''}${new Date().getFullYear()}`, { center: true, indent: false }),
  )

  // Seções
  secoesOrdenadas.forEach((secao, i) => {
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      secaoHeading(i + 1, secao.nome_secao),
    )

    // Parágrafos limpos: sem #, -, 1., mas com **negrito** e *itálico* preservados
    const paragrafos = extrairParagrafosParaDocx(secao.conteudo ?? '')
    paragrafos.forEach(p => {
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: {
          line: 360,
          lineRule: LineRuleType.AUTO,
          after: 0,
        },
        indent: { firstLine: convertInchesToTwip(0.5) },
        children: textRunsFromMarkdown(p),
      }))
    })
  })

  // Referências — ordenação e formatação por formato de citação
  if (referencias.length > 0) {
    const refsOrdenadas = ordenarReferencias(referencias, trabalho.formato_citacao)
    const isVancouver = trabalho.formato_citacao === 'vancouver'

    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 360, lineRule: LineRuleType.AUTO, before: 0, after: 480 },
        children: [new TextRun({ text: 'REFERÊNCIAS', font: FONT, size: SIZE, bold: true })],
      }),
    )

    refsOrdenadas.forEach((ref, idx) => {
      const numero = isVancouver ? idx + 1 : undefined
      const textoFormatado = formatarReferencia(ref, trabalho.formato_citacao, numero)

      if (isVancouver) {
        // Vancouver: lista numerada — sem recuo pendente
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 240 },
          children: textRunsFromMarkdown(textoFormatado),
        }))
      } else {
        // ABNT / APA: recuo pendente + bold/italic preservados
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 240 },
          indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
          children: textRunsFromMarkdown(textoFormatado),
        }))
      }
    })
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1.18),    // ~3cm
            right: convertInchesToTwip(1.18),   // ~3cm
            bottom: convertInchesToTwip(0.79),  // ~2cm
            left: convertInchesToTwip(1.57),    // ~4cm
          },
        },
      },
      children,
    }],
  })

  const buffer = Buffer.from(await Packer.toBuffer(doc))
  const titulo = (trabalho.titulo ?? 'trabalho').replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim().substring(0, 60)
  const filename = `${titulo || 'cientifica-ai'}.docx`

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}
