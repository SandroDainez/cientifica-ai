import type { ResearchProjectState } from './types'
import type { MethodologyPlan } from './methodology-engine'
import type { SampleSizePlan } from './sample-size-engine'

export type ProtocolLockStatus = 'bloqueado' | 'pronto_para_congelar' | 'congelado' | 'alterado_apos_congelamento'

export interface ProtocolSnapshot {
  version: number
  frozenAt: string
  fingerprint: string
  design: ResearchProjectState['studyDesign']
  question: {
    population?: string
    interventionOrExposure?: string
    comparator?: string
    primaryOutcome?: string
    secondaryOutcomes: string[]
    hypothesis?: string
  }
  statistics: {
    estimand?: string
    sampleSize?: number
    sampleSizeRationale?: string
    primaryAnalysis?: string
    covariates: string[]
    confounders: string[]
    missingDataStrategy?: string
    multiplicityStrategy?: string
  }
  methodology: MethodologyPlan | null
  sampleSize: SampleSizePlan | null
  ethicsRoutes: string[]
  reportingGuidelines: string[]
}

export interface ProtocolAmendment {
  fromVersion: number
  toVersion: number
  changedAt: string
  reason: string
  changes: ProtocolChange[]
  previousFingerprint: string
  nextFingerprint: string
}

export interface ProtocolChange {
  field: string
  before: unknown
  after: unknown
}

export interface ProtocolLockRecord {
  status: 'congelado'
  snapshot: ProtocolSnapshot
  amendments: ProtocolAmendment[]
}

export interface ProtocolReadiness {
  status: ProtocolLockStatus
  canFreeze: boolean
  blockers: string[]
  warnings: string[]
  changes: ProtocolChange[]
}

const SAMPLE_SIZE_REQUIRED = new Set<ResearchProjectState['studyDesign']>([
  'ensaio_clinico_randomizado',
  'ensaio_clinico_nao_randomizado',
  'coorte_prospectiva',
  'diagnostico',
  'prognostico',
  'modelo_preditivo',
  'experimental_animal',
])

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

function snapshotPayload(
  state: ResearchProjectState,
  methodology: MethodologyPlan | null,
  sampleSize: SampleSizePlan | null,
) {
  return {
    design: state.studyDesign,
    question: {
      population: state.question.population,
      interventionOrExposure: state.question.interventionOrExposure,
      comparator: state.question.comparator,
      primaryOutcome: state.question.primaryOutcome,
      secondaryOutcomes: [...state.question.secondaryOutcomes],
      hypothesis: state.question.hypothesis,
    },
    statistics: {
      estimand: state.statisticalPlan.estimand,
      sampleSize: state.statisticalPlan.sampleSize,
      sampleSizeRationale: state.statisticalPlan.sampleSizeRationale,
      primaryAnalysis: state.statisticalPlan.primaryAnalysis,
      covariates: [...state.statisticalPlan.covariates],
      confounders: [...state.statisticalPlan.confounders],
      missingDataStrategy: state.statisticalPlan.missingDataStrategy,
      multiplicityStrategy: state.statisticalPlan.multiplicityStrategy,
    },
    methodology,
    sampleSize,
    ethicsRoutes: [...state.ethicsRoutes],
    reportingGuidelines: [...state.reportingGuidelines],
  }
}

export function buildProtocolSnapshot(params: {
  state: ResearchProjectState
  methodology: MethodologyPlan | null
  sampleSize: SampleSizePlan | null
  version?: number
  frozenAt?: string
}): ProtocolSnapshot {
  const payload = snapshotPayload(params.state, params.methodology, params.sampleSize)
  return {
    version: params.version ?? 1,
    frozenAt: params.frozenAt ?? new Date().toISOString(),
    fingerprint: fingerprint(payload),
    ...payload,
  }
}

function flattenComparable(snapshot: ProtocolSnapshot): Record<string, unknown> {
  return {
    design: snapshot.design,
    population: snapshot.question.population,
    interventionOrExposure: snapshot.question.interventionOrExposure,
    comparator: snapshot.question.comparator,
    primaryOutcome: snapshot.question.primaryOutcome,
    secondaryOutcomes: snapshot.question.secondaryOutcomes,
    hypothesis: snapshot.question.hypothesis,
    estimand: snapshot.statistics.estimand,
    sampleSize: snapshot.statistics.sampleSize,
    sampleSizeRationale: snapshot.statistics.sampleSizeRationale,
    primaryAnalysis: snapshot.statistics.primaryAnalysis,
    covariates: snapshot.statistics.covariates,
    confounders: snapshot.statistics.confounders,
    missingDataStrategy: snapshot.statistics.missingDataStrategy,
    multiplicityStrategy: snapshot.statistics.multiplicityStrategy,
    methodology: snapshot.methodology,
    sampleSizePlan: snapshot.sampleSize,
    ethicsRoutes: snapshot.ethicsRoutes,
    reportingGuidelines: snapshot.reportingGuidelines,
  }
}

