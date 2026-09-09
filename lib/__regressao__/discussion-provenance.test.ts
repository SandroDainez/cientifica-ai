import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDiscussionProvenance } from '../research-os/discussion-provenance'
import type { ExecutionAnalysisRecord } from '../research-os/execution-analysis-lock'
import type { ResultFactRegistry } from '../research-os/result-fact-lock'

const execution: ExecutionAnalysisRecord = {
  status: 'congelado',
  protocolVersion: 1,
  protocolFingerprint: 'proto1',
  recordedAt: '2026-09-09T00:00:00.000Z',
  frozenAt: '2026-09-09T00:00:00.000Z',
  fingerprint: 'exec1',
  actualSampleSize: 180,
  primaryOutcomeAnalyzed: 'mortalidade em 28 dias',
  primaryAnalysisPerformed: 'regressão logística',
  missingDataHandling: 'imputação múltipla',
  sensitivityAnalyses: [],
  deviations: [],
}

function registry(provenance?: 'pre_especificado' | 'desvio_documentado' | 'exploratorio'): ResultFactRegistry {
  return {
    status: 'congelado',
    executionFingerprint: 'exec1',
    executionProtocolVersion: 1,
    recordedAt: '2026-09-09T01:00:00.000Z',
    frozenAt: '2026-09-09T01:00:00.000Z',
    fingerprint: 'facts1',
    facts: [{ id: 'R1', kind: 'primario', text: 'Mortalidade em 28 dias foi 18%.', numericTokens: ['28', '18%'], provenance }],
  }
}

test('bloqueia Discussão sem Execution Lock congelado', () => {
  const out = evaluateDiscussionProvenance({ executionRecord: null, resultRegistry: registry('pre_especificado') })
  assert.equal(out.allowed, false)
})

test('bloqueia achado sem proveniência explícita', () => {
  const out = evaluateDiscussionProvenance({ executionRecord: execution, resultRegistry: registry() })
  assert.equal(out.allowed, false)
  assert.match(out.reasons.join(' '), /proveniência/i)
})

test('libera achado pré-especificado e gera guardrail', () => {
  const out = evaluateDiscussionProvenance({ executionRecord: execution, resultRegistry: registry('pre_especificado') })
  assert.equal(out.allowed, true)
  assert.match(out.promptGuardrail, /pre_especificado/)
})

test('achado exploratório gera warning de hipótese', () => {
  const out = evaluateDiscussionProvenance({ executionRecord: execution, resultRegistry: registry('exploratorio') })
  assert.equal(out.allowed, true)
  assert(out.warnings.some(w => /explorat/i.test(w)))
})

test('desvio documentado exige desvio real no Execution Lock', () => {
  const out = evaluateDiscussionProvenance({ executionRecord: execution, resultRegistry: registry('desvio_documentado') })
  assert.equal(out.allowed, false)
  assert.match(out.reasons.join(' '), /desvios registrados/i)
})

test('desvio documentado é liberado quando a trilha existe', () => {
  const withDeviation: ExecutionAnalysisRecord = {
    ...execution,
    deviations: [{ id: 'D1', category: 'amostra', planned: '200', actual: '180', reason: 'Recrutamento encerrado conforme prazo.', impact: 'Menor precisão.' }],
  }
  const out = evaluateDiscussionProvenance({ executionRecord: withDeviation, resultRegistry: registry('desvio_documentado') })
  assert.equal(out.allowed, true)
  assert.match(out.promptGuardrail, /Recrutamento encerrado/)
})

test('bloqueia registry de outra execução', () => {
  const stale = { ...registry('pre_especificado'), executionFingerprint: 'exec-old' }
  const out = evaluateDiscussionProvenance({ executionRecord: execution, resultRegistry: stale })
  assert.equal(out.allowed, false)
})
