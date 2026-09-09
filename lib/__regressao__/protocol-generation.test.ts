import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMethodologyPlan } from '@/lib/research-os/methodology-engine'
import { freezeProtocol } from '@/lib/research-os/protocol-lock'
import { buildProtocolGroundedMethodsPolicy } from '@/lib/research-os/protocol-generation'
import { createEmptyResearchProjectState } from '@/lib/research-os/types'

function fixture() {
  const state = createEmptyResearchProjectState('mestrado')
  state.studyDesign = 'coorte_retrospectiva'
  state.question.population = 'Adultos internados em UTI'
  state.question.primaryOutcome = 'mortalidade em 28 dias'
  state.statisticalPlan.primaryAnalysis = 'Regressão logística multivariável.'
  state.statisticalPlan.missingDataStrategy = 'Quantificar missing e considerar imputação múltipla.'
  state.statisticalPlan.multiplicityStrategy = 'Separar análises confirmatórias e exploratórias.'
  state.statisticalPlan.confounders = ['idade', 'gravidade']
  state.readiness.statistics = 'pronto'

  const methodology = buildMethodologyPlan({
    design: state.studyDesign,
    primaryOutcome: { name: state.question.primaryOutcome, type: 'binaria' },
    expectedConfounders: state.statisticalPlan.confounders,
    expectedMissingData: true,
  })
  assert.equal(methodology.readiness, 'pronto')

  const protocolLock = freezeProtocol({ state, methodology, sampleSize: null, now: '2026-09-09T12:00:00.000Z' })
  return { state, methodology, protocolLock }
}

test('Methods usa snapshot congelado quando projeto não divergiu', () => {
  const { state, methodology, protocolLock } = fixture()
  const policy = buildProtocolGroundedMethodsPolicy({ state, methodology, sampleSize: null, protocolLock })
  assert.equal(policy.allowed, true)
  assert.equal(policy.changedFields.length, 0)
  assert.match(policy.promptGuardrail, /PROTOCOL LOCK/)
  assert.match(policy.promptGuardrail, /mortalidade em 28 dias/)
  assert.match(policy.promptGuardrail, /idade \| gravidade/)
  assert.match(policy.promptGuardrail, new RegExp(`v${protocolLock.snapshot.version}`))
})

test('mudança do desfecho após lock bloqueia Methods', () => {
  const { state, methodology, protocolLock } = fixture()
  state.question.primaryOutcome = 'mortalidade em 90 dias'
  const policy = buildProtocolGroundedMethodsPolicy({ state, methodology, sampleSize: null, protocolLock })
  assert.equal(policy.allowed, false)
  assert.ok(policy.changedFields.includes('primaryOutcome'))
  assert.ok(policy.reasons.some(reason => /amendment/i.test(reason)))
})

test('mudança da análise primária após lock bloqueia Methods', () => {
  const { state, methodology, protocolLock } = fixture()
  state.statisticalPlan.primaryAnalysis = 'Modelo de Cox.'
  const policy = buildProtocolGroundedMethodsPolicy({ state, methodology, sampleSize: null, protocolLock })
  assert.equal(policy.allowed, false)
  assert.ok(policy.changedFields.includes('primaryAnalysis'))
})

test('mudança de confundidores após lock bloqueia Methods', () => {
  const { state, methodology, protocolLock } = fixture()
  state.statisticalPlan.confounders = ['idade', 'gravidade', 'sepse']
  const policy = buildProtocolGroundedMethodsPolicy({ state, methodology, sampleSize: null, protocolLock })
  assert.equal(policy.allowed, false)
  assert.ok(policy.changedFields.includes('confounders'))
})
