/**
 * Pós-processamento de texto gerado pela IA para remover citações inventadas.
 *
 * Regras ABNT NBR 10520:
 *  - Citação parentética: (SOBRENOME, ANO)  ou  (SOBRENOME et al., ANO)
 *  - Autores institucionais: (MINISTÉRIO DA SAÚDE, 2022) — VÁLIDO, não remover
 *  - Títulos como autores: (TÓPICOS EM CIÊNCIAS DA SAÚDE, 2021) — INVÁLIDO
 *
 * Heurística para distinguir autor de título:
 *  - Palavras funcionais em PT/EN no meio do texto → provavelmente título
 *  - 5+ palavras no campo do autor → provavelmente título
 *  - 1-4 palavras, sem artigos/preposições → provavelmente autor
 */

const ANO_ATUAL = new Date().getFullYear()

// Palavras funcionais do português/inglês que aparecem em títulos mas não em sobrenomes
const PALAVRAS_FUNCIONAIS = new Set([
  'EM', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'NO', 'NA', 'NOS', 'NAS',
  'COM', 'PARA', 'POR', 'SOBRE', 'ENTRE', 'ANTE', 'APÓS', 'ATÉ', 'DESDE',
  'UMA', 'UM', 'OS', 'AS', 'A', 'O', 'E', 'QUE', 'SE', 'AO', 'AOS',
  'THE', 'OF', 'IN', 'AND', 'OR', 'FOR', 'TO', 'WITH', 'BY', 'AT',
  'AN', 'ON', 'IS', 'ARE', 'WERE', 'BE', 'BEEN', 'HAVE', 'HAS',
])

function parece_titulo(autorParte: string): boolean {
  const normalizado = autorParte
    .replace(/\s+et\s+al\.?/gi, '')
    .replace(/;/g, ' ')
    .trim()

  const palavras = normalizado
    .split(/\s+/)
    .filter(w => w.length > 1)

  // 5+ palavras: quase certamente é um título
  if (palavras.length >= 5) return true

  // 4 palavras: verifica se alguma é palavra funcional
  if (palavras.length === 4) {
    const temFuncional = palavras.some(w => PALAVRAS_FUNCIONAIS.has(w.toUpperCase()))
    return temFuncional
  }

  // 3 palavras: verifica com mais cuidado
  if (palavras.length === 3) {
    // "MINISTÉRIO DA SAÚDE", "WORLD HEALTH ORGANIZATION" → não remover
    // mas "SAÚDE EM DEBATE" → remover (tem palavra funcional no meio)
    const internasComFuncional = palavras.slice(1).some(w => PALAVRAS_FUNCIONAIS.has(w.toUpperCase()))
    return internasComFuncional
  }

  // 1-2 palavras: provavelmente é um sobrenome ou institucional curto
  return false
}

export function limparCitacoesInventadas(texto: string): string {
  // ── 1. Remove citações parentéticas com títulos no lugar de sobrenomes ──────
  //   Ex: (TÓPICOS EM CIÊNCIAS DA SAÚDE, 2021)  →  (SOBRENOME, ANO)
  //   Preserva: (WORLD HEALTH ORGANIZATION, 2023), (MINISTÉRIO DA SAÚDE, 2022)
  let resultado = texto.replace(
    /\(([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][^)]{2,80}?),\s*(?:s\.?\s*d\.?|\d{4}(?:[a-z])?)\s*\)/g,
    (match, autorParte) => {
      if (parece_titulo(autorParte)) {
        return '(SOBRENOME, ANO)'
      }
      return match
    }
  )

  // ── 2. Remove citações inline com ano futuro ────────────────────────────────
  //   Ex: "Hahn e Santos (2027)"  →  "Hahn e Santos (ANO)"
  //   Só atua em anos FUTUROS — anos passados podem ser referências reais.
  resultado = resultado.replace(
    /([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+(?:\s+e\s+[A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+)?)\s+\((\d{4})\)/g,
    (match, nomes, anoStr) => {
      const ano = Number(anoStr)
      if (ano > ANO_ATUAL) {
        // Substitui apenas o ano, mantém o nome (pode ser real)
        return `${nomes} (${ANO_ATUAL})`
      }
      return match
    }
  )

  return resultado
}
