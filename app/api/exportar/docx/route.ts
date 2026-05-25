import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { formatarReferencia, ordenarReferencias } from '@/lib/referencias/formatar'
import { extrairParagrafosParaDocx } from '@/lib/ai/utils'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  PageBreak, convertInchesToTwip, LineRuleType,
} from 'docx'
import type { Trabalho, SecaoTrabalho, Referencia, FormatoCitacao } from '@/types'

// ── Configurações por formato de citação ────────────────────────
//
// ABNT NBR 14724:2011:  margens 3×3×2×4 cm, espaço 1,5, títulos numerados MAIÚSCULOS
// APA 7ª Ed:            margens 2,54 cm (1 in) todo lado, espaço duplo, título centralizado bold
// Vancouver (ICMJE):    margens 2,5 cm todo lado, espaço 1,5, título negrito sem número

interface FormatoConfig {
  margins: { top: number; right: number; bottom: number; left: number } // inches
  lineSpacing: number   // twentieths of a point (240 = simples, 360 = 1.5×, 480 = duplo)
  headingAlign: 'left' | 'center'
  headingBold: boolean
  headingUppercase: boolean
  headingNumbered: boolean
  refsTitle: string
  refsTitleAlign: 'left' | 'center'
}

const FORMATO_CONFIG: Record<FormatoCitacao, FormatoConfig> = {
  abnt: {
    margins:          { top: 1.18, right: 1.18, bottom: 0.79, left: 1.57 }, // 3×3×2×4 cm
    lineSpacing:      360,    // 1,5 linhas
    headingAlign:     'left',
    headingBold:      true,
    headingUppercase: true,   // 1 INTRODUÇÃO
    headingNumbered:  true,
    refsTitle:        'REFERÊNCIAS',
    refsTitleAlign:   'center',
  },
  apa: {
    margins:          { top: 1, right: 1, bottom: 1, left: 1 }, // 2,54 cm (1 in)
    lineSpacing:      480,    // espaço duplo
    headingAlign:     'center',
    headingBold:      true,
    headingUppercase: false,  // Introduction (Title Case)
    headingNumbered:  false,
    refsTitle:        'References',
    refsTitleAlign:   'center',
  },
  vancouver: {
    margins:          { top: 0.98, right: 0.98, bottom: 0.98, left: 0.98 }, // ~2,5 cm
    lineSpacing:      360,    // 1,5 linhas (recomendado ICMJE)
    headingAlign:     'left',
    headingBold:      true,
    headingUppercase: false,  // Introduction (sem número)
    headingNumbered:  false,
    refsTitle:        'References',
    refsTitleAlign:   'left',
  },
}

