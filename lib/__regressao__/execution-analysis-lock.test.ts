import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExecutionAnalysisRecord,
  evaluateExecutionAnalysisReadiness,
  requiredExecutionDeviations,
} from '@/lib/research-os/execution-analysis-lock'
import type { ProtocolLockRecord } from '@/lib/research-os/protocol-lock'

const protocol: ProtocolLockRecord = {
  status: 'congelado',
  amendments: [],
  snapshot: {
    version: 2,
    frozenAt: '2026-09-09T12:00:00.000Z',
    fingerprint: 'abc12345def67890',
    design: 'ensaio_clinico_randomizado',
    question: {
      population: 'adultos críticos',
      interventionOrExposure: 'intervenção A',
      comparator: 'controle',
      primaryOutcome: 'mortalidade em 28 dias',
      secondaryOutcomes: [],
    },
    statistics: {
      sampleSize: 200,
      primaryAnalysis: 'Comparação por modelo binomial; intenção de tratar.',
      covariates: [],
      confounders: [],
      missingDataStrategy: 'Imputação múltipla quando apropriado.',
      multiplicityStrategy: 'Sem ajuste para exploratórios.',
    },
    methodology: null,
    sampleSize: null,
    ethicsRoutes: ['cep_conep_plataforma_brasil'],
    reportingGuidelines: ['CONSORT'],
  },
}

const alignedInput = {
  actualSampleSize: 200,
  primaryOutcomeAnalyzed: 'mortalidade em 28 dias',
  primaryAnalysisPerformed: 'Comparação por modelo binomial; intenção de tratar.',
  missingDataHandling: 'Imputação múltipla quando apropriado.',
  analysisPopulation: 'intenção de tratar',
  sensitivityAnalyses: ['Análise por protocolo como sensibilidade.'],
}

test('sem Protocol Lock não libera registro final', () => {
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: null, input: alignedInput })
  assert.equal(readiness.status, 'bloqueado')
  assert.equal(readiness.canFreeze, false)
})

test('execução alinhada ao protocolo pode ser congelada', () => {
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: protocol, input: alignedInput })
  assert.equal(readiness.status, 'pronto_para_congelar')
  assert.equal(readiness.canFreeze, true)
  assert.deepEqual(readiness.requiredDeviationCategories, [])
})

test('amostra diferente exige desvio documentado', () => {
  const input = { ...alignedInput, actualSampleSize: 180 }
  assert.deepEqual(requiredExecutionDeviations(protocol, input), ['amostra'])
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: protocol, input })
  assert.equal(readiness.canFreeze, false)
  assert.ok(readiness.blockers.some(v => /amostra/i.test(v)))
  assert.ok(readiness.warnings.some(v => /abaixo da planejada/i.test(v)))
})

test('amostra diferente com justificativa explícita pode prosseguir', () => {
  const input = {
    ...alignedInput,
    actualSampleSize: 180,
    deviations: [{
      id: 'D1',
      category: 'amostra' as const,
      planned: '200 participantes',
      actual: '180 participantes',
      reason: 'Recrutamento terminou no prazo regulatório previsto.',
      impact: 'Menor precisão que a planejada.',
    }],
  }
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: protocol, input })
  assert.equal(readiness.canFreeze, true)
})

test('troca do desfecho primário sem justificativa é bloqueada', () => {
  const input = { ...alignedInput, primaryOutcomeAnalyzed: 'mortalidade em 90 dias' }
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: protocol, input })
  assert.equal(readiness.canFreeze, false)
  assert.ok(readiness.requiredDeviationCategories.includes('desfecho'))
})

test('troca da análise principal exige desvio documentado', () => {
  const input = { ...alignedInput, primaryAnalysisPerformed: 'Regressão logística ajustada.' }
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: protocol, input })
  assert.ok(readiness.requiredDeviationCategories.includes('analise'))
  assert.equal(readiness.canFreeze, false)
})

test('freeze gera registro auditável ligado à versão/fingerprint do protocolo', () => {
  const record = buildExecutionAnalysisRecord({
    protocolLock: protocol,
    input: alignedInput,
    freeze: true,
    now: '2026-09-09T15:00:00.000Z',
  })
  assert.equal(record.status, 'congelado')
  assert.equal(record.protocolVersion, 2)
  assert.equal(record.protocolFingerprint, 'abc12345def67890')
  assert.equal(record.frozenAt, '2026-09-09T15:00:00.000Z')
  assert.equal(record.fingerprint.length, 16)
})

test('registro já congelado não é silenciosamente reaberto', () => {
  const frozen = buildExecutionAnalysisRecord({ protocolLock: protocol, input: alignedInput, freeze: true })
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock: protocol, input: alignedInput, existingRecord: frozen })
  assert.equal(readiness.status, 'congelado')
  assert.equal(readiness.canFreeze, false)
})
