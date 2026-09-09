import test from 'node:test'
import assert from 'node:assert/strict'
import { selectSafeScientificRewrite, semanticLockMetadata } from '@/lib/research-os/safe-scientific-rewrite'

test('usa reescrita quando o Semantic Lock aprova', () => {
  const original = 'Em 120 pacientes, a exposição esteve associada a menor mortalidade (Silva et al., 2024).'
  const rewritten = 'Entre 120 pacientes, observou-se associação da exposição com menor mortalidade (Silva et al., 2024).'
  const result = selectSafeScientificRewrite(original, rewritten)
  assert.equal(result.usedRewrite, true)
  assert.equal(result.selectedText, rewritten)
  assert.equal(result.semanticLock.ok, true)
})

test('descarta reescrita que adiciona número', () => {
  const original = 'A exposição esteve associada a menor mortalidade (Silva et al., 2024).'
  const rewritten = 'A exposição esteve associada a menor mortalidade de 18% (Silva et al., 2024).'
  const result = selectSafeScientificRewrite(original, rewritten)
  assert.equal(result.usedRewrite, false)
  assert.equal(result.selectedText, original)
  assert.equal(result.semanticLock.ok, false)
  assert.match(result.semanticLock.reasons.join(' '), /18%/)
})

test('descarta reescrita que remove citação', () => {
  const original = 'A exposição esteve associada ao desfecho (Silva et al., 2024).'
  const rewritten = 'A exposição esteve associada ao desfecho.'
  const result = selectSafeScientificRewrite(original, rewritten)
  assert.equal(result.usedRewrite, false)
  assert.equal(result.selectedText, original)
  assert.equal(result.semanticLock.ok, false)
})

test('preserva rascunho quando reescrita está vazia', () => {
  const original = 'Texto científico preservado.'
  const result = selectSafeScientificRewrite(original, '   ')
  assert.equal(result.usedRewrite, false)
  assert.equal(result.selectedText, original)
})

test('metadados registram fallback do lock', () => {
  const original = 'Foram incluídos 100 pacientes.'
  const rewritten = 'Foram incluídos 150 pacientes.'
  const result = selectSafeScientificRewrite(original, rewritten)
  const meta = semanticLockMetadata(result)
  assert.equal(meta.applied, true)
  assert.equal(meta.approved, false)
  assert.equal(meta.rewrite_used, false)
  assert.ok(meta.reasons.length > 0)
})
