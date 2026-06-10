// ============================================================
// CIENTÍFICA AI — Travas do alinhamento do RESUMO ao corpo (puro, determinístico)
// ============================================================
// O alinhamento do resumo (reviewService.alinharResumoAoCorpo) usa IA para deixar
// o resumo/abstract fiéis ao corpo. Estas travas — aplicadas DEPOIS, na rota —
// garantem que o resultado é SEGURO: não inventa número novo e não colapsa/incha o
// texto. Se a trava reprovar, a rota mantém o resumo ORIGINAL (nunca piora).

/** Extrai tokens numéricos relevantes (percentuais, anos, números com 2+ dígitos). */
function numerosDe(texto: string): string[] {
  const matches = texto.match(/\d+(?:[.,]\d+)?%?/g) ?? []
  // Ignora números de 1 dígito sem "%" (ex.: "2 fases") — ruído; foca em dados reais.
  return matches.filter(n => /%/.test(n) || n.replace(/[.,]/g, '').length >= 2)
}

/**
 * Verdadeiro se `novo` contém algum número que NÃO existe em `base` (corpo +
 * resumo original) → indício de fabricação. Comparação tolerante a separador.
 */
export function temNumeroFabricado(novo: string, base: string): boolean {
  const norm = (s: string) => s.replace(/[.,]/g, '')
  const baseNums = new Set(numerosDe(base).map(norm))
  return numerosDe(novo).some(n => !baseNums.has(norm(n)))
}

export interface DecisaoAlinhamento {
  aceitar: boolean
  motivo: string
}

/**
 * Decide se o resumo/abstract alinhado pode substituir o original. Reprova quando:
 * vazio, número fabricado, ou colapso/inflação de tamanho (>50% perdido / >2x).
 * `base` deve conter o corpo + o resumo/abstract originais (universo de fatos).
 */
export function alinhamentoResumoSeguro(
  original: string,
  candidato: string,
  base: string,
): DecisaoAlinhamento {
  const o = original.trim()
  const c = candidato.trim()
  if (!c) return { aceitar: false, motivo: 'vazio' }
  if (o && (c.length < o.length * 0.5)) return { aceitar: false, motivo: 'colapso (>50% menor)' }
  if (o && (c.length > o.length * 2)) return { aceitar: false, motivo: 'inflação (>2x)' }
  if (temNumeroFabricado(c, base)) return { aceitar: false, motivo: 'número fabricado (não está no corpo)' }
  return { aceitar: true, motivo: 'ok' }
}