export function compareProtocolSnapshots(before: ProtocolSnapshot, after: ProtocolSnapshot): ProtocolChange[] {
  const a = flattenComparable(before)
  const b = flattenComparable(after)
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  return fields
    .filter(field => stable(a[field]) !== stable(b[field]))
    .map(field => ({ field, before: a[field], after: b[field] }))
}

export function evaluateProtocolReadiness(params: {
  state: ResearchProjectState
  methodology: MethodologyPlan | null
  sampleSize: SampleSizePlan | null
  existingLock?: ProtocolLockRecord | null
}): ProtocolReadiness {
  const { state, methodology, sampleSize, existingLock } = params
  const blockers: string[] = []
  const warnings: string[] = []

  if (state.studyDesign === 'indefinido') blockers.push('Definir o desenho científico antes de congelar o protocolo.')
  if (!state.question.primaryOutcome?.trim()) blockers.push('Definir o desfecho primário antes de congelar o protocolo.')
  if (!methodology || methodology.readiness !== 'pronto') blockers.push('Concluir o Methodology Plan/SAP antes de congelar o protocolo.')
  if (state.readiness.statistics !== 'pronto') blockers.push('A prontidão estatística precisa estar pronta antes do congelamento.')

  if (SAMPLE_SIZE_REQUIRED.has(state.studyDesign)) {
    if (!sampleSize || sampleSize.status !== 'calculado') {
      blockers.push('Este desenho exige planejamento amostral concluído antes do congelamento do protocolo.')
    }
  } else if (!sampleSize || sampleSize.status !== 'calculado') {
    warnings.push('O tamanho amostral não está calculado; para este desenho isso não impede o lock, mas a justificativa deve permanecer explícita.')
  }

  const current = buildProtocolSnapshot({ state, methodology, sampleSize, version: existingLock?.snapshot.version ?? 1, frozenAt: existingLock?.snapshot.frozenAt })
  const changes = existingLock ? compareProtocolSnapshots(existingLock.snapshot, current) : []

  if (existingLock && changes.length > 0) {
    return { status: 'alterado_apos_congelamento', canFreeze: false, blockers, warnings, changes }
  }
  if (existingLock) return { status: 'congelado', canFreeze: false, blockers, warnings, changes: [] }
  if (blockers.length > 0) return { status: 'bloqueado', canFreeze: false, blockers, warnings, changes: [] }
  return { status: 'pronto_para_congelar', canFreeze: true, blockers: [], warnings, changes: [] }
}

export function freezeProtocol(params: {
  state: ResearchProjectState
  methodology: MethodologyPlan | null
  sampleSize: SampleSizePlan | null
  existingLock?: ProtocolLockRecord | null
  amendmentReason?: string
  now?: string
}): ProtocolLockRecord {
  const { existingLock } = params
  const readiness = evaluateProtocolReadiness(params)
  if (readiness.blockers.length > 0) throw new Error(readiness.blockers.join(' '))

  const now = params.now ?? new Date().toISOString()
  if (!existingLock) {
    return {
      status: 'congelado',
      snapshot: buildProtocolSnapshot({ state: params.state, methodology: params.methodology, sampleSize: params.sampleSize, version: 1, frozenAt: now }),
      amendments: [],
    }
  }

  const candidate = buildProtocolSnapshot({
    state: params.state,
    methodology: params.methodology,
    sampleSize: params.sampleSize,
    version: existingLock.snapshot.version + 1,
    frozenAt: now,
  })
  const changes = compareProtocolSnapshots(existingLock.snapshot, candidate)
  if (changes.length === 0) return existingLock
  if (!params.amendmentReason?.trim()) throw new Error('Mudanças após o congelamento exigem justificativa de amendment/desvio.')

  const amendment: ProtocolAmendment = {
    fromVersion: existingLock.snapshot.version,
    toVersion: candidate.version,
    changedAt: now,
    reason: params.amendmentReason.trim(),
    changes,
    previousFingerprint: existingLock.snapshot.fingerprint,
    nextFingerprint: candidate.fingerprint,
  }

  return {
    status: 'congelado',
    snapshot: candidate,
    amendments: [...existingLock.amendments, amendment],
  }
}