/** Converte string para Title Case respeitando conectores em português */
function toTitleCase(str: string): string {
  const minusculas = new Set(['a', 'e', 'o', 'da', 'de', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem', 'and', 'of', 'in', 'on'])
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i === 0 || !minusculas.has(word)) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ')
}

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

  const trabalho   = tData as Trabalho
  const secoes     = (sData ?? []) as SecaoTrabalho[]
  const referencias = (rData ?? []) as Referencia[]
  const fluxo      = getFluxo(trabalho.tipo_trabalho)
  const fmt        = FORMATO_CONFIG[trabalho.formato_citacao] ?? FORMATO_CONFIG.abnt

  const secoesOrdenadas = fluxo
    ? fluxo.fases
        .map(f => secoes.find(s => s.chave_secao === f.chave_secao || s.chave_secao === f.id))
        .filter((s): s is SecaoTrabalho => !!s && !!s.conteudo?.trim())
    : secoes.filter(s => !!s.conteudo?.trim())

  // ── Helpers de estilo ──────────────────────────────────────
  const FONT = 'Times New Roman'
  const SIZE = 24 // half-points → 12pt

  /** Parágrafo genérico (capa, rodapé, etc.) — espaçamento do formato */
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
        line: opts.spacing ?? fmt.lineSpacing,
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

  /** Título de seção adaptado ao formato (ABNT, APA, Vancouver) */
  function secaoHeading(numero: number, nome: string): Paragraph {
    let textoTitulo: string
    if (fmt.headingNumbered && fmt.headingUppercase) {
      textoTitulo = `${numero} ${nome.toUpperCase()}`               // ABNT: 1 INTRODUÇÃO
    } else if (fmt.headingNumbered) {
      textoTitulo = `${numero} ${toTitleCase(nome)}`                // (reservado)
    } else if (fmt.headingUppercase) {
      textoTitulo = nome.toUpperCase()
    } else {
      textoTitulo = toTitleCase(nome)                               // APA/Vancouver: Introduction
    }

    return new Paragraph({
      alignment: fmt.headingAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: {
        line: fmt.lineSpacing,
        lineRule: LineRuleType.AUTO,
        before: fmt.lineSpacing === 480 ? 480 : 480, // quebra visual antes do título
        after:  fmt.lineSpacing === 480 ? 240 : 240,
      },
      children: [
        new TextRun({
          text: textoTitulo,
          font: FONT,
          size: SIZE,
          bold: fmt.headingBold,
        }),
      ],
    })
  }

  function empty(): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: '', font: FONT, size: SIZE })],
      spacing: { line: fmt.lineSpacing, lineRule: LineRuleType.AUTO },
    })
  }

  /**
   * Converte **negrito** e *itálico* markdown em TextRuns do docx.
   * ABNT usa **negrito** para periódicos; APA usa *itálico* para revistas e livros.
   */
  function textRunsFromMarkdown(text: string, opts: { size?: number } = {}): TextRun[] {
    const sz = opts.size ?? SIZE
    const runs: TextRun[] = []
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

  // ── Capa ────────────────────────────────────────────────────
  // ABNT: capa estruturada com instituição, autor, título, orientador, ano
  // APA:  título centralizado, autor, instituição, curso, professor, data
  // Vancouver: título, autor, instituição (mais simples)

  if (trabalho.formato_citacao === 'apa') {
    // APA 7ª Ed — título page
    children.push(
      empty(), empty(), empty(),
      ...(pData?.nome ? [
        paragrafo(pData.nome, { center: true, indent: false }),
        empty(),
      ] : []),
      paragrafo(
        (trabalho.titulo || 'Title of Work'),
        { center: true, bold: true, indent: false, size: 28 }
      ),
      empty(),
      ...(pData?.instituicao || trabalho.instituicao_destino ? [
        paragrafo(pData?.instituicao ?? trabalho.instituicao_destino ?? '', { center: true, indent: false }),
      ] : []),
      ...(trabalho.area_conhecimento ? [
        paragrafo(trabalho.area_conhecimento, { center: true, indent: false }),
      ] : []),
      ...(trabalho.orientador ? [
        empty(),
        paragrafo(`Professor: ${trabalho.orientador}`, { center: true, indent: false }),
      ] : []),
      empty(),
      paragrafo(String(new Date().getFullYear()), { center: true, indent: false }),
    )
  } else if (trabalho.formato_citacao === 'vancouver') {
    // Vancouver — capa simples
    children.push(
      empty(), empty(),
      ...(pData?.instituicao || trabalho.instituicao_destino ? [
        paragrafo((pData?.instituicao ?? trabalho.instituicao_destino ?? '').toUpperCase(), { center: true, bold: true, indent: false }),
        empty(),
      ] : []),
      empty(), empty(),
      ...(pData?.nome ? [
        paragrafo(pData.nome, { center: true, indent: false }),
        empty(),
      ] : []),
      empty(),
      paragrafo(
        toTitleCase(trabalho.titulo || 'Title of Work'),
        { center: true, bold: true, indent: false, size: 28 }
      ),
      empty(), empty(),
      ...(trabalho.orientador ? [
        paragrafo(`Supervisor: ${trabalho.orientador}`, { center: true, indent: false }),
        empty(),
      ] : []),
      paragrafo(String(new Date().getFullYear()), { center: true, indent: false }),
    )
  } else {
    // ABNT NBR 14724 — capa padrão
    children.push(
      empty(), empty(),
      ...(pData?.instituicao || trabalho.instituicao_destino ? [
        paragrafo((pData?.instituicao ?? trabalho.instituicao_destino ?? '').toUpperCase(), { center: true, bold: true, indent: false }),
        empty(),
      ] : []),
      empty(), empty(),
      ...(pData?.nome ? [
        paragrafo(pData.nome, { center: true, indent: false }),
        empty(),
      ] : []),
      empty(), empty(),
      paragrafo(
        (trabalho.titulo || 'TÍTULO DO TRABALHO').toUpperCase(),
        { center: true, bold: true, indent: false, size: 28 }
      ),
      empty(), empty(),
      ...(trabalho.orientador ? [
        paragrafo(`Orientador(a): ${trabalho.orientador}`, { center: true, indent: false }),
        empty(),
      ] : []),
      empty(),
      paragrafo(
        `${trabalho.area_conhecimento ? trabalho.area_conhecimento + '\n' : ''}${new Date().getFullYear()}`,
        { center: true, indent: false }
      ),
    )
  }

  // ── Seções ──────────────────────────────────────────────────
  secoesOrdenadas.forEach((secao, i) => {
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      secaoHeading(i + 1, secao.nome_secao),
    )

    // Parágrafos limpos — sem markdown estrutural, bold/italic preservados
    const paragrafos = extrairParagrafosParaDocx(secao.conteudo ?? '')
    paragrafos.forEach(p => {
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: {
          line: fmt.lineSpacing,
          lineRule: LineRuleType.AUTO,
          after: fmt.lineSpacing === 480 ? 0 : 0, // APA não tem espaço extra entre parágrafos
        },
        indent: { firstLine: convertInchesToTwip(0.5) },
        children: textRunsFromMarkdown(p),
      }))
    })
  })

  // ── Referências ─────────────────────────────────────────────
  if (referencias.length > 0) {
    const refsOrdenadas = ordenarReferencias(referencias, trabalho.formato_citacao)
    const isVancouver = trabalho.formato_citacao === 'vancouver'

    // Título da seção de referências
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        alignment: fmt.refsTitleAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: {
          line: fmt.lineSpacing,
          lineRule: LineRuleType.AUTO,
          before: 0,
          after: fmt.lineSpacing === 480 ? 480 : 480,
        },
        children: [new TextRun({
          text: fmt.refsTitle,
          font: FONT,
          size: SIZE,
          bold: true,
        })],
      }),
    )

    refsOrdenadas.forEach((ref, idx) => {
      const numero = isVancouver ? idx + 1 : undefined
      const textoFormatado = formatarReferencia(ref, trabalho.formato_citacao, numero)

      if (isVancouver) {
        // Vancouver: lista numerada, sem recuo pendente
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: fmt.lineSpacing, lineRule: LineRuleType.AUTO, after: 240 },
          children: textRunsFromMarkdown(textoFormatado),
        }))
      } else {
        // ABNT / APA: recuo pendente — bold/italic de periódico preservados
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: fmt.lineSpacing, lineRule: LineRuleType.AUTO, after: 240 },
          indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
          children: textRunsFromMarkdown(textoFormatado),
        }))
      }
    })
  }

  // ── Gerar arquivo ───────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(fmt.margins.top),
            right:  convertInchesToTwip(fmt.margins.right),
            bottom: convertInchesToTwip(fmt.margins.bottom),
            left:   convertInchesToTwip(fmt.margins.left),
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
