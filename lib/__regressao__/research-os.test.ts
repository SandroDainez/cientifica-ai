import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyStudyDesign } from '@/lib/research-os/study-design-classifier'
import { routeEthics } from '@/lib/research-os/ethics-router'
import { getReportingGuidelines } from '@/lib/research-os/reporting-guidelines'
import { researchStateFromLegacyWorkType } from '@/lib/research-os/legacy-bridge'

test('TCC não define desenho científico automaticamente', () => {
  const state = researchStateFromLegacyWorkType('tcc')
  assert.equal(state.academicPurpose, 'tcc')
  assert.equal(state.studyDesign, 'indefinido')
  assert.ok(state.unresolvedIssues.length > 0)
})

test('mestrado e doutorado não implicam seres humanos nem desenho', () => {
  const mestrado = researchStateFromLegacyWorkType('dissertacao_mestrado')
  const doutorado = researchStateFromLegacyWorkType('tese_doutorado')
  assert.equal(mestrado.studyDesign, 'indefinido')
  assert.equal(doutorado.studyDesign, 'indefinido')
  assert.equal(mestrado.regulatory.involvesHumans, false)
  assert.equal(doutorado.regulatory.involvesHumans, false)
})

test('ensaio randomizado é reconhecido e exige SPIRIT/CONSORT', () => {
  const result = classifyStudyDesign({ investigatorAssignsIntervention: true, randomized: true })
  assert.equal(result.design, 'ensaio_clinico_randomizado')
  assert.deepEqual(getReportingGuidelines(result.design), ['SPIRIT', 'CONSORT'])
})

test('coorte retrospectiva usa STROBE', () => {
  const result = classifyStudyDesign({ historicalDataOnly: true, quantitativeData: true })
  assert.equal(result.design, 'coorte_retrospectiva')
  assert.deepEqual(getReportingGuidelines(result.design), ['STROBE'])
})

test('revisão sistemática não recebe CEP por padrão', () => {
  const design = classifyStudyDesign({ literatureOnly: true, systematicSearch: true }).design
  const ethics = routeEthics({ involvesHumans: false, involvesAnimals: false, humanDataSource: 'nenhum' }, design)
  assert.equal(design, 'revisao_sistematica')
  assert.ok(ethics.routes.includes('sem_fluxo_etico_especifico'))
  assert.ok(!ethics.routes.includes('cep_conep_plataforma_brasil'))
})

test('estudo experimental animal segue CEUA/CONCEA e não CEP', () => {
  const design = classifyStudyDesign({ animalExperiment: true }).design
  const ethics = routeEthics({ involvesHumans: false, involvesAnimals: true, humanDataSource: 'nenhum' }, design)
  assert.equal(design, 'experimental_animal')
  assert.ok(ethics.routes.includes('ceua_concea'))
  assert.ok(!ethics.routes.includes('cep_conep_plataforma_brasil'))
  assert.deepEqual(getReportingGuidelines(design), ['ARRIVE'])
})

test('ensaio clínico com humanos gera trilhas CEP e registro', () => {
  const ethics = routeEthics({
    involvesHumans: true,
    involvesAnimals: false,
    humanDataSource: 'intervencao_prospectiva',
    clinicalTrial: true,
  }, 'ensaio_clinico_randomizado')
  assert.ok(ethics.routes.includes('cep_conep_plataforma_brasil'))
  assert.ok(ethics.routes.includes('registro_ensaio_clinico'))
  assert.equal(ethics.blockers.length, 0)
})

test('dados públicos anonimizados não forçam CEP automaticamente', () => {
  const ethics = routeEthics({
    involvesHumans: true,
    involvesAnimals: false,
    humanDataSource: 'base_publica_anonimizada',
  }, 'coorte_retrospectiva')
  assert.ok(!ethics.routes.includes('cep_conep_plataforma_brasil'))
  assert.ok(ethics.notes.length > 0)
})
