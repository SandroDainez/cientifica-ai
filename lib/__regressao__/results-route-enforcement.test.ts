import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routePath = new URL('../../app/api/ia/gerar-secao/route.ts', import.meta.url)

async function routeSource() {
  return readFile(routePath, 'utf8')
}

test('gerar-secao importa o enforcement pós-geração de Resultados', async () => {
  const source = await routeSource()
  assert(source.includes('enforceGeneratedResults'))
  assert(source.includes('resultsEnforcementMetadata'))
})

test('duas passagens validam Resultados antes de persistir', async () => {
  const source = await routeSource()
  const anchor = 'const validado = posProcessarTextoGerado(safe.selectedText, referencias, formato)'
  const start = source.indexOf(anchor)
  assert(start >= 0)
  const block = source.slice(start, start + 1400)
  assert(block.includes('validarResultadosAntesDePersistir(validado)'))
  assert(block.includes('respostaBloqueioResultados(resultsEnforcement)'))
  assert(block.indexOf('validarResultadosAntesDePersistir(validado)') < block.indexOf('persistirSecaoGerada(validado'))
})

test('single-pass valida Resultados antes de persistir', async () => {
  const source = await routeSource()
  const anchor = 'const textoUnico = await callAI'
  const start = source.indexOf(anchor)
  assert(start >= 0)
  const block = source.slice(start, start + 1600)
  assert(block.includes('validarResultadosAntesDePersistir(validado)'))
  assert(block.includes("code: 'RESULT_FACT_LOCK_VIOLATION'" ) || source.includes("code: 'RESULT_FACT_LOCK_VIOLATION'"))
})

test('Resultados nunca caem no streaming direto não auditável', async () => {
  const source = await routeSource()
  const finalStream = source.lastIndexOf('return streamText(systemPrompt, userPrompt, false)')
  const failClosed = source.lastIndexOf("if (isResultsSection(chaveSecao))")
  assert(failClosed >= 0)
  assert(finalStream > failClosed)
  const block = source.slice(failClosed, finalStream)
  assert(block.includes("code: 'RESULTS_GENERATION_FAILED_CLOSED'"))
})
