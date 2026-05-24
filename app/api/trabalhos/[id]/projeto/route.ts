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

  const { dados_projeto } = await request.json()

  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho, usuario_id')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const dados_trabalho_atual = (existing.dados_trabalho as Record<string, unknown>) ?? {}

  await supabase
    .from('trabalhos')
    .update({
      dados_trabalho: { ...dados_trabalho_atual, dados_projeto },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('usuario_id', user.id)

  return NextResponse.json({ ok: true })
}
