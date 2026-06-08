/**
 * Extrai texto legível de um campo conteudo de secao_trabalho.
 * A seção "resumo" é serializada pelo ResumoEditor como JSON:
 *   { resumo, abstract, palavras_chave, keywords }
 * Todos os outros campos são texto puro ou markdown.
 */
export function extrairTextoSecao(conteudo: string): string {
  if (!conteudo) return ''
  try {
    const parsed = JSON.parse(conteudo)
    if (typeof parsed === 'object' && parsed !== null) {
      const partes: string[] = []
      if (parsed.resumo) partes.push(parsed.resumo)
      if (parsed.abstract) partes.push(`Abstract: ${parsed.abstract}`)
      if (parsed.palavras_chave?.length)
        partes.push(`Palavras-chave: ${(parsed.palavras_chave as string[]).join('; ')}.`)
      if (parsed.keywords?.length)
        partes.push(`Keywords: ${(parsed.keywords as string[]).join('; ')}.`)
      return partes.join('\n\n')
    }
  } catch {
    // não é JSON — texto puro/markdown
  }
  return conteudo
}

/**
 * Remove marcadores estruturais de markdown mas preserva **negrito** e *itálico*.
 * Usado no DOCX para manter formatação inline nas referências e corpo do texto.
 */
export function limparMarkdownEstrutura(texto: string): string {
  return texto
    // cercas de blocos de código (``` ou ```r) → remove só a marcação, preserva o código
    .replace(/^[ \t]*`{3,}[^\n]*$/gm, '')
    // headings: # ## ### etc.
    .replace(/^#{1,6}\s+/gm, '')
    // regras horizontais --- *** ___
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // blockquotes: > texto
    .replace(/^>\s*/gm, '')
    // bullet points: - item, * item, + item
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    // listas numeradas: 1. item, 2. item
    .replace(/^[ \t]*\d+\.\s+/gm, '')
    // imagens: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // links: [texto](url) → texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // código inline: `texto` → texto
    .replace(/`([^`]+)`/g, '$1')
    // normalizar múltiplas linhas em branco
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Corrige erros comuns e determinísticos em código R gerado pela IA.
 * Atua apenas sobre padrões inequívocos da sintaxe (valores literais de
 * argumentos específicos do tidyverse), então é seguro aplicar em qualquer texto.
 *
 * - `groups = "drop"`  →  `.groups = "drop"`  (argumento de dplyr::summarise;
 *   sem o ponto inicial o código quebra ao ser executado)
 */
export function corrigirCodigoR(texto: string): string {
  if (!texto) return texto
  return texto.replace(
    /(^|[^.\w])groups(\s*=\s*"(?:drop|keep|drop_last|rowwise)")/g,
    '$1.groups$2',
  )
}

/**
 * Remove TODO o markdown, incluindo **negrito** e *itálico*.
 * Usado no PPTX onde o texto deve ser completamente limpo.
 */
export function limparMarkdownCompleto(texto: string): string {
  return limparMarkdownEstrutura(texto)
    // negrito+itálico combinados: ***texto***
    .replace(/\*{3}([^*\n]+)\*{3}/g, '$1')
    // negrito: **texto**
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    // itálico: *texto*
    .replace(/\*([^*\n]+)\*/g, '$1')
    // sublinhado/tachado: ~~texto~~
    .replace(/~~([^~\n]+)~~/g, '$1')
    // colapsar espaços múltiplos
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * Extrai texto limpo para slides de PowerPoint (PPTX).
 * Remove todo o markdown, garante início com maiúscula e corta no limite
 * de caracteres sem quebrar palavras.
 */
export function extrairTextoParaSlide(conteudo: string, maxChars = 600): string {
  const base    = extrairTextoSecao(conteudo)
  const linear  = limparMarkdownCompleto(base)
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!linear) return ''

  // Garante que começa com letra maiúscula
  const texto = linear.charAt(0).toUpperCase() + linear.slice(1)

  if (texto.length <= maxChars) return texto

  // Cortar na última fronteira de palavra dentro do limite
  const cortado      = texto.substring(0, maxChars)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  const trecho       = ultimoEspaco > maxChars * 0.75
    ? cortado.substring(0, ultimoEspaco)
    : cortado

  return trecho + '…'
}

/**
 * Extrai parágrafos limpos para o DOCX.
 * Remove marcadores estruturais mas preserva **negrito** e *itálico*
 * para que textRunsFromMarkdown() possa processá-los.
 * Garante que cada parágrafo comece com letra maiúscula.
 */
export function extrairParagrafosParaDocx(conteudo: string): string[] {
  const base = extrairTextoSecao(conteudo)
  const limpo = limparMarkdownEstrutura(base)

  return limpo
    .split('\n')
    .map(p => {
      const t = p.trim()
      if (!t) return ''
      // Capitaliza início de cada parágrafo
      return t.charAt(0).toUpperCase() + t.slice(1)
    })
    .filter(Boolean)
}
