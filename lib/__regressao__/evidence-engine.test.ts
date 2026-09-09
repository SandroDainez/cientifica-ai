import test from 'node:test'
import assert from 'node:assert/strict'
import type { Referencia } from '@/types'
import { buildEvidenceMapResult, validateEvidenceAssessment, type ClaimCandidate, type EvidenceLinkAssessment } from '@/lib/research-os/evidence-engine'

function ref(overrides: Partial<Referencia> = {}): Referencia {
  return {
    id: 'R1',
    trabalho_id: 'T1',
    tipo: 'artigo',
    titulo: 'Randomized trial of intervention X',
    autores: [{ nome: 'Ana', sobrenome: 'Silva' }],
    ano: 2025,
    abstract: 'In 200 participants, intervention X reduced delirium from 30% to 20%.',
    dados_extras: {},
    confiabilidade: 'alta',
    fonte_tipo: 'pubmed',
    created_at: '',
    ...overrides,
  }
}

const claim: ClaimCandidate = {
  id: 'C1',
  text: 'A intervenção X reduziu delirium de 30% para 20%.',
  importance: 'alta',
  kind: 'efeito',
}

function link(overrides: Partial<EvidenceLinkAssessment> = {}): EvidenceLinkAssessment {
  return {
    claimId: 'C1',
    referenceId: 'R1',
    supportStatus: 'confirmado',
    directness: 'direta',
    sourceTier: 'ensaio',
    populationMatch: 'alta',
    outcomeMatch: 'alta',
    numericSupport: 'confirmado',
    rationale: 'O abstract relata diretamente o desfecho e as proporções.',
    supportingExcerpt: 'intervention X reduced delirium from 30% to 20%',
    ...overrides,
  }
}

test('evidence: fonte sem abstract nunca fica confirmada', () => {
  const result = validateEvidenceAssessment([claim], [ref({ abstract: undefined })], [link()])
  assert.equal(result.links[0]?.supportStatus, 'nao_avaliado')
  assert.equal(result.links[0]?.directness, 'incerta')
})

test('evidence: número ausente rebaixa suporte confirmado para parcial', () => {
  const result = validateEvidenceAssessment(
    [claim],
    [ref({ abstract: 'Intervention X was associated with less delirium.' })],
    [link()],
  )
  assert.equal(result.links[0]?.numericSupport, 'nao_encontrado')
  assert.equal(result.links[0]?.supportStatus, 'parcial')
})

test('evidence: ligação para referência desconhecida é descartada', () => {
  const result = validateEvidenceAssessment([claim], [ref()], [link({ referenceId: 'INVENTADA' })])
  assert.equal(result.links.length, 0)
  assert.ok(result.warnings.some(w => w.includes('descartada')))
})

test('evidence: excerto inventado é removido', () => {
  const result = validateEvidenceAssessment([claim], [ref()], [link({ supportingExcerpt: 'this sentence does not exist' })])
  assert.equal(result.links[0]?.supportingExcerpt, undefined)
})

test('evidence: claim de alta importância sem suporte direto permanece descoberto', () => {
  const result = buildEvidenceMapResult([claim], [ref()], [link({ supportStatus: 'parcial' })])
  assert.deepEqual(result.uncoveredClaims, ['C1'])
  assert.equal(result.readiness, 'pendente')
})

test('evidence: claim de alta importância com suporte direto confirmado deixa mapa pronto', () => {
  const result = buildEvidenceMapResult([claim], [ref()], [link()])
  assert.deepEqual(result.uncoveredClaims, [])
  assert.equal(result.readiness, 'pronto')
})
