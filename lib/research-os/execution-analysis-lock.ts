import type { ProtocolLockRecord, ProtocolSnapshot } from './protocol-lock'

export type ExecutionDeviationCategory =
  | 'amostra'
  | 'desfecho'
  | 'analise'
  | 'missing_data'
  | 'exclusoes'
  | 'sensibilidade'
  | 'outro'

export interface ExecutionDeviation {
  id: string
  category: ExecutionDeviationCategory
  planned: string
  actual: string
  reason: string
  impact?: string
}

export interface ExecutionAnalysisInput {
  actualSampleSize?: number
  primaryOutcomeAnalyzed?: string
  primaryAnalysisPerformed?: string
  missingDataHandling?: string
  analysisPopulation?: string
  exclusionsSummary?: string
  sensitivityAnalyses?: string[]
  deviations?: ExecutionDeviation[]
}

export interface ExecutionAnalysisRecord {
  status: 'rascunho' | 'congelado'
  protocolVersion: number
  protocolFingerprint: string
  recordedAt: string
  frozenAt?: string
  fingerprint: string
  actualSampleSize?: number
  primaryOutcomeAnalyzed?: string
  primaryAnalysisPerformed?: string
  missingDataHandling?: string
  analysisPopulation?: string
  exclusionsSummary?: string
  sensitivityAnalyses: string[]
  deviations: ExecutionDeviation[]
}

