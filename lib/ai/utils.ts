/**
 * Extrai texto legível de um campo conteudo de secao_trabalho.
 * A seção "resumo" é serializada pelo ResumoEditor como JSON:
 *   { resumo, abstract, palavras_chave, keywords }
 * Todos os outros campos são texto puro.
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
    // não é JSON — texto puro
  }
  return conteudo
}
