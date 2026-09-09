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

  const missingDirection = diff(before.directionTerms, after.directionTerms)
  const addedDirection = diff(after.directionTerms, before.directionTerms)
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
