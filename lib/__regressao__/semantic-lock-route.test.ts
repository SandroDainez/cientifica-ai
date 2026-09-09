import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const route = readFileSync(resolve(process.cwd(), 'app/api/ia/gerar-secao/route.ts'), 'utf8')

test('gerar-secao importa e executa o seletor seguro de reescrita', () => {
  assert.match(route, /selectSafeScientificRewrite/)
  assert.match(route, /const safe = selectSafeScientificRewrite\(rascunho, candidato\)/)
  assert.match(route, /posProcessarTextoGerado\(safe\.selectedText/)
})

test('gerar-secao persiste auditoria do Semantic Lock', () => {
  assert.match(route, /semantic_lock:\s*semanticLock/)
  assert.match(route, /semanticLockMetadata\(safe\)/)
})

test('reescrita rejeitada não substitui silenciosamente o rascunho', () => {
  assert.match(route, /if \(!safe\.usedRewrite && candidato\)/)
  assert.doesNotMatch(route, /humanizado\s*=\s*out/)
})
