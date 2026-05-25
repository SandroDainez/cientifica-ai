import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json() as {
    dados_projeto?: unknown
    documentos_projeto?: Record<string, string>
  }
  const { dados_projeto, documentos_projeto } = body

  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho, usuario_id')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const dados_trabalho_atual = (existing.dados_trabalho as Record<string, unknown>) ?? {}
  const updates: Record<string, unknown> = { ...dados_trabalho_atual }

  if (dados_projeto !== undefined) {
    updates.dados_projeto = dados_projeto
  }

  if (documentos_projeto !== undefined) {
    // Merge: preserve existing docs, replace only keys sent in this request
    const existingDocs = (dados_trabalho_atual.documentos_projeto as Record<string, string>) ?? {}
    updates.documentos_projeto = { ...existingDocs, ...documentos_projeto }
  }

  await supabase
    .from('trabalhos')
    .update({
      dados_trabalho: updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('usuario_id', user.id)

  return NextResponse.json({ ok: true })
}
