import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGenerationEvidencePolicy } from '../research-os/generation-evidence'
import type { EvidenceMapResult } from '../research-os/evidence-engine'
import type { ExecutionAnalysisRecord } from '../research-os/execution-analysis-lock'
import type { ResultFactRegistry } from '../research-os/result-fact-lock'

const evidenceMap: EvidenceMapResult = {
  claims: [{ id: 'C1', text: 'A exposição X está associada ao desfecho Y.', importance: 'alta', kind: 'associacao' }],
  links: [{
    claimId: 'C1', referenceId: 'R1', supportStatus: 'confirmado', directness: 'direta', sourceTier: 'observacional',
    populationMatch: 'alta', outcomeMatch: 'alta', numericSupport: 'nao_aplicavel', rationale: 'Suporte direto.',
  }],
  uncoveredClaims: [], warnings: [], readiness: 'pronto',
}

const execution: ExecutionAnalysisRecord = {
  status: 'congelado', protocolVersion: 1, protocolFingerprint: 'p1', recordedAt: '2026-09-09T00:00:00.000Z',
  frozenAt: '2026-09-09T00:00:00.000Z', fingerprint: 'exec1', actualSampleSize: 180,
  primaryOutcomeAnalyzed: 'mortalidade', primaryAnalysisPerformed: 'regressão logística', missingDataHandling: 'imputação múltipla',
  sensitivityAnalyses: [], deviations: [],
}

function registry(provenance?: 'pre_especificado' | 'desvio_documentado' | 'exploratorio'): ResultFactRegistry {
  return {
    status: 'congelado', executionFingerprint: 'exec1', executionProtocolVersion: 1,
    recordedAt: '2026-09-09T01:00:00.000Z', frozenAt: '2026-09-09T01:00:00.000Z', fingerprint: 'facts1',
    facts: [{ id: 'R1', kind: 'primario', text: 'Mortalidade foi 18%.', numericTokens: ['18%'], provenance }],
  }
}

test('Discussão é bloqueada se achado aprovado não tiver proveniência', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'discussao', researchProjectState: { schemaVersion: 2 }, evidenceMap,
    currentReferenceIds: ['R1'], executionAnalysis: execution, resultFactRegistry: registry(),
  })
  assert.equal(policy.decision.allowed, false)
  assert.match(policy.decision.reasons.join(' '), /proveniência/i)
})

test('Discussão combina Evidence Gate com provenance guardrail', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'discussao', researchProjectState: { schemaVersion: 2 }, evidenceMap,
    currentReferenceIds: ['R1'], executionAnalysis: execution, resultFactRegistry: registry('pre_especificado'),
  })
  assert.equal(policy.decision.allowed, true)
  assert.match(policy.promptGuardrail, /EVIDENCE GATE/)
  assert.match(policy.promptGuardrail, /DISCUSSION PROVENANCE/)
  assert.match(policy.promptGuardrail, /pre_especificado/)
})

test('Discussão exploratória é liberada com alerta e linguagem de hipótese', () => {
  const policy = buildGenerationEvidencePolicy({
    sectionKey: 'discussao', researchProjectState: { schemaVersion: 2 }, evidenceMap,
    currentReferenceIds: ['R1'], executionAnalysis: execution, resultFactRegistry: registry('exploratorio'),
  })
  assert.equal(policy.decision.allowed, true)
  assert.equal(policy.decision.level, 'alertar')
  assert.match(policy.promptGuardrail, /gerador de hipótese/i)
})
