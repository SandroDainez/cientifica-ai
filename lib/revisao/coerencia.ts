// ============================================================
// CIENTÍFICA AI — Coerência global (ajuste cross-seção seguro)
// ============================================================
// Alinha o trabalho como um todo (objetivos ↔ método ↔ resultados ↔ conclusão,
// contradições de números/fatos, promessas não cumpridas). REGRA DE SEGURANÇA:
// o ajuste só pode mexer nas seções de ENQUADRAMENTO (introdução, justificativa,
// discussão, conclusão) para casarem com os FATOS (metodologia/resultados) — NUNCA
// o contrário. Os fatos são a verdade; o enquadramento se ajusta a eles.
// Funções puras → travadas por teste de regressão.

import { extrairJsonObjeto } from '@/lib/ai/reviewService'

export interface AjusteCoerencia {
  chave_secao: string
  buscar: string
  substituir: string
  motivo?: string
}

/**
 * Seções que a coerência global PODE editar (enquadramento/narrativa). Metodologia,
 * resultados, dados, título, resumo (JSON), objetivos e referências ficam FORA —
 * são fatos/estrutura e não podem ser alterados para "encaixar" o discurso.
 */
export function ehSecaoEnquadramento(chaveSecao: string): boolean {
  const c = (chaveSecao || '').toLowerCase()
  // Nunca editáveis pela coerência (fatos/estrutura)
  if (/metodo|metodolog|resultad|dados|analise_estat|titulo|resumo|referenc|objetivo|pico|palavras_chave|tabela/.test(c)) {
    return false
  }
  // Editáveis: enquadramento e narrativa interpretativa
  return /introdu|justificat|discuss|conclus|consideracoes|revisao_lit|referencial|desenvolvimento/.test(c)
}

/** Extrai e valida a lista de ajustes de coerência do JSON do modelo. */
export function parseAjustesCoerencia(raw: string): AjusteCoerencia[] {
  const json = extrairJsonObjeto(raw) as { ajustes?: unknown } | null
  if (!json || !Array.isArray(json.ajustes)) return []
  return (json.ajustes as unknown[]).filter((a): a is AjusteCoerencia => {
    if (typeof a !== 'object' || a === null) return false
    const o = a as Record<string, unknown>
    return typeof o.chave_secao === 'string' && o.chave_secao.trim().length > 0
      && typeof o.buscar === 'string' && o.buscar.trim().length >= 3
      && typeof o.substituir === 'string' && o.substituir !== o.buscar
  })
}
