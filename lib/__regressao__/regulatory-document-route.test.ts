import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routePath = new URL('../../app/api/trabalhos/[id]/research-os/regulatory-evidence/document/route.ts', import.meta.url)
const migrationPath = new URL('../../supabase/migrations/20260909150500_research_regulatory_documents.sql', import.meta.url)

async function routeSource() {
  return readFile(routePath, 'utf8')
}

test('upload regulatório calcula SHA-256 no servidor', async () => {
  const source = await routeSource()
  assert(source.includes("createHash('sha256')"))
  assert(source.includes("digest('hex')"))
})

test('upload usa bucket privado dedicado e path isolado por usuário/projeto', async () => {
  const source = await routeSource()
  assert(source.includes("const BUCKET = 'research-regulatory-documents'"))
  assert(source.includes('`${user.id}/${id}/${route}/${sha256}-${fileName}`'))
  assert(source.includes('.from(BUCKET)'))
  assert(source.includes('.upload(storagePath, bytes'))
})

test('upload restringe formato e tamanho do documento', async () => {
  const source = await routeSource()
  assert(source.includes("'application/pdf'"))
  assert(source.includes("'image/png'"))
  assert(source.includes("'image/jpeg'"))
  assert(source.includes('10 * 1024 * 1024'))
})

test('migration cria bucket privado com RLS por auth.uid no primeiro segmento', async () => {
  const source = await readFile(migrationPath, 'utf8')
  assert(source.includes("'research-regulatory-documents'"))
  assert(source.includes('false'))
  assert(source.includes('(storage.foldername(name))[1] = (select auth.uid())::text'))
  assert(source.includes('for insert'))
  assert(source.includes('for select'))
})
