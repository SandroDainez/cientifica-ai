import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGenerationEvidencePolicy } from '@/lib/research-os/generation-evidence'
import { buildMethodologyPlan } from '@/lib/research-os/methodology-engine'
import { freezeProtocol } from '@/lib/research-os/protocol-lock'
import { createEmptyResearchProjectState } from '@/lib/research-os/types'

test('geração real de Métodos usa Protocol Lock espelhado no project_state', () => {
  const state = createEmptyResearchProjectState('doutorado')
  state.studyDesign = 'coorte_retrospectiva'
  state.question.primaryOutcome = 'mortalidade em 28 dias'
  state.statisticalPlan.primaryAnalysis = 'Regressão logística multivariável.'
  state.statisticalPlan.missingDataStrategy = 'Quantificar missing e considerar imputação múltipla.'
  state.statisticalPlan.multiplicityStrategy = 'Separar confirmatório de exploratório.'
  state.readiness.statistics = 'pronto'

  const methodology = buildMethodologyPlan({
    design: state.studyDesign,
    primaryOutcome: { name: state.question.primaryOutcome, type: 'binaria' },
    expectedMissingData: true,
  })
  const lock = freezeProtocol({ state, methodology, sampleSize: null, now: '2026-09-09T12:00:00.000Z' })
  const mirroredState = { ...state, _protocol_lock: lock }

  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'metodologia',
    researchProjectState: mirroredState,
    evidenceMap: null,
  })

  assert.equal(policy.decision.allowed, true)
  assert.match(policy.promptGuardrail, /PROTOCOL LOCK/)
  assert.match(policy.promptGuardrail, /mortalidade em 28 dias/)
})

test('geração real de Métodos bloqueia divergência após congelamento', () => {
  const state = createEmptyResearchProjectState('mestrado')
  state.studyDesign = 'coorte_retrospectiva'
  state.question.primaryOutcome = 'mortalidade em 28 dias'
  state.statisticalPlan.primaryAnalysis = 'Regressão logística multivariável.'
  state.statisticalPlan.missingDataStrategy = 'Quantificar missing.'
  state.statisticalPlan.multiplicityStrategy = 'Separar confirmatório de exploratório.'
  state.readiness.statistics = 'pronto'

  const methodology = buildMethodologyPlan({
    design: state.studyDesign,
    primaryOutcome: { name: state.question.primaryOutcome, type: 'binaria' },
  })
  const lock = freezeProtocol({ state, methodology, sampleSize: null, now: '2026-09-09T12:00:00.000Z' })
  const mirroredState = { ...state, _protocol_lock: lock }
  mirroredState.question = { ...mirroredState.question, primaryOutcome: 'mortalidade em 90 dias' }

  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'metodologia',
    researchProjectState: mirroredState,
    evidenceMap: null,
  })

  assert.equal(policy.decision.allowed, false)
  assert.ok(policy.decision.reasons.some(reason => /amendment/i.test(reason)))
})
