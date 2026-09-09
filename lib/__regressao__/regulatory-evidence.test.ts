import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyResearchProjectState } from '../research-os/types'
import {
  requiredRegulatoryEvidenceRoutes,
  upsertRegulatoryEvidence,
  validateRegulatoryEvidenceEntry,
  verifiedRegulatoryRoutes,
  type RegulatoryDocumentIntegrity,
  type RegulatoryEvidenceEntry,
} from '../research-os/regulatory-evidence'

function humanCohortState() {
  const state = createEmptyResearchProjectState('mestrado')
  state.studyDesign = 'coorte_prospectiva'
  state.regulatory = { involvesHumans: true, involvesAnimals: false, humanDataSource: 'observacional_prospectiva' }
  state.ethicsRoutes = ['cep_conep_plataforma_brasil']
  return state
}

const document: RegulatoryDocumentIntegrity = {
  bucket: 'research-regulatory-documents',
  path: 'user/project/cep_conep_plataforma_brasil/abc-parecer.pdf',
  fileName: 'parecer.pdf',
  mimeType: 'application/pdf',
  size: 120034,
  sha256: 'a'.repeat(64),
  uploadedAt: '2026-09-09T12:00:00.000Z',
}

const verifiedEntry: RegulatoryEvidenceEntry = {
  id: 'cep1',
  route: 'cep_conep_plataforma_brasil',
  status: 'verificado',
  identifier: 'CAAE 12345678.9.0000.0001',
  issuer: 'CEP institucional',
  documentReference: document.path,
  document,
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

test('não marca como verificada sem documento íntegro e SHA-256', () => {
  const validation = validateRegulatoryEvidenceEntry({ ...verifiedEntry, document: undefined, documentReference: undefined }, humanCohortState())
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /SHA-256/i)
})

test('rejeita fingerprint SHA-256 malformado', () => {
  const validation = validateRegulatoryEvidenceEntry({
    ...verifiedEntry,
    document: { ...document, sha256: 'abc123' },
  }, humanCohortState())
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /SHA-256/i)
})

test('referência documental precisa apontar para o mesmo objeto íntegro', () => {
  const validation = validateRegulatoryEvidenceEntry({ ...verifiedEntry, documentReference: 'outro/arquivo.pdf' }, humanCohortState())
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /exatamente/i)
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
