import { extractProtectedScientificTokens } from '@/lib/ai/humanizar'

export interface SemanticLockResult {
  ok: boolean
  reasons: string[]
  metrics: {
    wordRatio: number
    missingNumbers: string[]
    addedNumbers: string[]
    missingCitations: string[]
    addedCitations: string[]
    missingStatistical: string[]
    addedStatistical: string[]
    changedDirectionTerms: string[]
  }
}

function words(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function diff(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(v => v.toLowerCase()))
  return a.filter(v => !setB.has(v.toLowerCase()))
}

function semanticFamilies(text: string): string[] {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const families = new Set<string>()
  if (/\bassoci\w*/.test(normalized)) families.add('associacao')
  if (/\bcaus\w*/.test(normalized)) families.add('causalidade')
  if (/\baument\w*/.test(normalized)) families.add('aumento')
  if (/\breduz\w*|\breduc\w*/.test(normalized)) families.add('reducao')
  if (/\bmaior\b|\bsuperior\b/.test(normalized)) families.add('maior')
  if (/\bmenor\b|\binferior\b/.test(normalized)) families.add('menor')
  if (/\bnao\b|\bsem\b/.test(normalized)) families.add('negacao')
  if (/\bpredi\w*/.test(normalized)) families.add('predicao')
  return [...families]
}

export function validateScientificRewrite(original: string, rewritten: string): SemanticLockResult {
  const reasons: string[] = []
  const before = extractProtectedScientificTokens(original)
  const after = extractProtectedScientificTokens(rewritten)

  const originalWords = words(original)
  const rewrittenWords = words(rewritten)
  const wordRatio = originalWords > 0 ? rewrittenWords / originalWords : 1

  const missingNumbers = diff(before.numbers, after.numbers)
  const addedNumbers = diff(after.numbers, before.numbers)
  const missingCitations = diff(before.citations, after.citations)
  const addedCitations = diff(after.citations, before.citations)
  const missingStatistical = diff(before.statistical, after.statistical)
  const addedStatistical = diff(after.statistical, before.statistical)

  // Compare meaning-level families rather than superficial inflections.
  // "associada" -> "associação" is equivalent; "associação" -> "causou" is not.
  const beforeFamilies = semanticFamilies(original)
  const afterFamilies = semanticFamilies(rewritten)
  const missingDirection = diff(beforeFamilies, afterFamilies)
  const addedDirection = diff(afterFamilies, beforeFamilies)
  const changedDirectionTerms = [...missingDirection.map(v => `-${v}`), ...addedDirection.map(v => `+${v}`)]

  if (missingNumbers.length) reasons.push(`Números/percentuais removidos: ${missingNumbers.join(', ')}`)
  if (addedNumbers.length) reasons.push(`Números/percentuais adicionados: ${addedNumbers.join(', ')}`)
  if (missingCitations.length) reasons.push(`Citações removidas: ${missingCitations.join(' | ')}`)
  if (addedCitations.length) reasons.push(`Citações adicionadas: ${addedCitations.join(' | ')}`)
  if (missingStatistical.length) reasons.push(`Marcadores estatísticos removidos: ${missingStatistical.join(', ')}`)
  if (addedStatistical.length) reasons.push(`Marcadores estatísticos adicionados: ${addedStatistical.join(', ')}`)
  if (changedDirectionTerms.length) reasons.push(`Termos de direção/causalidade/polaridade mudaram: ${changedDirectionTerms.join(', ')}`)
  if (wordRatio < 0.75 || wordRatio > 1.25) reasons.push(`Extensão alterada excessivamente: razão ${wordRatio.toFixed(2)}.`)

  return {
    ok: reasons.length === 0,
    reasons,
    metrics: {
      wordRatio,
      missingNumbers,
      addedNumbers,
      missingCitations,
      addedCitations,
      missingStatistical,
      addedStatistical,
      changedDirectionTerms,
    },
  }
}
