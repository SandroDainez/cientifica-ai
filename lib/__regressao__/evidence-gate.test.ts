import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateEvidenceGate } from '@/lib/research-os/evidence-gate'
import type { EvidenceMapResult } from '@/lib/research-os/evidence-engine'

function baseMap(): EvidenceMapResult {
  return {
    claims: [
      { id: 'C1', text: 'A exposição X está associada ao desfecho Y.', importance: 'alta', kind: 'associacao' },
      { id: 'C2', text: 'O desfecho Y é clinicamente relevante.', importance: 'media', kind: 'outro' },
    ],
    links: [
      {
        claimId: 'C1',
        referenceId: 'R1',
        supportStatus: 'confirmado',
        directness: 'direta',
        sourceTier: 'observacional',
        populationMatch: 'alta',
        outcomeMatch: 'alta',
        numericSupport: 'nao_aplicavel',
        rationale: 'O abstract relata associação entre X e Y na população-alvo.',
      },
    ],
    uncoveredClaims: [],
    warnings: [],
    readiness: 'pronto',
  }
}

test('bloqueia introdução quando não há Evidence Map', () => {
  const decision = evaluateEvidenceGate('introducao', null)
  assert.equal(decision.allowed, false)
  assert.equal(decision.level, 'bloquear')
})

test('libera seção fora do gate estrito', () => {
  const decision = evaluateEvidenceGate('outro', null)
  assert.equal(decision.allowed, true)
  assert.equal(decision.level, 'liberar')
})

test('bloqueia introdução com claim de alta importância descoberto', () => {
  const map = baseMap()
  map.links = []
  map.uncoveredClaims = ['C1']
  map.readiness = 'pendente'
  const decision = evaluateEvidenceGate('introducao', map)
  assert.equal(decision.allowed, false)
  assert.match(decision.reasons.join(' '), /C1/)
})

test('bloqueia discussão quando há evidência contraditória em claim central', () => {
  const map = baseMap()
  map.links.push({
    claimId: 'C1',
    referenceId: 'R2',
    supportStatus: 'contraditorio',
    directness: 'direta',
    sourceTier: 'ensaio',
    populationMatch: 'alta',
    outcomeMatch: 'alta',
    numericSupport: 'nao_aplicavel',
    rationale: 'Resultado em direção oposta.',
  })
  const decision = evaluateEvidenceGate('discussao', map)
  assert.equal(decision.allowed, false)
})

test('libera com alerta se cobertura central está confirmada mas há warnings', () => {
  const map = baseMap()
  map.warnings = ['Uma fonte secundária não possui abstract.']
  const decision = evaluateEvidenceGate('introducao', map)
  assert.equal(decision.allowed, true)
  assert.equal(decision.level, 'alertar')
})

test('libera quando todos claims de alta importância têm suporte direto confirmado', () => {
  const decision = evaluateEvidenceGate('introducao', baseMap())
  assert.equal(decision.allowed, true)
  assert.equal(decision.level, 'liberar')
})
