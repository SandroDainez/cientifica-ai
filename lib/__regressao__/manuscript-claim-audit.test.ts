import test from 'node:test'
import assert from 'node:assert/strict'
import { auditManuscriptClaims } from '../research-os/manuscript-claim-audit'
import { createEmptyResearchProjectState } from '../research-os/types'
import type { EvidenceMapResult } from '../research-os/evidence-engine'
import type { ResultFactRegistry } from '../research-os/result-fact-lock'

function stateWithRegistry(provenance: 'pre_especificado' | 'exploratorio' = 'pre_especificado') {
  const state = createEmptyResearchProjectState('mestrado') as ReturnType<typeof createEmptyResearchProjectState> & Record<string, unknown>
  state._result_fact_registry = {
    status: 'congelado', executionFingerprint: 'exec1', executionProtocolVersion: 1,
    recordedAt: '2026-09-09T00:00:00.000Z', frozenAt: '2026-09-09T00:00:00.000Z', fingerprint: 'r1',
    facts: [{ id: 'R1', kind: 'primario', provenance, text: 'A mortalidade em 28 dias foi 18%.', numericTokens: ['28', '18%'] }],
  } satisfies ResultFactRegistry
  return state
}

const evidenceMap: EvidenceMapResult = {
  claims: [{ id: 'C1', text: 'A exposição X está associada ao aumento de mortalidade.', importance: 'alta', kind: 'associacao' }],
  links: [{
    claimId: 'C1', referenceId: 'REF1', supportStatus: 'confirmado', directness: 'direta', sourceTier: 'observacional',
    populationMatch: 'alta', outcomeMatch: 'alta', numericSupport: 'nao_aplicavel', rationale: 'Suporte direto.',
  }],
  uncoveredClaims: [], warnings: [], readiness: 'pronto',
}

test('não aplica fora de Discussão/Conclusão', () => {
  const audit = auditManuscriptClaims({ sectionKey: 'introducao', text: 'A mortalidade foi 18%.', researchProjectState: stateWithRegistry(), evidenceMap })
  assert.equal(audit.applies, false)
  assert.equal(audit.allowed, true)
})

test('vincula claim a resultado próprio aprovado', () => {
  const audit = auditManuscriptClaims({
    sectionKey: 'discussao', text: 'A mortalidade em 28 dias foi 18%.', researchProjectState: stateWithRegistry(), evidenceMap,
  })
  assert.equal(audit.allowed, true)
  assert.equal(audit.findings[0]?.source, 'resultado_proprio')
  assert.equal(audit.findings[0]?.sourceId, 'R1')
})

test('vincula claim externo a Evidence Map confirmado', () => {
  const audit = auditManuscriptClaims({
    sectionKey: 'discussao', text: 'A exposição X esteve associada ao aumento de mortalidade.', researchProjectState: stateWithRegistry(), evidenceMap,
  })
  assert.equal(audit.allowed, true)
  assert.equal(audit.findings[0]?.source, 'evidencia_externa')
  assert.equal(audit.findings[0]?.sourceId, 'C1')
})

test('bloqueia claim material sem provenance', () => {
  const audit = auditManuscriptClaims({
    sectionKey: 'discussao', text: 'A intervenção reduziu a mortalidade em 35%.', researchProjectState: stateWithRegistry(), evidenceMap,
  })
  assert.equal(audit.allowed, false)
  assert(audit.findings.some(f => f.issue === 'claim_sem_suporte'))
})

test('bloqueia aumento de associação externa para causalidade', () => {
  const audit = auditManuscriptClaims({
    sectionKey: 'discussao', text: 'A exposição X causou aumento de mortalidade.', researchProjectState: stateWithRegistry(), evidenceMap,
  })
  assert.equal(audit.allowed, false)
  assert(audit.findings.some(f => f.issue === 'causalidade_externa_aumentada'))
})

test('Conclusão não transforma achado exploratório em conclusão definitiva', () => {
  const audit = auditManuscriptClaims({
    sectionKey: 'conclusao', text: 'A mortalidade em 28 dias foi 18%, confirmando o efeito observado.', researchProjectState: stateWithRegistry('exploratorio'), evidenceMap,
  })
  assert.equal(audit.allowed, false)
  assert(audit.findings.some(f => f.issue === 'exploratorio_confirmatorio'))
})

test('Conclusão aceita achado exploratório quando explicitamente qualificado', () => {
  const audit = auditManuscriptClaims({
    sectionKey: 'conclusao', text: 'Em análise exploratória, a mortalidade em 28 dias foi 18%, achado gerador de hipótese.', researchProjectState: stateWithRegistry('exploratorio'), evidenceMap,
  })
  assert.equal(audit.allowed, true)
})

test('frase interpretativa sem claim material não é bloqueada', () => {
  const audit = auditManuscriptClaims({
    sectionKey: 'discussao', text: 'Esses achados devem ser interpretados com cautela diante das limitações do estudo.', researchProjectState: stateWithRegistry(), evidenceMap,
  })
  assert.equal(audit.allowed, true)
  assert.equal(audit.findings.length, 0)
})
