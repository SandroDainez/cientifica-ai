import type { ClaimLedgerSummary } from './claim-ledger'
import type { EvidenceMapResult } from './evidence-engine'
import { routeEthics } from './ethics-router'
import type { ExecutionAnalysisRecord } from './execution-analysis-lock'
import type { ProtocolLockRecord } from './protocol-lock'
import type { ResultFactRegistry } from './result-fact-lock'
import type { ResearchProjectState } from './types'

export type SubmissionCheckStatus = 'ok' | 'revisao' | 'bloqueado'

export interface SubmissionReadinessCheck {
  id: string
  label: string
  status: SubmissionCheckStatus
  detail: string
}

export interface SubmissionReadinessResult {
  status: 'bloqueado' | 'revisao_humana' | 'pronto'
  readyForSubmission: boolean
  checks: SubmissionReadinessCheck[]
  blockers: string[]
  humanReview: string[]
  passed: number
  total: number
}

const ETHICS_ROUTES_REQUIRING_REAL_WORLD_VERIFICATION = new Set([
  'cep_conep_plataforma_brasil',
  'ceua_concea',
  'registro_ensaio_clinico',
  'consentimento_publicacao_caso',
])

function check(id: string, label: string, status: SubmissionCheckStatus, detail: string): SubmissionReadinessCheck {
  return { id, label, status, detail }
}

function asFrozenProtocol(value: ProtocolLockRecord | null | undefined): ProtocolLockRecord | null {
  return value?.status === 'congelado' ? value : null
}

function asFrozenExecution(value: ExecutionAnalysisRecord | null | undefined): ExecutionAnalysisRecord | null {
  return value?.status === 'congelado' ? value : null
}

function asFrozenFacts(value: ResultFactRegistry | null | undefined): ResultFactRegistry | null {
  return value?.status === 'congelado' ? value : null
}

