import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClaimLedger } from '../research-os/claim-ledger'
import { evaluateSubmissionReadiness } from '../research-os/submission-readiness'
import { createEmptyResearchProjectState } from '../research-os/types'
import type { ProtocolLockRecord } from '../research-os/protocol-lock'
import type { ExecutionAnalysisRecord } from '../research-os/execution-analysis-lock'
import type { ResultFactRegistry } from '../research-os/result-fact-lock'
import type { EvidenceMapResult } from '../research-os/evidence-engine'

function fixtures() {
  const state = createEmptyResearchProjectState('mestrado') as ReturnType<typeof createEmptyResearchProjectState> & Record<string, unknown>
  state.studyDesign = 'coorte_retrospectiva'
  state.question.primaryOutcome = 'mortalidade em 28 dias'
  state.readiness.design = 'pronto'
  state.readiness.statistics = 'pronto'
  state.regulatory = { involvesHumans: true, involvesAnimals: false, humanDataSource: 'prontuario_retrospectivo' }
  state.ethicsRoutes = ['cep_conep_plataforma_brasil']
  state.reportingGuidelines = ['STROBE']

  const protocol: ProtocolLockRecord = {
    status: 'congelado',
    amendments: [],
    snapshot: {
      version: 1, frozenAt: '2026-09-09T00:00:00.000Z', fingerprint: 'p1', design: 'coorte_retrospectiva',
      question: { primaryOutcome: 'mortalidade em 28 dias', secondaryOutcomes: [] },
      statistics: { covariates: [], confounders: [] }, methodology: null, sampleSize: null,
      ethicsRoutes: ['cep_conep_plataforma_brasil'], reportingGuidelines: ['STROBE'],
    },
  }
  const execution: ExecutionAnalysisRecord = {
    status: 'congelado', protocolVersion: 1, protocolFingerprint: 'p1', recordedAt: '2026-09-09T00:00:00.000Z',
    frozenAt: '2026-09-09T00:00:00.000Z', fingerprint: 'e1', actualSampleSize: 100,
    primaryOutcomeAnalyzed: 'mortalidade em 28 dias', primaryAnalysisPerformed: 'regressão logística',
    missingDataHandling: 'casos completos', sensitivityAnalyses: [], deviations: [],
  }
  const facts: ResultFactRegistry = {
    status: 'congelado', executionFingerprint: 'e1', executionProtocolVersion: 1,
    recordedAt: '2026-09-09T00:00:00.000Z', frozenAt: '2026-09-09T00:00:00.000Z', fingerprint: 'r1',
    facts: [{ id: 'R1', kind: 'primario', provenance: 'pre_especificado', text: 'A mortalidade em 28 dias foi 18%.', numericTokens: ['28', '18%'] }],
  }
  state._result_fact_registry = facts
  const evidence: EvidenceMapResult = {
    claims: [{ id: 'C1', text: 'A exposição X está associada à mortalidade.', importance: 'alta', kind: 'associacao' }],
    links: [{ claimId: 'C1', referenceId: 'REF1', supportStatus: 'confirmado', directness: 'direta', sourceTier: 'observacional', populationMatch: 'alta', outcomeMatch: 'alta', numericSupport: 'nao_aplicavel', rationale: 'Suporte direto.' }],
    uncoveredClaims: [], warnings: [], readiness: 'pronto',
  }
  const ledger = buildClaimLedger({
    sections: [
      { sectionKey: 'discussao', sectionName: 'Discussão', text: 'A mortalidade em 28 dias foi 18%.' },
      { sectionKey: 'conclusao', sectionName: 'Conclusão', text: 'A mortalidade em 28 dias foi 18%.' },
    ],
    researchProjectState: state,
    evidenceMap: evidence,
  })
  return { state, protocol, execution, facts, evidence, ledger }
}

test('bloqueia quando não há estado científico', () => {
  const result = evaluateSubmissionReadiness({ state: null, protocolLock: null, executionAnalysis: null, resultFactRegistry: null, evidenceMap: null, claimLedger: buildClaimLedger({ sections: [], researchProjectState: null, evidenceMap: null }), referenceCount: 0, manuscriptSectionsPresent: [] })
  assert.equal(result.status, 'bloqueado')
})

test('projeto íntegro mas com ética real não verificada exige revisão humana', () => {
  const f = fixtures()
  const result = evaluateSubmissionReadiness({ ...f, protocolLock: f.protocol, executionAnalysis: f.execution, resultFactRegistry: f.facts, evidenceMap: f.evidence, claimLedger: f.ledger, referenceCount: 12, manuscriptSectionsPresent: ['discussao', 'conclusao'] })
  assert.equal(result.status, 'revisao_humana')
  assert.equal(result.readyForSubmission, false)
  assert(result.humanReview.some(item => /prova documental/i.test(item)))
})

test('fica pronto quando rota ética aplicável possui verificação registrada', () => {
  const f = fixtures()
  const result = evaluateSubmissionReadiness({ ...f, protocolLock: f.protocol, executionAnalysis: f.execution, resultFactRegistry: f.facts, evidenceMap: f.evidence, claimLedger: f.ledger, referenceCount: 12, manuscriptSectionsPresent: ['discussao', 'conclusao'], ethicsVerifiedRoutes: ['cep_conep_plataforma_brasil'] })
  assert.equal(result.status, 'pronto')
  assert.equal(result.readyForSubmission, true)
})

test('claim ledger com violação impede submissão', () => {
  const f = fixtures()
  const badLedger = { ...f.ledger, ready: false, unsupported: 1, violations: 1 }
  const result = evaluateSubmissionReadiness({ ...f, protocolLock: f.protocol, executionAnalysis: f.execution, resultFactRegistry: f.facts, evidenceMap: f.evidence, claimLedger: badLedger, referenceCount: 12, manuscriptSectionsPresent: ['discussao', 'conclusao'], ethicsVerifiedRoutes: ['cep_conep_plataforma_brasil'] })
  assert.equal(result.status, 'bloqueado')
})

test('Result Fact Lock de outra execução bloqueia submissão', () => {
  const f = fixtures()
  const wrongFacts = { ...f.facts, executionFingerprint: 'outra' }
  const result = evaluateSubmissionReadiness({ ...f, protocolLock: f.protocol, executionAnalysis: f.execution, resultFactRegistry: wrongFacts, evidenceMap: f.evidence, claimLedger: f.ledger, referenceCount: 12, manuscriptSectionsPresent: ['discussao', 'conclusao'], ethicsVerifiedRoutes: ['cep_conep_plataforma_brasil'] })
  assert.equal(result.status, 'bloqueado')
  assert(result.blockers.some(item => /execução vigente/i.test(item)))
})

test('guideline ausente não finge prontidão total e exige revisão humana', () => {
  const f = fixtures()
  f.state.reportingGuidelines = []
  const result = evaluateSubmissionReadiness({ ...f, protocolLock: f.protocol, executionAnalysis: f.execution, resultFactRegistry: f.facts, evidenceMap: f.evidence, claimLedger: f.ledger, referenceCount: 12, manuscriptSectionsPresent: ['discussao', 'conclusao'], ethicsVerifiedRoutes: ['cep_conep_plataforma_brasil'] })
  assert.equal(result.status, 'revisao_humana')
})
