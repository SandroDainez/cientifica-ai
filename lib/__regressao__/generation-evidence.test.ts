import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGenerationEvidencePolicy, sanitizeEvidenceMapAgainstCurrentReferences } from '@/lib/research-os/generation-evidence'
import { createEmptyResearchProjectState } from '@/lib/research-os/types'
import type { EvidenceMapResult } from '@/lib/research-os/evidence-engine'

function map(overrides: Partial<EvidenceMapResult> = {}): EvidenceMapResult {
  return {
    claims: [
      { id: 'C1', text: 'A exposição X está associada ao desfecho Y.', importance: 'alta', kind: 'associacao' },
    ],
    links: [
      {
        claimId: 'C1', referenceId: 'R1', supportStatus: 'confirmado', directness: 'direta',
        sourceTier: 'observacional', populationMatch: 'alta', outcomeMatch: 'alta',
        numericSupport: 'nao_aplicavel', rationale: 'Suporte direto.',
      },
    ],
    uncoveredClaims: [],
    warnings: [],
    readiness: 'pronto',
    ...overrides,
  }
}

test('projeto legado não é bloqueado por ausência de Evidence Map', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'introducao',
    researchProjectState: null,
    evidenceMap: null,
  })
  assert.equal(policy.researchOsActive, false)
  assert.equal(policy.decision.allowed, true)
})

test('Research OS bloqueia introdução sem Evidence Map', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'introducao',
    researchProjectState: { schemaVersion: 2 },
    evidenceMap: null,
  })
  assert.equal(policy.researchOsActive, true)
  assert.equal(policy.decision.allowed, false)
  assert.equal(policy.decision.level, 'bloquear')
})

test('Research OS bloqueia metodologia sem SAP pronto', () => {
  const state = createEmptyResearchProjectState('mestrado')
  state.studyDesign = 'coorte_retrospectiva'
  state.question.primaryOutcome = 'mortalidade'
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'metodologia',
    researchProjectState: state,
    evidenceMap: null,
  })
  assert.equal(policy.decision.allowed, false)
  assert.equal(policy.decision.level, 'bloquear')
})

test('Research OS libera metodologia com SAP pronto e injeta guardrail', () => {
  const state = createEmptyResearchProjectState('mestrado')
  state.studyDesign = 'coorte_retrospectiva'
  state.question.primaryOutcome = 'mortalidade'
  state.statisticalPlan.primaryAnalysis = 'Regressão multivariável.'
  state.statisticalPlan.missingDataStrategy = 'Imputação múltipla quando apropriado.'
  state.statisticalPlan.multiplicityStrategy = 'Separar análises confirmatórias e exploratórias.'
  state.readiness.statistics = 'pronto'
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'metodologia',
    researchProjectState: state,
    evidenceMap: null,
  })
  assert.equal(policy.decision.allowed, true)
  assert.match(policy.promptGuardrail, /METHODOLOGY GATE/)
  assert.match(policy.promptGuardrail, /Regressão multivariável/)
})

test('introdução liberada recebe guardrail contendo apenas claims confirmados', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'introducao',
    researchProjectState: { schemaVersion: 2 },
    evidenceMap: map(),
    currentReferenceIds: ['R1'],
  })
  assert.equal(policy.decision.allowed, true)
  assert.match(policy.promptGuardrail, /C1/)
  assert.match(policy.promptGuardrail, /referência_id=R1/)
})

test('referência removida invalida o vínculo e volta a bloquear', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'discussao',
    researchProjectState: { schemaVersion: 2 },
    evidenceMap: map(),
    currentReferenceIds: ['R2'],
  })
  assert.equal(policy.decision.allowed, false)
})

test('sanitização preserva aviso de vínculo obsoleto', () => {
  const sanitized = sanitizeEvidenceMapAgainstCurrentReferences(map(), ['R2'])
  assert.ok(sanitized)
  assert.equal(sanitized!.links.length, 0)
  assert.ok(sanitized!.warnings.some(w => /não existem mais/.test(w)))
})
