import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildResultFactRegistry,
  evaluateResultFactReadiness,
  extractResultNumericTokens,
  validateGeneratedResults,
} from '../research-os/result-fact-lock'
import type { ExecutionAnalysisRecord } from '../research-os/execution-analysis-lock'

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

test('não libera fatos sem Execution / Analysis Lock congelado', () => {
  const readiness = evaluateResultFactReadiness({
    executionRecord: { ...execution, status: 'rascunho' },
    facts: [{ kind: 'primario', text: 'Mortalidade foi 18% em 180 pacientes.' }],
  })
  assert.equal(readiness.canFreeze, false)
})

test('extrai números e percentuais de forma normalizada', () => {
  assert.deepEqual(extractResultNumericTokens('n=180; 18,5%; OR 0.72; IC95% 0.60-0.86'), ['180', '18.5%', '0.72', '95', '0.60', '0.86'])
})

test('congela fatos aprovados ligados ao fingerprint de execução', () => {
  const registry = buildResultFactRegistry({
    executionRecord: execution,
    facts: [{ kind: 'primario', text: 'A mortalidade em 28 dias foi 18% entre 180 pacientes.' }],
    freeze: true,
    now: '2026-09-09T01:00:00.000Z',
  })
  assert.equal(registry.status, 'congelado')
  assert.equal(registry.executionFingerprint, 'exec1')
})

test('bloqueia número inventado pela geração', () => {
  const registry = buildResultFactRegistry({
    executionRecord: execution,
    facts: [{ kind: 'primario', text: 'A mortalidade em 28 dias foi 18% entre 180 pacientes.' }],
    freeze: true,
  })
  const validation = validateGeneratedResults({
    text: 'Foram analisados 180 pacientes e a mortalidade foi 18%. O OR foi 0,72.',
    registry,
    executionRecord: execution,
  })
  assert.equal(validation.allowed, false)
  assert(validation.addedNumericTokens.includes('0.72'))
})

test('libera somente números presentes nos fatos aprovados', () => {
  const registry = buildResultFactRegistry({
    executionRecord: execution,
    facts: [
      { kind: 'primario', text: 'A mortalidade em 28 dias foi 18% entre 180 pacientes.' },
      { kind: 'primario', text: 'O odds ratio ajustado foi 0,72 com IC95% 0,60 a 0,86.' },
    ],
    freeze: true,
  })
  const validation = validateGeneratedResults({
    text: 'Foram analisados 180 pacientes. A mortalidade foi 18%. O odds ratio ajustado foi 0,72 (IC95% 0,60–0,86).',
    registry,
    executionRecord: execution,
  })
  assert.equal(validation.allowed, true)
})

test('bloqueia registry ligado a outro Execution Lock', () => {
  const registry = buildResultFactRegistry({
    executionRecord: execution,
    facts: [{ kind: 'primario', text: 'A mortalidade foi 18%.' }],
    freeze: true,
  })
  const validation = validateGeneratedResults({
    text: 'A mortalidade foi 18%.',
    registry,
    executionRecord: { ...execution, fingerprint: 'exec2' },
  })
  assert.equal(validation.allowed, false)
})
