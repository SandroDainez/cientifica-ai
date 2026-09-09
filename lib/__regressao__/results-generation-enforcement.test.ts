import test from 'node:test'
import assert from 'node:assert/strict'
import { enforceGeneratedResults } from '../research-os/results-generation-enforcement'
import type { ExecutionAnalysisRecord } from '../research-os/execution-analysis-lock'
import { buildResultFactRegistry } from '../research-os/result-fact-lock'

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

const registry = buildResultFactRegistry({
  executionRecord: execution,
  facts: [
    { kind: 'primario', text: 'Foram analisados 180 pacientes e a mortalidade em 28 dias foi 18%.' },
    { kind: 'primario', text: 'O odds ratio ajustado foi 0,72 com IC95% 0,60 a 0,86.' },
  ],
  freeze: true,
  now: '2026-09-09T01:00:00.000Z',
})

const state = {
  schemaVersion: 2,
  _execution_analysis: execution,
  _result_fact_registry: registry,
}

test('seções fora de Resultados não recebem enforcement', () => {
  const result = enforceGeneratedResults({
    sectionKey: 'discussao',
    text: 'A mortalidade foi 99%.',
    researchProjectState: state,
  })
  assert.equal(result.applies, false)
  assert.equal(result.allowed, true)
})

test('Resultados aprovados e sem número novo são liberados', () => {
  const result = enforceGeneratedResults({
    sectionKey: 'resultados',
    text: 'Foram analisados 180 pacientes. A mortalidade em 28 dias foi 18%. O odds ratio ajustado foi 0,72 (IC95% 0,60–0,86).',
    researchProjectState: state,
  })
  assert.equal(result.applies, true)
  assert.equal(result.allowed, true)
})

test('Resultados com número inventado falham fechado', () => {
  const result = enforceGeneratedResults({
    sectionKey: 'resultados',
    text: 'Foram analisados 180 pacientes. A mortalidade foi 18% e p=0,04.',
    researchProjectState: state,
  })
  assert.equal(result.allowed, false)
  assert(result.validation?.addedNumericTokens.includes('0.04'))
})

test('Resultados sem Result Fact Lock falham fechado', () => {
  const result = enforceGeneratedResults({
    sectionKey: 'resultados',
    text: 'Foram analisados 180 pacientes.',
    researchProjectState: { schemaVersion: 2, _execution_analysis: execution },
  })
  assert.equal(result.allowed, false)
})

test('registry ligado a outra execução é rejeitado', () => {
  const result = enforceGeneratedResults({
    sectionKey: 'resultados',
    text: 'Foram analisados 180 pacientes.',
    researchProjectState: {
      schemaVersion: 2,
      _execution_analysis: { ...execution, fingerprint: 'exec2' },
      _result_fact_registry: registry,
    },
  })
  assert.equal(result.allowed, false)
  assert(result.validation?.reasons.some(reason => reason.includes('outra versão')))
})
