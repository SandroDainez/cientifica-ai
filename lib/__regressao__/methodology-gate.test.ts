import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMethodologyGate } from '@/lib/research-os/methodology-gate'
import { createEmptyResearchProjectState } from '@/lib/research-os/types'

test('seção fora de Métodos não é bloqueada', () => {
  const state = createEmptyResearchProjectState('tcc')
  const decision = evaluateMethodologyGate('introducao', state)
  assert.equal(decision.allowed, true)
})

test('projeto legado sem estado não é bloqueado', () => {
  const decision = evaluateMethodologyGate('metodologia', null)
  assert.equal(decision.allowed, true)
})

test('Research OS bloqueia Métodos quando desenho está indefinido', () => {
  const state = createEmptyResearchProjectState('mestrado')
  const decision = evaluateMethodologyGate('metodologia', state)
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasons.some(v => /desenho científico/i.test(v)))
})

test('Research OS bloqueia Métodos sem análise primária', () => {
  const state = createEmptyResearchProjectState('mestrado')
  state.studyDesign = 'coorte_retrospectiva'
  state.question.primaryOutcome = 'mortalidade em 28 dias'
  state.statisticalPlan.missingDataStrategy = 'Quantificar e tratar conforme mecanismo.'
  state.readiness.statistics = 'parcial'
  const decision = evaluateMethodologyGate('metodologia', state)
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasons.some(v => /análise estatística primária/i.test(v)))
})

test('Research OS libera Métodos quando SAP está pronto', () => {
  const state = createEmptyResearchProjectState('doutorado')
  state.studyDesign = 'coorte_retrospectiva'
  state.question.primaryOutcome = 'lesão renal aguda'
  state.statisticalPlan.primaryAnalysis = 'Regressão multivariável.'
  state.statisticalPlan.missingDataStrategy = 'Imputação múltipla quando apropriado.'
  state.readiness.statistics = 'pronto'
  const decision = evaluateMethodologyGate('metodologia', state)
  assert.equal(decision.allowed, true)
})
