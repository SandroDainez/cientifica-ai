import type { ResearchProjectState } from './types'

export type MethodologyGateLevel = 'liberar' | 'alertar' | 'bloquear'

export interface MethodologyGateDecision {
  allowed: boolean
  level: MethodologyGateLevel
  reasons: string[]
}

const METHOD_SECTIONS = new Set([
  'metodologia',
  'metodos_delineamento',
  'metodos_coleta',
  'metodos_analise',
  'analise_estatistica',
  'plano_analise_estatistica',
])

export function isMethodologySection(sectionKey: string): boolean {
  return METHOD_SECTIONS.has(sectionKey)
}

export function evaluateMethodologyGate(
  sectionKey: string,
  state: ResearchProjectState | null | undefined,
): MethodologyGateDecision {
  if (!isMethodologySection(sectionKey)) {
    return { allowed: true, level: 'liberar', reasons: ['Seção fora do Methodology Gate.'] }
  }

  if (!state) {
    return { allowed: true, level: 'liberar', reasons: ['Projeto legado sem Research OS ativo.'] }
  }

  const reasons: string[] = []
  if (state.studyDesign === 'indefinido') reasons.push('O desenho científico ainda está indefinido.')
  if (!state.question.primaryOutcome?.trim()) reasons.push('O desfecho primário ainda não foi definido.')
  if (!state.statisticalPlan.primaryAnalysis?.trim()) reasons.push('A análise estatística primária ainda não foi definida.')
  if (!state.statisticalPlan.missingDataStrategy?.trim()) reasons.push('A estratégia para dados ausentes ainda não foi definida.')
  if (state.readiness.statistics !== 'pronto') reasons.push('O Statistical Analysis Plan ainda não atingiu prontidão suficiente.')

  if (reasons.length > 0) return { allowed: false, level: 'bloquear', reasons }

  return {
    allowed: true,
    level: 'liberar',
    reasons: ['Desenho, desfecho primário e Statistical Analysis Plan estão estruturados.'],
  }
}
