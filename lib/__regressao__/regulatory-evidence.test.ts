import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyResearchProjectState } from '../research-os/types'
import {
  requiredRegulatoryEvidenceRoutes,
  upsertRegulatoryEvidence,
  validateRegulatoryEvidenceEntry,
  verifiedRegulatoryRoutes,
  type RegulatoryEvidenceEntry,
} from '../research-os/regulatory-evidence'

function humanCohortState() {
  const state = createEmptyResearchProjectState('mestrado')
  state.studyDesign = 'coorte_prospectiva'
  state.regulatory = { involvesHumans: true, involvesAnimals: false, humanDataSource: 'observacional_prospectiva' }
  state.ethicsRoutes = ['cep_conep_plataforma_brasil']
  return state
}

const verifiedEntry: RegulatoryEvidenceEntry = {
  id: 'cep1',
  route: 'cep_conep_plataforma_brasil',
  status: 'verificado',
  identifier: 'CAAE 12345678.9.0000.0001',
  issuer: 'CEP institucional',
  documentReference: 'parecer-consubstanciado-123456.pdf',
  issuedAt: '2026-08-01',
  verifiedAt: '2026-09-09T12:00:00.000Z',
}

test('deriva rota regulatória exigida a partir do estado científico', () => {
  assert.deepEqual(requiredRegulatoryEvidenceRoutes(humanCohortState()), ['cep_conep_plataforma_brasil'])
})

test('não aceita evidência de rota que o projeto atual não exige', () => {
  const validation = validateRegulatoryEvidenceEntry({ ...verifiedEntry, route: 'ceua_concea' }, humanCohortState())
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /não é exigida/i)
})

test('não marca como verificada sem identificador real', () => {
  const validation = validateRegulatoryEvidenceEntry({ ...verifiedEntry, identifier: '' }, humanCohortState())
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /identificador real/i)
})

test('não marca como verificada sem referência documental real', () => {
  const validation = validateRegulatoryEvidenceEntry({ ...verifiedEntry, documentReference: '' }, humanCohortState())
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /referência documental real/i)
})

test('registro verificado válido libera a rota para Submission Readiness', () => {
  const state = humanCohortState()
  const registry = upsertRegulatoryEvidence({ registry: null, state, entry: verifiedEntry, now: verifiedEntry.verifiedAt })
  assert.deepEqual(verifiedRegulatoryRoutes(registry, state, '2026-09-09T13:00:00.000Z'), ['cep_conep_plataforma_brasil'])
})

test('evidência expirada não libera a rota regulatória', () => {
  const state = humanCohortState()
  const registry = upsertRegulatoryEvidence({
    registry: null,
    state,
    entry: { ...verifiedEntry, expiresAt: '2026-09-01' },
    now: verifiedEntry.verifiedAt,
  })
  assert.deepEqual(verifiedRegulatoryRoutes(registry, state, '2026-09-09T13:00:00.000Z'), [])
})
