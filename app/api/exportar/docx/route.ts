import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { formatarReferencia, ordenarReferencias } from '@/lib/referencias/formatar'
import { extrairParagrafosParaDocx } from '@/lib/ai/utils'
import { tituloEfetivo } from '@/lib/trabalho/titulo'
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  PageBreak, convertInchesToTwip, LineRuleType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
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
  // Título da capa: coluna do trabalho ou, se vazia, extraído da seção "titulo"
  const tituloCapa = tituloEfetivo(trabalho.titulo, secoes)

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
  const children: (Paragraph | Table)[] = []

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
        (tituloCapa || 'Title of Work'),
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
        toTitleCase(tituloCapa || 'Title of Work'),
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
        (tituloCapa || 'TÍTULO DO TRABALHO').toUpperCase(),
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
  // Constrói uma tabela DOCX no padrão ABNT (tabela aberta) a partir de linhas markdown
  function construirTabelaDocx(linhasTabela: string[]): Table | null {
    const linhas = linhasTabela
      .map(l => l.trim())
      .filter(l => l.startsWith('|'))
    if (linhas.length < 2) return null
    // Divide a linha em células removendo SÓ as vazias das bordas (artefatos do
    // pipe inicial/final). NUNCA usar slice(1,-1): se a linha não tiver pipe
    // final, isso descartaria a ÚLTIMA coluna (ex.: a coluna "Valor-p").
    const parseRow = (l: string) => {
      const cells = l.split('|').map(c => c.trim())
      if (cells.length && cells[0] === '') cells.shift()
      if (cells.length && cells[cells.length - 1] === '') cells.pop()
      return cells
    }
    const ehSeparador = (l: string) => parseRow(l).every(c => /^:?-{2,}:?$/.test(c))
    const header = parseRow(linhas[0])
    const corpo = linhas.slice(1).filter(l => !ehSeparador(l)).map(parseRow)
    const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    const linhaPreta = { style: BorderStyle.SINGLE, size: 6, color: '000000' }
    const mkCell = (txt: string, opts: { header?: boolean; top?: boolean; bottom?: boolean } = {}) =>
      new TableCell({
        borders: {
          top: opts.top ? linhaPreta : semBorda,
          bottom: opts.bottom ? linhaPreta : semBorda,
          left: semBorda, right: semBorda,
        },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({
          children: txt.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/).filter(Boolean).map(tk =>
            tk.startsWith('**') && tk.endsWith('**')
              ? new TextRun({ text: tk.slice(2, -2), font: FONT, size: 22, bold: true })
              : tk.startsWith('*') && tk.endsWith('*')
                ? new TextRun({ text: tk.slice(1, -1), font: FONT, size: 22, italics: true })
                : new TextRun({ text: tk, font: FONT, size: 22, bold: opts.header }),
          ),
        })],
      })
    const rows: TableRow[] = []
    // Cabeçalho: borda superior (topo da tabela) e inferior (sob o cabeçalho)
    rows.push(new TableRow({ tableHeader: true, children: header.map(c => mkCell(c, { header: true, top: true, bottom: true })) }))
    // Corpo: última linha recebe borda inferior (base da tabela)
    corpo.forEach((r, idx) => {
      const ultima = idx === corpo.length - 1
      // garante o nº de células igual ao cabeçalho
      const cells = header.map((_, ci) => mkCell(r[ci] ?? '', { bottom: ultima }))
      rows.push(new TableRow({ children: cells }))
    })
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
  }

  // ── Ordem do documento final (ABNT) — diferente da ordem de elaboração ──────
  // O título já está na capa (não vira seção "1 TÍTULO E ESCOPO"); o Resumo/
  // Abstract vêm ANTES da introdução, sem numeração. As demais seções seguem
  // numeradas a partir de 1.
  // Apenas a seção de TÍTULO puro é omitida (o título já está na capa).
  // 'tema' (Tema e Delimitação do TCC) é conteúdo real e NÃO deve ser omitido.
  // 'referencias' também sai do corpo: a lista formatada é montada no bloco
  // dedicado de Referências (senão apareceria duplicada e numerada errado).
  const ehTitulo = (s: SecaoTrabalho) => /^titulo/.test(s.chave_secao)
  const secaoResumo = secoesOrdenadas.find(s => s.chave_secao === 'resumo')
  const secoesCorpo = secoesOrdenadas.filter(
    s => !ehTitulo(s) && s.chave_secao !== 'resumo' && s.chave_secao !== 'referencias'
  )

  // Renderiza um bloco de texto (parágrafos justificados) sem cabeçalho
  const pushParagrafos = (txt: string, indent = true) => {
    txt.split('\n').map(l => l.trim()).filter(Boolean).forEach(linha => {
      children.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: fmt.lineSpacing, lineRule: LineRuleType.AUTO, after: 0 },
        indent: indent ? { firstLine: convertInchesToTwip(0.5) } : undefined,
        children: textRunsFromMarkdown(linha),
      }))
    })
  }

  // ── Resumo / Abstract (antes da introdução, sem número) ─────────────────────
  if (secaoResumo?.conteudo?.trim()) {
    let r: { resumo?: string; abstract?: string; palavras_chave?: string[]; keywords?: string[] } = {}
    try { r = JSON.parse(secaoResumo.conteudo) } catch { r = { resumo: secaoResumo.conteudo } }

    if (r.resumo?.trim()) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(paragrafo('RESUMO', { center: true, bold: true, indent: false }))
      pushParagrafos(r.resumo, false)
      if (r.palavras_chave?.length) {
        children.push(empty())
        children.push(paragrafo(`Palavras-chave: ${r.palavras_chave.join('; ')}.`, { indent: false }))
      }
    }
    if (r.abstract?.trim()) {
      children.push(empty())
      children.push(paragrafo('ABSTRACT', { center: true, bold: true, indent: false }))
      pushParagrafos(r.abstract, false)
      if (r.keywords?.length) {
        children.push(empty())
        children.push(paragrafo(`Keywords: ${r.keywords.join('; ')}.`, { indent: false }))
      }
    }
  }

  secoesCorpo.forEach((secao, i) => {
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      secaoHeading(i + 1, secao.nome_secao),
    )

    // Separa o conteúdo em blocos: tabelas markdown (linhas com "|") viram
    // tabelas reais; o restante vira parágrafos justificados.
    const linhas = (secao.conteudo ?? '').split('\n')
    let bufProsa: string[] = []
    let bufTabela: string[] = []

    const flushProsa = () => {
      if (bufProsa.length === 0) return
      const paragrafos = extrairParagrafosParaDocx(bufProsa.join('\n'))
      paragrafos.forEach(p => {
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: fmt.lineSpacing, lineRule: LineRuleType.AUTO, after: 0 },
          indent: { firstLine: convertInchesToTwip(0.5) },
          children: textRunsFromMarkdown(p),
        }))
      })
      bufProsa = []
    }
    const flushTabela = () => {
      if (bufTabela.length === 0) return
      const tabela = construirTabelaDocx(bufTabela)
      if (tabela) { children.push(tabela); children.push(empty()) }
      else bufProsa.push(...bufTabela) // fallback: trata como texto
      bufTabela = []
    }

    for (const linha of linhas) {
      if (linha.trim().startsWith('|')) {
        flushProsa()
        bufTabela.push(linha)
      } else {
        flushTabela()
        bufProsa.push(linha)
      }
    }
    flushTabela()
    flushProsa()
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
