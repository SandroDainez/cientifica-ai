import test from 'node:test'
import assert from 'node:assert/strict'
import { runScientificIntake } from '@/lib/research-os/intake-engine'

test('intake: TCC nao determina desenho nem seres humanos sozinho', () => {
  const result = runScientificIntake({
    description: 'Quero fazer meu TCC sobre segurança do paciente.',
    academicPurpose: 'tcc',
    facts: {},
  })
  assert.equal(result.state.academicPurpose, 'tcc')
  assert.equal(result.state.studyDesign, 'indefinido')
  assert.equal(result.state.regulatory.involvesHumans, false)
  assert.ok(result.questions.some(q => q.id === 'participants'))
})

test('intake: prontuarios historicos com humanos classificam coorte retrospectiva e rota CEP', () => {
  const result = runScientificIntake({
    description: 'Tenho 800 prontuarios antigos de pacientes de UTI e quero avaliar associacao entre exposicao e lesao renal.',
    academicPurpose: 'artigo_independente',
    facts: {
      historicalDataOnly: true,
      quantitativeData: true,
      involvesHumans: true,
      humanDataSource: 'prontuario_retrospectivo',
    },
  })
  assert.equal(result.state.studyDesign, 'coorte_retrospectiva')
  assert.ok(result.state.reportingGuidelines.includes('STROBE'))
  assert.ok(result.state.ethicsRoutes.includes('cep_conep_plataforma_brasil'))
})

test('intake: ensaio randomizado exige intervencao, humanos, SPIRIT e CONSORT', () => {
  const result = runScientificIntake({
    description: 'Vamos randomizar pacientes para duas tecnicas anestesicas e comparar delirium.',
    academicPurpose: 'doutorado',
    facts: {
      investigatorAssignsIntervention: true,
      randomized: true,
      quantitativeData: true,
      involvesHumans: true,
      humanDataSource: 'intervencao_prospectiva',
    },
  })
  assert.equal(result.state.studyDesign, 'ensaio_clinico_randomizado')
  assert.ok(result.state.reportingGuidelines.includes('SPIRIT'))
  assert.ok(result.state.reportingGuidelines.includes('CONSORT'))
  assert.ok(result.state.ethicsRoutes.includes('cep_conep_plataforma_brasil'))
  assert.ok(result.state.ethicsRoutes.includes('registro_ensaio_clinico'))
})

test('intake: experimento animal nunca cai em CEP por padrao', () => {
  const result = runScientificIntake({
    description: 'Experimento controlado em ratos para avaliar resposta inflamatoria.',
    academicPurpose: 'mestrado',
    facts: { animalExperiment: true, involvesAnimals: true },
  })
  assert.equal(result.state.studyDesign, 'experimental_animal')
  assert.ok(result.state.reportingGuidelines.includes('ARRIVE'))
  assert.ok(result.state.ethicsRoutes.includes('ceua_concea'))
  assert.ok(!result.state.ethicsRoutes.includes('cep_conep_plataforma_brasil'))
})

test('intake: revisao sistematica nao recebe rota CEP', () => {
  const result = runScientificIntake({
    description: 'Revisao sistematica sobre HFNO apos extubacao.',
    academicPurpose: 'mestrado',
    facts: { literatureOnly: true, systematicSearch: true },
  })
  assert.equal(result.state.studyDesign, 'revisao_sistematica')
  assert.ok(result.state.reportingGuidelines.includes('PRISMA'))
  assert.ok(result.state.ethicsRoutes.includes('sem_fluxo_etico_especifico'))
})

test('intake: ideia insuficiente gera perguntas antes de metodologia', () => {
  const result = runScientificIntake({
    description: 'Quero pesquisar delirium em idosos.',
    academicPurpose: 'mestrado',
    facts: { involvesHumans: true },
  })
  assert.equal(result.state.studyDesign, 'indefinido')
  assert.ok(result.questions.some(q => q.id === 'intervention_assignment'))
  assert.ok(result.questions.some(q => q.id === 'temporality'))
  assert.ok(result.questions.some(q => q.id === 'human_data_source'))
  assert.ok(result.warnings.some(w => w.includes('não pode ser inferido')))
})
