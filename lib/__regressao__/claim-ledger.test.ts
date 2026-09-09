import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClaimLedger } from '../research-os/claim-ledger'
import { createEmptyResearchProjectState } from '../research-os/types'
import type { EvidenceMapResult } from '../research-os/evidence-engine'
import type { ResultFactRegistry } from '../research-os/result-fact-lock'

function stateWithFact() {
  const state = createEmptyResearchProjectState('mestrado') as ReturnType<typeof createEmptyResearchProjectState> & Record<string, unknown>
  state.studyDesign = 'coorte_retrospectiva'
  state._result_fact_registry = {
    status: 'congelado', executionFingerprint: 'exec1', executionProtocolVersion: 1,
    recordedAt: '2026-09-09T00:00:00.000Z', frozenAt: '2026-09-09T00:00:00.000Z', fingerprint: 'reg1',
    facts: [{ id: 'R1', kind: 'primario', provenance: 'pre_especificado', text: 'A mortalidade foi 18%.', numericTokens: ['18%'] }],
  } satisfies ResultFactRegistry
  return state
}

const evidenceMap: EvidenceMapResult = {
  claims: [{ id: 'C1', text: 'Diabetes está associada a maior mortalidade.', importance: 'alta', kind: 'associacao' }],
  links: [{ claimId: 'C1', referenceId: 'REF1', supportStatus: 'confirmado', directness: 'direta', sourceTier: 'observacional', populationMatch: 'alta', outcomeMatch: 'alta', numericSupport: 'nao_aplicavel', rationale: 'Direto.' }],
  uncoveredClaims: [], warnings: [], readiness: 'pronto',
}

test('ledger agrega resultado próprio e evidência externa', () => {
  const ledger = buildClaimLedger({
    sections: [{
      sectionKey: 'discussao', sectionName: 'Discussão',
      text: 'A mortalidade foi 18%. Diabetes está associada a maior mortalidade.',
    }],
    researchProjectState: stateWithFact(),
    evidenceMap,
  })
  assert.equal(ledger.totalClaims, 2)
  assert.equal(ledger.ownResults, 1)
  assert.equal(ledger.externalEvidence, 1)
  assert.equal(ledger.unsupported, 0)
  assert.equal(ledger.ready, true)
})

test('ledger marca claim material sem suporte como não pronto', () => {
  const ledger = buildClaimLedger({
    sections: [{ sectionKey: 'conclusao', sectionName: 'Conclusão', text: 'A incidência de complicações caiu 45%.' }],
    researchProjectState: stateWithFact(),
    evidenceMap,
  })
  assert.equal(ledger.unsupported, 1)
  assert.equal(ledger.violations, 1)
  assert.equal(ledger.ready, false)
})

test('ledger ignora seções fora do escopo do Manuscript Claim Audit', () => {
  const ledger = buildClaimLedger({
    sections: [{ sectionKey: 'introducao', sectionName: 'Introdução', text: 'A mortalidade foi 18%.' }],
    researchProjectState: stateWithFact(),
    evidenceMap,
  })
  assert.equal(ledger.totalClaims, 0)
  assert.equal(ledger.sectionsAudited, 0)
})

test('ledger mantém sectionName e sourceId para provenance visual', () => {
  const ledger = buildClaimLedger({
    sections: [{ sectionKey: 'discussao', sectionName: 'Discussão', text: 'A mortalidade foi 18%.' }],
    researchProjectState: stateWithFact(),
    evidenceMap,
  })
  assert.equal(ledger.entries[0].sectionName, 'Discussão')
  assert.equal(ledger.entries[0].sourceId, 'R1')
  assert.equal(ledger.entries[0].status, 'ok')
})
