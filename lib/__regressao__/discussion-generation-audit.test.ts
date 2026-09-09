import test from 'node:test'
import assert from 'node:assert/strict'
import { auditGeneratedDiscussion } from '../research-os/discussion-generation-audit'
import { createEmptyResearchProjectState } from '../research-os/types'
import type { ResultFactRegistry } from '../research-os/result-fact-lock'

function stateWithFacts(facts: ResultFactRegistry['facts'], design = 'coorte_retrospectiva') {
  const state = createEmptyResearchProjectState('mestrado') as ReturnType<typeof createEmptyResearchProjectState> & Record<string, unknown>
  state.studyDesign = design as typeof state.studyDesign
  state._result_fact_registry = {
    status: 'congelado',
    executionFingerprint: 'exec1',
    executionProtocolVersion: 1,
    recordedAt: '2026-09-09T00:00:00.000Z',
    frozenAt: '2026-09-09T00:00:00.000Z',
    fingerprint: 'reg1',
    facts,
  } satisfies ResultFactRegistry
  return state
}

const exploratoryFact: ResultFactRegistry['facts'][number] = {
  id: 'R1',
  kind: 'secundario',
  provenance: 'exploratorio',
  text: 'No subgrupo com diabetes, a mortalidade foi 18%.',
  numericTokens: ['18%'],
}

const deviationFact: ResultFactRegistry['facts'][number] = {
  id: 'R2',
  kind: 'secundario',
  provenance: 'desvio_documentado',
  text: 'A análise em 90 dias mostrou mortalidade de 22%.',
  numericTokens: ['90', '22%'],
}

test('não aplica auditor fora da Discussão', () => {
  const audit = auditGeneratedDiscussion({ sectionKey: 'introducao', text: 'Texto.', researchProjectState: stateWithFacts([exploratoryFact]) })
  assert.equal(audit.applied, false)
  assert.equal(audit.allowed, true)
})

test('bloqueia Discussão Research OS sem Result Fact Lock', () => {
  const audit = auditGeneratedDiscussion({ sectionKey: 'discussao', text: 'Texto.', researchProjectState: createEmptyResearchProjectState('mestrado') })
  assert.equal(audit.allowed, false)
})

test('bloqueia achado exploratório apresentado como confirmação', () => {
  const audit = auditGeneratedDiscussion({
    sectionKey: 'discussao',
    researchProjectState: stateWithFacts([exploratoryFact]),
    text: 'No subgrupo com diabetes, nossos dados confirmaram mortalidade de 18%.',
  })
  assert.equal(audit.allowed, false)
  assert(audit.violations.some(v => v.kind === 'exploratorio_confirmatorio'))
})

test('libera achado exploratório quando qualificado como exploratório', () => {
  const audit = auditGeneratedDiscussion({
    sectionKey: 'discussao',
    researchProjectState: stateWithFacts([exploratoryFact]),
    text: 'Em análise exploratória do subgrupo com diabetes, observou-se mortalidade de 18%, achado gerador de hipótese.',
  })
  assert.equal(audit.allowed, true)
})

test('bloqueia desvio quando a Discussão apaga sua natureza', () => {
  const audit = auditGeneratedDiscussion({
    sectionKey: 'discussao',
    researchProjectState: stateWithFacts([deviationFact]),
    text: 'A análise em 90 dias mostrou mortalidade de 22%.',
  })
  assert.equal(audit.allowed, false)
  assert(audit.violations.some(v => v.kind === 'desvio_apagado'))
})

test('libera desvio explicitamente identificado', () => {
  const audit = auditGeneratedDiscussion({
    sectionKey: 'discussao',
    researchProjectState: stateWithFacts([deviationFact]),
    text: 'Como desvio documentado do protocolo, a análise em 90 dias mostrou mortalidade de 22%.',
  })
  assert.equal(audit.allowed, true)
})

test('bloqueia linguagem causal em desenho observacional quando ligada ao próprio achado', () => {
  const fact = { ...exploratoryFact, provenance: 'pre_especificado' as const }
  const audit = auditGeneratedDiscussion({
    sectionKey: 'discussao',
    researchProjectState: stateWithFacts([fact], 'coorte_retrospectiva'),
    text: 'No subgrupo com diabetes, a exposição causou mortalidade de 18%.',
  })
  assert.equal(audit.allowed, false)
  assert(audit.violations.some(v => v.kind === 'causalidade_aumentada'))
})

test('não bloqueia linguagem causal apenas por existir em RCT', () => {
  const fact = { ...exploratoryFact, provenance: 'pre_especificado' as const }
  const audit = auditGeneratedDiscussion({
    sectionKey: 'discussao',
    researchProjectState: stateWithFacts([fact], 'ensaio_clinico_randomizado'),
    text: 'No subgrupo com diabetes, a intervenção causou redução do risco; a mortalidade observada foi 18%.',
  })
  assert.equal(audit.allowed, true)
})
