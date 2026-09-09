import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMethodologyPlan } from '@/lib/research-os/methodology-engine'
import { buildSampleSizePlan } from '@/lib/research-os/sample-size-engine'
import {
  buildProtocolSnapshot,
  compareProtocolSnapshots,
  evaluateProtocolReadiness,
  freezeProtocol,
} from '@/lib/research-os/protocol-lock'
import { createEmptyResearchProjectState } from '@/lib/research-os/types'

function readyState(design: 'ensaio_clinico_randomizado' | 'coorte_retrospectiva' = 'ensaio_clinico_randomizado') {
  const state = createEmptyResearchProjectState('doutorado')
  state.studyDesign = design
  state.question.primaryOutcome = 'mortalidade em 28 dias'
  state.statisticalPlan.primaryAnalysis = 'Regressão multivariável.'
  state.statisticalPlan.missingDataStrategy = 'Imputação múltipla quando apropriado.'
  state.statisticalPlan.multiplicityStrategy = 'Pré-especificada.'
  state.readiness.statistics = 'pronto'
  return state
}

function readyMethodology(design: 'ensaio_clinico_randomizado' | 'coorte_retrospectiva' = 'ensaio_clinico_randomizado') {
  return buildMethodologyPlan({
    design,
    primaryOutcome: { name: 'mortalidade em 28 dias', type: 'binaria' },
  })
}

function readySample() {
  return buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'binaria',
    binary: { controlRisk: 0.3, interventionRisk: 0.2 },
  })
}

test('bloqueia protocolo sem desenho e desfecho', () => {
  const state = createEmptyResearchProjectState('mestrado')
  const result = evaluateProtocolReadiness({ state, methodology: null, sampleSize: null })
  assert.equal(result.canFreeze, false)
  assert.equal(result.status, 'bloqueado')
  assert.ok(result.blockers.some(v => /desenho/i.test(v)))
  assert.ok(result.blockers.some(v => /desfecho primário/i.test(v)))
})

test('RCT exige cálculo amostral concluído', () => {
  const state = readyState('ensaio_clinico_randomizado')
  const methodology = readyMethodology('ensaio_clinico_randomizado')
  const result = evaluateProtocolReadiness({ state, methodology, sampleSize: null })
  assert.equal(result.canFreeze, false)
  assert.ok(result.blockers.some(v => /planejamento amostral/i.test(v)))
})

test('retrospectiva permite lock sem cálculo numérico, com warning', () => {
  const state = readyState('coorte_retrospectiva')
  const methodology = readyMethodology('coorte_retrospectiva')
  const result = evaluateProtocolReadiness({ state, methodology, sampleSize: null })
  assert.equal(result.canFreeze, true)
  assert.equal(result.status, 'pronto_para_congelar')
  assert.ok(result.warnings.some(v => /tamanho amostral/i.test(v)))
})

test('freeze cria protocolo versão 1 com fingerprint', () => {
  const state = readyState()
  const methodology = readyMethodology()
  const sampleSize = readySample()
  state.statisticalPlan.sampleSize = sampleSize.adjustedSampleSize ?? undefined
  const lock = freezeProtocol({ state, methodology, sampleSize, now: '2026-09-09T12:00:00.000Z' })
  assert.equal(lock.snapshot.version, 1)
  assert.equal(lock.snapshot.frozenAt, '2026-09-09T12:00:00.000Z')
  assert.match(lock.snapshot.fingerprint, /^[0-9a-f]{16}$/)
  assert.equal(lock.amendments.length, 0)
})

test('snapshot idêntico gera fingerprint estável', () => {
  const state = readyState()
  const methodology = readyMethodology()
  const sampleSize = readySample()
  const a = buildProtocolSnapshot({ state, methodology, sampleSize, frozenAt: 'A' })
  const b = buildProtocolSnapshot({ state, methodology, sampleSize, frozenAt: 'B' })
  assert.equal(a.fingerprint, b.fingerprint)
})

test('alteração de desfecho após lock é detectada', () => {
  const state = readyState()
  const methodology = readyMethodology()
  const sampleSize = readySample()
  const lock = freezeProtocol({ state, methodology, sampleSize })
  state.question.primaryOutcome = 'mortalidade em 90 dias'
  const current = buildProtocolSnapshot({ state, methodology, sampleSize })
  const changes = compareProtocolSnapshots(lock.snapshot, current)
  assert.ok(changes.some(change => change.field === 'primaryOutcome'))
  const readiness = evaluateProtocolReadiness({ state, methodology, sampleSize, existingLock: lock })
  assert.equal(readiness.status, 'alterado_apos_congelamento')
})

test('amendment sem justificativa é rejeitado', () => {
  const state = readyState()
  const methodology = readyMethodology()
  const sampleSize = readySample()
  const lock = freezeProtocol({ state, methodology, sampleSize })
  state.statisticalPlan.primaryAnalysis = 'Modelo de Cox.'
  assert.throws(() => freezeProtocol({ state, methodology, sampleSize, existingLock: lock }), /justificativa/i)
})

test('amendment cria nova versão e trilha auditável', () => {
  const state = readyState()
  const methodology = readyMethodology()
  const sampleSize = readySample()
  const lock = freezeProtocol({ state, methodology, sampleSize, now: '2026-09-09T12:00:00.000Z' })
  state.question.primaryOutcome = 'mortalidade em 90 dias'
  const amended = freezeProtocol({
    state,
    methodology,
    sampleSize,
    existingLock: lock,
    amendmentReason: 'Mudança aprovada antes do recrutamento por revisão do protocolo.',
    now: '2026-09-10T12:00:00.000Z',
  })
  assert.equal(amended.snapshot.version, 2)
  assert.equal(amended.amendments.length, 1)
  assert.equal(amended.amendments[0].fromVersion, 1)
  assert.equal(amended.amendments[0].toVersion, 2)
  assert.ok(amended.amendments[0].changes.some(v => v.field === 'primaryOutcome'))
})
