import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGenerationEvidencePolicy } from '../research-os/generation-evidence'

const baseState = {
  schemaVersion: 2,
  academicPurpose: 'artigo_independente',
  studyDesign: 'coorte_retrospectiva',
  question: { primaryOutcome: 'mortalidade em 28 dias', secondaryOutcomes: [] },
  regulatory: { involvesHumans: true, involvesAnimals: false, humanDataSource: 'prontuario_retrospectivo' },
  ethicsRoutes: [],
  reportingGuidelines: ['STROBE'],
  statisticalPlan: { covariates: [], confounders: [] },
  evidenceMap: [],
  unresolvedIssues: [],
  readiness: { design: 'pronto', ethics: 'parcial', statistics: 'pronto', evidence: 'pendente', manuscript: 'pendente' },
}

const execution = {
  status: 'congelado', protocolVersion: 1, protocolFingerprint: 'p1', recordedAt: 'x', frozenAt: 'x', fingerprint: 'e1',
  actualSampleSize: 180, sensitivityAnalyses: [], deviations: [],
}

const registry = {
  status: 'congelado', executionFingerprint: 'e1', executionProtocolVersion: 1, recordedAt: 'x', frozenAt: 'x', fingerprint: 'r1',
  facts: [{ id: 'R1', kind: 'primario', text: 'A mortalidade foi 18% entre 180 pacientes.', numericTokens: ['18%', '180'] }],
}

test('bloqueia Resultados sem Execution Lock', () => {
  const policy = buildGenerationEvidencePolicy({ sectionKey: 'resultados', researchProjectState: baseState, evidenceMap: null })
  assert.equal(policy.decision.allowed, false)
})

test('bloqueia Resultados sem fatos aprovados', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'resultados',
    researchProjectState: { ...baseState, _execution_analysis: execution },
    evidenceMap: null,
  })
  assert.equal(policy.decision.allowed, false)
})

test('libera Resultados com execução e fatos congelados compatíveis', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'resultados',
    researchProjectState: { ...baseState, _execution_analysis: execution, _result_fact_registry: registry },
    evidenceMap: null,
  })
  assert.equal(policy.decision.allowed, true)
  assert.match(policy.promptGuardrail, /18%/)
})

test('bloqueia fatos aprovados em outra execução', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'resultados',
    researchProjectState: { ...baseState, _execution_analysis: execution, _result_fact_registry: { ...registry, executionFingerprint: 'outro' } },
    evidenceMap: null,
  })
  assert.equal(policy.decision.allowed, false)
})
