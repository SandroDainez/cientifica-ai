import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; coleta_id: string }> }
) {
  const { id, coleta_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', id).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await supabase.from('coleta_dados').delete().eq('id', coleta_id).eq('trabalho_id', id)
  return NextResponse.json({ ok: true })
}
