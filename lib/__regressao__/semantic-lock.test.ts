import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHumanizadorPrompt, HUMANIZADOR_SYSTEM } from '@/lib/ai/humanizar'
import { validateScientificRewrite } from '@/lib/research-os/semantic-lock'

test('rewrite prompt protege números, citações e causalidade', () => {
  const draft = 'Em 120 pacientes, a exposição esteve associada a menor mortalidade (Silva et al., 2024), RR 0,72; p=0,03.'
  const prompt = buildHumanizadorPrompt(draft)
  assert.match(prompt, /120/)
  assert.match(prompt, /0,72/)
  assert.match(prompt, /Silva et al\., 2024/)
  assert.match(HUMANIZADOR_SYSTEM, /Não mude associação para causalidade/)
  assert.doesNotMatch(HUMANIZADOR_SYSTEM, /GPTZero|Turnitin|Originality|ZeroGPT/)
})

test('semantic lock aceita reescrita conservadora', () => {
  const before = 'Em 120 pacientes, a exposição esteve associada a menor mortalidade (Silva et al., 2024).'
  const after = 'A exposição esteve associada a menor mortalidade em 120 pacientes (Silva et al., 2024).'
  const result = validateScientificRewrite(before, after)
  assert.equal(result.ok, true)
})

test('semantic lock aceita flexão equivalente da mesma família semântica', () => {
  const before = 'A exposição esteve associada a menor mortalidade.'
  const after = 'Observou-se associação da exposição com menor mortalidade.'
  const result = validateScientificRewrite(before, after)
  assert.equal(result.ok, true)
})

test('semantic lock bloqueia número novo', () => {
  const before = 'Foram avaliados 120 pacientes.'
  const after = 'Foram avaliados 120 pacientes, com mortalidade de 18%.'
  const result = validateScientificRewrite(before, after)
  assert.equal(result.ok, false)
  assert.deepEqual(result.metrics.addedNumbers, ['18%'])
})

test('semantic lock bloqueia remoção de citação', () => {
  const before = 'O achado foi descrito previamente (Silva et al., 2024).'
  const after = 'O achado foi descrito previamente.'
  const result = validateScientificRewrite(before, after)
  assert.equal(result.ok, false)
  assert.ok(result.metrics.missingCitations.length > 0)
})

test('semantic lock bloqueia troca associação por causalidade', () => {
  const before = 'A exposição esteve associada ao desfecho.'
  const after = 'A exposição causou o desfecho.'
  const result = validateScientificRewrite(before, after)
  assert.equal(result.ok, false)
  assert.ok(result.metrics.changedDirectionTerms.includes('-associacao'))
  assert.ok(result.metrics.changedDirectionTerms.includes('+causalidade'))
})

test('semantic lock bloqueia reescrita que expande demais', () => {
  const before = 'A amostra foi pequena e o resultado deve ser interpretado com cautela.'
  const after = `${before} Este texto adiciona uma grande quantidade de conteúdo novo que não fazia parte do rascunho original e amplia de forma desnecessária a interpretação, a contextualização e as implicações possíveis.`
  const result = validateScientificRewrite(before, after)
  assert.equal(result.ok, false)
  assert.ok(result.metrics.wordRatio > 1.25)
})
