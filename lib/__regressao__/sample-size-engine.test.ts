import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSampleSizePlan } from '@/lib/research-os/sample-size-engine'

test('RCT binário calcula n e infla por perdas', () => {
  const plan = buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'binaria',
    binary: { controlRisk: 0.30, interventionRisk: 0.20 },
    alpha: 0.05,
    power: 0.8,
    expectedLossFraction: 0.10,
  })
  assert.ok(plan.baseSampleSize && plan.baseSampleSize > 0)
  assert.ok(plan.adjustedSampleSize && plan.adjustedSampleSize > plan.baseSampleSize!)
  assert.equal(plan.status, 'calculado')
  assert.match(plan.formulaFamily ?? '', /duas proporções/i)
})

test('desfecho contínuo exige DP e diferença clínica', () => {
  const pending = buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'continua',
  })
  assert.equal(pending.status, 'pendente')
  assert.ok(pending.unresolvedQuestions.some(v => /desvio-padrão/i.test(v)))

  const ready = buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'continua',
    continuous: { standardDeviation: 12, clinicallyRelevantDifference: 5 },
  })
  assert.equal(ready.status, 'calculado')
  assert.ok((ready.adjustedSampleSize ?? 0) > 0)
})

test('cluster aplica efeito de desenho', () => {
  const noCluster = buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'binaria',
    binary: { controlRisk: 0.25, interventionRisk: 0.15 },
  })
  const clustered = buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'binaria',
    binary: { controlRisk: 0.25, interventionRisk: 0.15 },
    clustering: { enabled: true, averageClusterSize: 10, icc: 0.05 },
  })
  assert.ok((clustered.adjustedSampleSize ?? 0) > (noCluster.adjustedSampleSize ?? 0))
  assert.ok(clustered.adjustments.some(v => /efeito de desenho/i.test(v)))
})

test('cluster sem ICC não finge cálculo final', () => {
  const plan = buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'binaria',
    binary: { controlRisk: 0.25, interventionRisk: 0.15 },
    clustering: { enabled: true, averageClusterSize: 10 },
  })
  assert.equal(plan.status, 'parcial')
  assert.ok(plan.unresolvedQuestions.some(v => /ICC/i.test(v)))
})

test('transversal de prevalência calcula por precisão absoluta', () => {
  const plan = buildSampleSizePlan({
    design: 'transversal',
    outcomeType: 'binaria',
    prevalence: { expectedProportion: 0.20, absolutePrecision: 0.04 },
  })
  assert.equal(plan.status, 'calculado')
  assert.ok((plan.adjustedSampleSize ?? 0) > 0)
  assert.match(plan.formulaFamily ?? '', /proporção/i)
})

test('modelo preditivo exige parâmetros e fração de eventos', () => {
  const pending = buildSampleSizePlan({
    design: 'modelo_preditivo',
    outcomeType: 'binaria',
  })
  assert.equal(pending.status, 'pendente')

  const ready = buildSampleSizePlan({
    design: 'modelo_preditivo',
    outcomeType: 'binaria',
    prediction: { candidateParameters: 12, expectedEventFraction: 0.20, minimumEventsPerParameter: 20 },
  })
  assert.equal(ready.status, 'calculado')
  assert.ok((ready.adjustedSampleSize ?? 0) >= 1200)
  assert.ok(ready.warnings.some(v => /shrinkage/i.test(v)))
})

test('medidas repetidas registram correlação sem reduzir n automaticamente', () => {
  const plan = buildSampleSizePlan({
    design: 'ensaio_clinico_randomizado',
    outcomeType: 'continua',
    continuous: { standardDeviation: 10, clinicallyRelevantDifference: 4 },
    repeatedMeasures: { enabled: true, withinSubjectCorrelation: 0.6 },
  })
  assert.equal(plan.status, 'calculado')
  assert.ok(plan.warnings.some(v => /não reduz automaticamente/i.test(v)))
})
