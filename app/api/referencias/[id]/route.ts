import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Garante que a referência pertence a um trabalho do usuário
  const { data: ref } = await supabase
    .from('referencias')
    .select('trabalho_id')
    .eq('id', id)
    .single()

  if (ref) {
    const { data: trabalho } = await supabase
      .from('trabalhos').select('id').eq('id', ref.trabalho_id).eq('usuario_id', user.id).single()
    if (!trabalho) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { error } = await supabase.from('referencias').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
