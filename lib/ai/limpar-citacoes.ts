/**
 * Pós-processamento de texto gerado pela IA para remover citações inventadas.
 *
 * Cobre dois formatos ABNT:
 *  1. Parentético:  (TÓPICOS EM CIÊNCIAS DA SAÚDE, 2021)  → (SOBRENOME, ANO)
 *  2. Inline:       Silva e Hahn (2026) com ano futuro     → Autor e Autor (ANO)
 *
 * Regra ABNT: citação in-text = (SOBRENOME, ANO) — 1 ou 2 sobrenomes, nunca um título.
 */

const ANO_ATUAL = new Date().getFullYear()

export function limparCitacoesInventadas(texto: string): string {
  // ── 1. Remove citações parentéticas com títulos no lugar de sobrenomes ──────
  //   Ex: (TÓPICOS EM CIÊNCIAS DA SAÚDE, 2021)  →  (SOBRENOME, ANO)
  let resultado = texto.replace(
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

  // ── 2. Remove citações inline com ano futuro ────────────────────────────────
  //   Ex: "Hahn e Santos (2027)"  →  "Autor e Autor (ANO)"
  //   Só atua em anos futuros — anos passados podem ser referências reais.
  resultado = resultado.replace(
    /([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+(?:\s+e\s+[A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+)?)\s+\((\d{4})\)/g,
    (match, nomes, anoStr) => {
      const ano = Number(anoStr)
      if (ano > ANO_ATUAL) {
        return `Autor e Autor (ANO)`
      }
      return match
    }
  )

  return resultado
}
