import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routePath = new URL('../../app/api/ia/gerar-secao/route.ts', import.meta.url)

async function routeSource() {
  return readFile(routePath, 'utf8')
}

test('gerar-secao importa auditoria pós-geração da Discussão', async () => {
  const source = await routeSource()
  assert(source.includes('auditGeneratedDiscussion'))
  assert(source.includes('discussionAuditMetadata'))
})

test('duas passagens auditam Discussão antes de persistir', async () => {
  const source = await routeSource()
  const anchor = 'const validado = posProcessarTextoGerado(safe.selectedText, referencias, formato)'
  const start = source.indexOf(anchor)
  assert(start >= 0)
  const block = source.slice(start, start + 2200)
  assert(block.includes('auditarDiscussaoAntesDePersistir(validado)'))
  assert(block.includes('respostaBloqueioDiscussao(discussionAudit)'))
  assert(block.indexOf('auditarDiscussaoAntesDePersistir(validado)') < block.indexOf('persistirSecaoGerada(validado'))
})

test('single-pass audita Discussão antes de persistir', async () => {
  const source = await routeSource()
  const anchor = 'const textoUnico = await callAI'
  const start = source.indexOf(anchor)
  assert(start >= 0)
  const block = source.slice(start, start + 2200)
  assert(block.includes('auditarDiscussaoAntesDePersistir(validado)'))
  assert(source.includes("code: 'DISCUSSION_PROVENANCE_VIOLATION'"))
})

test('Discussão Research OS não cai em streaming direto não auditável', async () => {
  const source = await routeSource()
  const finalStream = source.lastIndexOf('return streamText(systemPrompt, userPrompt, false)')
  const failClosed = source.lastIndexOf('if (evidencePolicy.researchOsActive && isDiscussionSection(chaveSecao))')
  assert(failClosed >= 0)
  assert(finalStream > failClosed)
  const block = source.slice(failClosed, finalStream)
  assert(block.includes("code: 'DISCUSSION_GENERATION_FAILED_CLOSED'"))
})