export interface ExecutionAnalysisReadiness {
  status: 'bloqueado' | 'parcial' | 'pronto_para_congelar' | 'congelado'
  canFreeze: boolean
  blockers: string[]
  warnings: string[]
  requiredDeviationCategories: ExecutionDeviationCategory[]
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map(key => `${JSON.stringify(key)}:${stable(obj[key])}`).join(',')}}`
}

function fingerprint(value: unknown): string {
  const text = stable(value)
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code + i
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

function normalized(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function hasDocumentedDeviation(input: ExecutionAnalysisInput, category: ExecutionDeviationCategory): boolean {
  return (input.deviations ?? []).some(item => item.category === category && item.reason.trim().length >= 8)
}

function plannedSampleSize(snapshot: ProtocolSnapshot): number | undefined {
  return snapshot.statistics.sampleSize ?? snapshot.sampleSize?.adjustedSampleSize ?? undefined
}

function plannedPrimaryAnalysis(snapshot: ProtocolSnapshot): string | undefined {
  return snapshot.statistics.primaryAnalysis ?? snapshot.methodology?.primaryAnalysis ?? undefined
}

function plannedMissingData(snapshot: ProtocolSnapshot): string | undefined {
  return snapshot.statistics.missingDataStrategy ?? snapshot.methodology?.missingDataStrategy ?? undefined
}

export function requiredExecutionDeviations(
  protocol: ProtocolLockRecord,
  input: ExecutionAnalysisInput,
): ExecutionDeviationCategory[] {
  const required = new Set<ExecutionDeviationCategory>()
  const snapshot = protocol.snapshot

  const plannedN = plannedSampleSize(snapshot)
  if (plannedN !== undefined && input.actualSampleSize !== undefined && input.actualSampleSize !== plannedN) required.add('amostra')

  const plannedOutcome = normalized(snapshot.question.primaryOutcome)
  const actualOutcome = normalized(input.primaryOutcomeAnalyzed)
  if (plannedOutcome && actualOutcome && plannedOutcome !== actualOutcome) required.add('desfecho')

  const plannedAnalysis = normalized(plannedPrimaryAnalysis(snapshot))
  const actualAnalysis = normalized(input.primaryAnalysisPerformed)
  if (plannedAnalysis && actualAnalysis && plannedAnalysis !== actualAnalysis) required.add('analise')

  const plannedMissing = normalized(plannedMissingData(snapshot))
  const actualMissing = normalized(input.missingDataHandling)
  if (plannedMissing && actualMissing && plannedMissing !== actualMissing) required.add('missing_data')

  if (input.exclusionsSummary?.trim()) required.add('exclusoes')
  return [...required]
}

export function evaluateExecutionAnalysisReadiness(params: {
  protocolLock: ProtocolLockRecord | null | undefined
  input: ExecutionAnalysisInput
  existingRecord?: ExecutionAnalysisRecord | null
}): ExecutionAnalysisReadiness {
  const blockers: string[] = []
  const warnings: string[] = []

  if (!params.protocolLock) {
    return {
      status: 'bloqueado',
      canFreeze: false,
      blockers: ['Congele primeiro o protocolo científico antes de registrar a execução/análise.'],
      warnings,
      requiredDeviationCategories: [],
    }
  }

  if (params.existingRecord?.status === 'congelado') {
    return {
      status: 'congelado',
      canFreeze: false,
      blockers: [],
      warnings: ['O registro de execução/análise já foi congelado. Mudanças posteriores devem gerar uma nova versão auditável em evolução futura do motor.'],
      requiredDeviationCategories: [],
    }
  }

  const input = params.input
  if (!input.actualSampleSize || input.actualSampleSize <= 0) blockers.push('Registrar o tamanho amostral efetivamente analisado.')
  if (!input.primaryOutcomeAnalyzed?.trim()) blockers.push('Registrar qual desfecho primário foi efetivamente analisado.')
  if (!input.primaryAnalysisPerformed?.trim()) blockers.push('Registrar qual análise primária foi efetivamente executada.')
  if (!input.missingDataHandling?.trim()) blockers.push('Registrar como os dados ausentes foram efetivamente tratados.')

  const requiredDeviationCategories = requiredExecutionDeviations(params.protocolLock, input)
  for (const category of requiredDeviationCategories) {
    if (!hasDocumentedDeviation(input, category)) {
      blockers.push(`Existe divergência de ${category} em relação ao protocolo e ela exige justificativa explícita.`)
    }
  }

  const plannedN = plannedSampleSize(params.protocolLock.snapshot)
  if (plannedN !== undefined && input.actualSampleSize !== undefined && input.actualSampleSize < plannedN) {
    warnings.push(`A amostra analisada (${input.actualSampleSize}) ficou abaixo da planejada (${plannedN}); impacto em precisão/poder deve ser discutido.`)
  }

  if (!(input.sensitivityAnalyses ?? []).length) {
    warnings.push('Nenhuma análise de sensibilidade foi registrada; confirme se realmente não era necessária.')
  }

  return {
    status: blockers.length ? 'parcial' : 'pronto_para_congelar',
    canFreeze: blockers.length === 0,
    blockers,
    warnings,
    requiredDeviationCategories,
  }
}

export function buildExecutionAnalysisRecord(params: {
  protocolLock: ProtocolLockRecord
  input: ExecutionAnalysisInput
  freeze?: boolean
  now?: string
}): ExecutionAnalysisRecord {
  const now = params.now ?? new Date().toISOString()
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: params.protocolLock, input: params.input })
  if (params.freeze && !readiness.canFreeze) throw new Error(readiness.blockers.join(' '))

  const payload = {
    protocolVersion: params.protocolLock.snapshot.version,
    protocolFingerprint: params.protocolLock.snapshot.fingerprint,
    actualSampleSize: params.input.actualSampleSize,
    primaryOutcomeAnalyzed: params.input.primaryOutcomeAnalyzed?.trim() || undefined,
    primaryAnalysisPerformed: params.input.primaryAnalysisPerformed?.trim() || undefined,
    missingDataHandling: params.input.missingDataHandling?.trim() || undefined,
    analysisPopulation: params.input.analysisPopulation?.trim() || undefined,
    exclusionsSummary: params.input.exclusionsSummary?.trim() || undefined,
    sensitivityAnalyses: (params.input.sensitivityAnalyses ?? []).map(v => v.trim()).filter(Boolean),
    deviations: (params.input.deviations ?? []).map((item, index) => ({
      ...item,
      id: item.id?.trim() || `D${index + 1}`,
      planned: item.planned.trim(),
      actual: item.actual.trim(),
      reason: item.reason.trim(),
      impact: item.impact?.trim() || undefined,
    })),
  }

  return {
    status: params.freeze ? 'congelado' : 'rascunho',
    recordedAt: now,
    frozenAt: params.freeze ? now : undefined,
    fingerprint: fingerprint(payload),
    ...payload,
  }
}
