import type { MethodologyPlan } from './methodology-engine'
import {
  buildProtocolSnapshot,
  compareProtocolSnapshots,
  type ProtocolLockRecord,
  type ProtocolSnapshot,
} from './protocol-lock'
import type { SampleSizePlan } from './sample-size-engine'
import type { ResearchProjectState } from './types'

export interface ProtocolGenerationPolicy {
  allowed: boolean
  level: 'liberar' | 'bloquear'
  reasons: string[]
  promptGuardrail: string
  protocolVersion?: number
  protocolFingerprint?: string
  changedFields: string[]
}

export function isProtocolLockRecord(value: unknown): value is ProtocolLockRecord {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<ProtocolLockRecord>
  if (v.status !== 'congelado' || !v.snapshot || !Array.isArray(v.amendments)) return false
  const snapshot = v.snapshot as Partial<ProtocolSnapshot>
  return typeof snapshot.version === 'number'
    && typeof snapshot.fingerprint === 'string'
    && typeof snapshot.design === 'string'
    && Boolean(snapshot.question)
    && Boolean(snapshot.statistics)
}

function methodologyPrompt(snapshot: ProtocolSnapshot): string {
  const methodology = snapshot.methodology
  const sampleSize = snapshot.sampleSize
  return [
    '## RESEARCH OS — PROTOCOL LOCK',
    `A fonte metodológica autoritativa desta seção é o protocolo congelado v${snapshot.version} (fingerprint ${snapshot.fingerprint}).`,
    'Redija Métodos exclusivamente a partir das decisões congeladas abaixo. Não introduza decisões novas, não substitua parâmetros e não atualize silenciosamente o protocolo com base no estado mutável do projeto.',
    `- desenho: ${snapshot.design}`,
    `- população: ${snapshot.question.population ?? '(não definida no snapshot)'}`,
    `- intervenção/exposição: ${snapshot.question.interventionOrExposure ?? '(não definida)'}`,
    `- comparador: ${snapshot.question.comparator ?? '(não definido)'}`,
    `- desfecho primário: ${snapshot.question.primaryOutcome ?? '(não definido)'}`,
    `- desfechos secundários: ${snapshot.question.secondaryOutcomes.length ? snapshot.question.secondaryOutcomes.join(' | ') : '(nenhum)'}`,
    `- estimando: ${snapshot.statistics.estimand ?? '(não definido)'}`,
    `- análise primária: ${snapshot.statistics.primaryAnalysis ?? methodology?.primaryAnalysis ?? '(não definida)'}`,
    `- medida de efeito: ${methodology?.effectMeasure ?? '(não definida)'}`,
    `- ajuste: ${methodology?.adjustmentStrategy ?? '(não definido)'}`,
    `- dados ausentes: ${snapshot.statistics.missingDataStrategy ?? methodology?.missingDataStrategy ?? '(não definido)'}`,
    `- multiplicidade: ${snapshot.statistics.multiplicityStrategy ?? methodology?.multiplicityStrategy ?? '(não definida)'}`,
    `- tamanho amostral: ${snapshot.statistics.sampleSize ?? sampleSize?.adjustedSampleSize ?? '(não calculado)'}`,
    `- justificativa amostral: ${snapshot.statistics.sampleSizeRationale ?? sampleSize?.formulaFamily ?? '(não registrada)'}`,
    `- confundidores: ${snapshot.statistics.confounders.length ? snapshot.statistics.confounders.join(' | ') : '(nenhum pré-especificado)'}`,
    `- covariáveis: ${snapshot.statistics.covariates.length ? snapshot.statistics.covariates.join(' | ') : '(nenhuma pré-especificada)'}`,
    `- rotas éticas: ${snapshot.ethicsRoutes.length ? snapshot.ethicsRoutes.join(' | ') : '(nenhuma registrada)'}`,
    `- diretrizes de relato: ${snapshot.reportingGuidelines.length ? snapshot.reportingGuidelines.join(' | ') : '(nenhuma registrada)'}`,
    'Se faltar um detalhe operacional que não esteja no protocolo, sinalize a lacuna; não complete por suposição.',
  ].join('\n')
}

export function buildProtocolGroundedMethodsPolicy(params: {
  state: ResearchProjectState
  methodology: MethodologyPlan | null
  sampleSize: SampleSizePlan | null
  protocolLock: ProtocolLockRecord
}): ProtocolGenerationPolicy {
  const frozen = params.protocolLock.snapshot
  const current = buildProtocolSnapshot({
    state: params.state,
    methodology: params.methodology,
    sampleSize: params.sampleSize,
    version: frozen.version,
    frozenAt: frozen.frozenAt,
  })
  const changes = compareProtocolSnapshots(frozen, current)
  const changedFields = changes.map(change => change.field)

  if (changes.length > 0) {
    return {
      allowed: false,
      level: 'bloquear',
      reasons: [
        `O projeto divergiu do protocolo congelado v${frozen.version}.`,
        `Campos alterados: ${changedFields.join(', ')}.`,
        'Registre um amendment com justificativa antes de gerar novamente a seção de Métodos.',
      ],
      promptGuardrail: '',
      protocolVersion: frozen.version,
      protocolFingerprint: frozen.fingerprint,
      changedFields,
    }
  }

  return {
    allowed: true,
    level: 'liberar',
    reasons: [`Métodos ancorados no protocolo congelado v${frozen.version}.`],
    promptGuardrail: methodologyPrompt(frozen),
    protocolVersion: frozen.version,
    protocolFingerprint: frozen.fingerprint,
    changedFields: [],
  }
}
