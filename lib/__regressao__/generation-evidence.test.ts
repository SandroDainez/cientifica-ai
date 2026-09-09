import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGenerationEvidencePolicy, sanitizeEvidenceMapAgainstCurrentReferences } from '@/lib/research-os/generation-evidence'
import type { EvidenceMapResult } from '@/lib/research-os/evidence-engine'

function map(overrides: Partial<EvidenceMapResult> = {}): EvidenceMapResult {
  return {
    claims: [
      { id: 'C1', text: 'A exposição X está associada ao desfecho Y.', importance: 'alta', kind: 'associacao' },
    ],
    links: [
      {
        claimId: 'C1', referenceId: 'R1', supportStatus: 'confirmado', directness: 'direta',
        sourceTier: 'observacional', populationMatch: 'alta', outcomeMatch: 'alta',
        numericSupport: 'nao_aplicavel', rationale: 'Suporte direto.',
      },
    ],
    uncoveredClaims: [],
    warnings: [],
    readiness: 'pronto',
    ...overrides,
  }
}

test('projeto legado não é bloqueado por ausência de Evidence Map', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'introducao',
    researchProjectState: null,
    evidenceMap: null,
  })
  assert.equal(policy.researchOsActive, false)
  assert.equal(policy.decision.allowed, true)
})

test('Research OS bloqueia introdução sem Evidence Map', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'introducao',
    researchProjectState: { schemaVersion: 2 },
    evidenceMap: null,
  })
  assert.equal(policy.researchOsActive, true)
  assert.equal(policy.decision.allowed, false)
  assert.equal(policy.decision.level, 'bloquear')
})

test('Research OS libera seção não submetida ao gate estrito', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'metodologia',
    researchProjectState: { schemaVersion: 2 },
    evidenceMap: null,
  })
  assert.equal(policy.decision.allowed, true)
})

test('introdução liberada recebe guardrail contendo apenas claims confirmados', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'introducao',
    researchProjectState: { schemaVersion: 2 },
    evidenceMap: map(),
    currentReferenceIds: ['R1'],
  })
  assert.equal(policy.decision.allowed, true)
  assert.match(policy.promptGuardrail, /C1/)
  assert.match(policy.promptGuardrail, /referência_id=R1/)
})

test('referência removida invalida o vínculo e volta a bloquear', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'discussao',
    researchProjectState: { schemaVersion: 2 },
    evidenceMap: map(),
    currentReferenceIds: ['R2'],
  })
  assert.equal(policy.decision.allowed, false)
})

test('sanitização preserva aviso de vínculo obsoleto', () => {
  const sanitized = sanitizeEvidenceMapAgainstCurrentReferences(map(), ['R2'])
  assert.ok(sanitized)
  assert.equal(sanitized!.links.length, 0)
  assert.ok(sanitized!.warnings.some(w => /não existem mais/.test(w)))
})
