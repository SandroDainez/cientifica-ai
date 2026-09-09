import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routePath = new URL('../../app/api/ia/gerar-secao/route.ts', import.meta.url)

async function source() {
  return readFile(routePath, 'utf8')
}

test('gerar-secao importa Manuscript Claim Audit', async () => {
  const text = await source()
  assert(text.includes('auditManuscriptClaims'))
  assert(text.includes('manuscriptClaimAuditMetadata'))
})

test('duas passagens auditam claims antes de persistir', async () => {
  const text = await source()
  const anchor = 'const validado = posProcessarTextoGerado(safe.selectedText, referencias, formato)'
  const start = text.indexOf(anchor)
  assert(start >= 0)
  const block = text.slice(start, start + 2600)
  assert(block.includes('auditarClaimsAntesDePersistir(validado)'))
  assert(block.includes('respostaBloqueioClaims(manuscriptClaimAudit)'))
  assert(block.indexOf('auditarClaimsAntesDePersistir(validado)') < block.indexOf('persistirSecaoGerada(validado'))
})

test('single-pass também audita claims antes de persistir', async () => {
  const text = await source()
  const anchor = 'const textoUnico = await callAI'
  const start = text.indexOf(anchor)
  assert(start >= 0)
  const block = text.slice(start, start + 3000)
  assert(block.includes('auditarClaimsAntesDePersistir(validado)'))
  assert(block.includes("code: 'MANUSCRIPT_CLAIM_AUDIT_VIOLATION'") || text.includes("code: 'MANUSCRIPT_CLAIM_AUDIT_VIOLATION'"))
})

test('Conclusão Research OS não cai em streaming direto sem auditoria', async () => {
  const text = await source()
  const finalStream = text.lastIndexOf('return streamText(systemPrompt, userPrompt, false)')
  const failClosed = text.lastIndexOf('if (evidencePolicy.researchOsActive && isManuscriptClaimAuditSection(chaveSecao))')
  assert(failClosed >= 0)
  assert(finalStream > failClosed)
  const block = text.slice(failClosed, finalStream)
  assert(block.includes("code: 'MANUSCRIPT_CLAIM_AUDIT_FAILED_CLOSED'"))
})
