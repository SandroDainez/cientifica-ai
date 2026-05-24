/**
 * Pós-processamento de texto gerado pela IA para remover citações inventadas.
 * Um erro comum do modelo é usar o TÍTULO de um documento como autor da citação,
 * ex: (TÓPICOS EM CIÊNCIAS DA SAÚDE, 2021) em vez de (SILVA, 2021).
 *
 * Regra ABNT: citação in-text = (SOBRENOME, ANO) — 1 ou 2 sobrenomes, nunca um título.
 */

export function limparCitacoesInventadas(texto: string): string {
  return texto.replace(
    /\(([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][^)]{2,80}?),\s*(?:s\.?\s*d\.?|\d{4}(?:[a-z])?)\s*\)/g,
    (match, autorParte) => {
      const normalizado = autorParte
        .replace(/\s+et\s+al\.?/gi, '')
        .replace(/;/g, ' ')
        .trim()
      const palavras = normalizado.split(/\s+/).filter((w: string) => w.length > 1)
      // Mais de 2 palavras = provavelmente um título, não um sobrenome
      if (palavras.length > 2) {
        return '(SOBRENOME, ANO)'
      }
      return match
    }
  )
}
