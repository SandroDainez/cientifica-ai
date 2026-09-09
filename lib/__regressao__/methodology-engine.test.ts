import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMethodologyPlan } from '@/lib/research-os/methodology-engine'

test('coorte retrospectiva binária propõe análise ajustada e não causal', () => {
  const plan = buildMethodologyPlan({
    design: 'coorte_retrospectiva',
    primaryOutcome: { name: 'lesao renal aguda', type: 'binaria' },
    expectedConfounders: ['idade', 'sepse'],
  })
  assert.equal(plan.readiness, 'pronto')
  assert.match(plan.primaryAnalysis ?? '', /Regressão multivariável/i)
  assert.match(plan.adjustmentStrategy ?? '', /confundidores/i)
  assert.ok(plan.prohibitedShortcuts.some(v => /causalidade/i.test(v)))
})

test('RCT contínuo exige ITT e randomização', () => {
  const plan = buildMethodologyPlan({
    design: 'ensaio_clinico_randomizado',
    primaryOutcome: { name: 'tempo de ventilação', type: 'continua' },
  })
  assert.equal(plan.readiness, 'pronto')
  assert.ok(plan.requiredElements.some(v => /randomização/i.test(v)))
  assert.ok(plan.requiredElements.some(v => /intenção de tratar/i.test(v)))
  assert.match(plan.primaryAnalysis ?? '', /Modelo linear/i)
})

test('modelo preditivo não aceita apenas AUC e alerta overfitting', () => {
  const plan = buildMethodologyPlan({
    design: 'modelo_preditivo',
    primaryOutcome: { name: 'mortalidade', type: 'binaria' },
  })
  assert.ok(plan.requiredElements.some(v => /calibração/i.test(v)))
  assert.ok(plan.prohibitedShortcuts.some(v => /p-valor univariado/i.test(v)))
  assert.ok(plan.sampleSizeRequirements.some(v => /overfitting/i.test(v)))
})

test('medidas repetidas exigem correlação intraindivíduo', () => {
  const plan = buildMethodologyPlan({
    design: 'coorte_prospectiva',
    primaryOutcome: { name: 'pressao arterial', type: 'continua' },
    repeatedMeasures: true,
  })
  assert.ok(plan.requiredElements.some(v => /modelo misto|GEE/i.test(v)))
  assert.ok(plan.assumptionsToVerify.some(v => /intraindivíduo/i.test(v)))
})

test('cluster altera análise e tamanho amostral', () => {
  const plan = buildMethodologyPlan({
    design: 'ensaio_clinico_randomizado',
    primaryOutcome: { name: 'mortalidade', type: 'binaria' },
    clustering: true,
  })
  assert.ok(plan.requiredElements.some(v => /cluster/i.test(v)))
  assert.ok(plan.sampleSizeRequirements.some(v => /efeito de desenho/i.test(v)))
  assert.ok(plan.assumptionsToVerify.some(v => /ICC/i.test(v)))
})

test('desfecho não definido mantém plano pendente', () => {
  const plan = buildMethodologyPlan({ design: 'coorte_retrospectiva' })
  assert.equal(plan.readiness, 'pendente')
  assert.ok(plan.unresolvedQuestions.length >= 2)
})

test('múltiplos primários exigem plano de multiplicidade', () => {
  const plan = buildMethodologyPlan({
    design: 'ensaio_clinico_randomizado',
    primaryOutcome: { name: 'composto primário', type: 'binaria' },
    multiplePrimaryOutcomes: true,
  })
  assert.match(plan.multiplicityStrategy ?? '', /erro tipo I/i)
  assert.ok(plan.requiredElements.some(v => /multiplicidade/i.test(v)))
})