export function evaluateSubmissionReadiness(params: {
  state: ResearchProjectState | null | undefined
  protocolLock: ProtocolLockRecord | null | undefined
  executionAnalysis: ExecutionAnalysisRecord | null | undefined
  resultFactRegistry: ResultFactRegistry | null | undefined
  evidenceMap: EvidenceMapResult | null | undefined
  claimLedger: ClaimLedgerSummary
  referenceCount: number
  manuscriptSectionsPresent: string[]
  ethicsVerifiedRoutes?: string[]
}): SubmissionReadinessResult {
  const checks: SubmissionReadinessCheck[] = []
  const state = params.state

  if (!state) {
    checks.push(check('research_state', 'Estado científico', 'bloqueado', 'ResearchProjectState ausente.'))
    return finalize(checks)
  }

  checks.push(check(
    'question_design',
    'Pergunta e desenho',
    state.studyDesign !== 'indefinido' && Boolean(state.question.primaryOutcome?.trim()) && state.readiness.design === 'pronto' ? 'ok' : 'bloqueado',
    state.studyDesign !== 'indefinido' && state.question.primaryOutcome?.trim()
      ? `Desenho ${state.studyDesign}; desfecho primário definido.`
      : 'Defina desenho científico e desfecho primário antes da submissão.',
  ))

  checks.push(check(
    'statistics',
    'Plano estatístico',
    state.readiness.statistics === 'pronto' ? 'ok' : 'bloqueado',
    state.readiness.statistics === 'pronto' ? 'Plano estatístico marcado como pronto.' : 'O plano estatístico ainda não está pronto.',
  ))

  const protocol = asFrozenProtocol(params.protocolLock)
  checks.push(check(
    'protocol_lock',
    'Protocol Lock',
    protocol ? 'ok' : 'bloqueado',
    protocol ? `Protocolo v${protocol.snapshot.version} congelado.` : 'Congele o protocolo antes da submissão.',
  ))

  const execution = asFrozenExecution(params.executionAnalysis)
  checks.push(check(
    'execution_lock',
    'Execution / Analysis Lock',
    execution ? 'ok' : 'bloqueado',
    execution ? 'Execução/análise congelada e rastreável.' : 'Congele o registro de execução/análise antes da submissão.',
  ))

  const facts = asFrozenFacts(params.resultFactRegistry)
  const factsCompatible = Boolean(execution && facts && facts.executionFingerprint === execution.fingerprint)
  checks.push(check(
    'result_facts',
    'Result Fact Lock',
    factsCompatible ? 'ok' : 'bloqueado',
    factsCompatible ? `${facts!.facts.length} fatos aprovados ligados à execução vigente.` : 'Congele fatos de resultado compatíveis com a execução vigente.',
  ))

  const evidenceReady = params.evidenceMap?.readiness === 'pronto' && params.evidenceMap.uncoveredClaims.length === 0
  checks.push(check(
    'evidence_map',
    'Evidence Map',
    evidenceReady ? 'ok' : 'bloqueado',
    evidenceReady ? 'Claims centrais possuem cobertura de evidência auditada.' : 'O Evidence Map ainda tem pendências ou claims descobertos.',
  ))

  checks.push(check(
    'claim_ledger',
    'Claim Ledger',
    params.claimLedger.ready ? 'ok' : 'bloqueado',
    params.claimLedger.ready
      ? `${params.claimLedger.totalClaims} claims materiais com provenance íntegra.`
      : 'Discussão/Conclusão ainda têm claims sem suporte, violações ou nenhuma trilha auditável.',
  ))

  const guidelineMapped = state.reportingGuidelines.length > 0 && !state.reportingGuidelines.includes('nenhuma_mapeada')
  checks.push(check(
    'reporting_guideline',
    'Guideline de relato',
    guidelineMapped ? 'ok' : 'revisao',
    guidelineMapped ? `Guideline(s): ${state.reportingGuidelines.join(', ')}.` : 'Nenhuma guideline de relato específica está confirmada; revisar manualmente antes da submissão.',
  ))

  const ethicsDecision = routeEthics(state.regulatory, state.studyDesign)
  const ethicsRoutesAligned = ethicsDecision.blockers.length === 0
    && ethicsDecision.routes.every(route => state.ethicsRoutes.includes(route))
  if (!ethicsRoutesAligned) {
    checks.push(check('ethics', 'Ética e regulação', 'bloqueado', [...ethicsDecision.blockers, 'A rota ética/regulatória do projeto precisa ser reconciliada.'].join(' ')))
  } else {
    const verified = new Set(params.ethicsVerifiedRoutes ?? [])
    const routesNeedingProof = ethicsDecision.routes.filter(route => ETHICS_ROUTES_REQUIRING_REAL_WORLD_VERIFICATION.has(route))
    const missingProof = routesNeedingProof.filter(route => !verified.has(route))
    checks.push(check(
      'ethics',
      'Ética e regulação',
      missingProof.length ? 'revisao' : 'ok',
      missingProof.length
        ? `Rota regulatória coerente, mas o sistema não possui prova documental verificada para: ${missingProof.join(', ')}. Não afirmar aprovação até anexar/registrar evidência real.`
        : `Rota regulatória coerente: ${ethicsDecision.routes.join(', ')}.`,
    ))
  }

  checks.push(check(
    'references',
    'Referências',
    params.referenceCount > 0 ? 'ok' : 'bloqueado',
    params.referenceCount > 0 ? `${params.referenceCount} referências cadastradas.` : 'Nenhuma referência cadastrada.',
  ))

  const sectionKeys = new Set(params.manuscriptSectionsPresent)
  const hasDiscussion = sectionKeys.has('discussao') || sectionKeys.has('discussao_grade')
  const hasConclusion = sectionKeys.has('conclusao') || sectionKeys.has('consideracoes_finais')
  checks.push(check(
    'manuscript_sections',
    'Manuscrito mínimo',
    hasDiscussion && hasConclusion ? 'ok' : 'bloqueado',
    hasDiscussion && hasConclusion ? 'Discussão e Conclusão presentes.' : 'Discussão e Conclusão precisam estar presentes antes da submissão.',
  ))

  return finalize(checks)
}

function finalize(checks: SubmissionReadinessCheck[]): SubmissionReadinessResult {
  const blockers = checks.filter(item => item.status === 'bloqueado').map(item => item.detail)
  const humanReview = checks.filter(item => item.status === 'revisao').map(item => item.detail)
  const status: SubmissionReadinessResult['status'] = blockers.length
    ? 'bloqueado'
    : humanReview.length
      ? 'revisao_humana'
      : 'pronto'
  return {
    status,
    readyForSubmission: status === 'pronto',
    checks,
    blockers,
    humanReview,
    passed: checks.filter(item => item.status === 'ok').length,
    total: checks.length,
  }
}
