import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── PATCH /api/trabalhos/[id] ─────────────────────────────────────────────────
// Atualiza campos do trabalho (ex: status para arquivar)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // Valida ownership
  const { data: trabalho } = await supabase
    .from('trabalhos')
    .select('id')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const { error } = await supabase
    .from('trabalhos')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('[PATCH /api/trabalhos/[id]]', error)
    return NextResponse.json({ error: 'Erro ao atualizar trabalho' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE /api/trabalhos/[id] ────────────────────────────────────────────────
// Exclui permanentemente o trabalho e todos os dados relacionados

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  // Valida ownership antes de qualquer exclusão
  const { data: trabalho } = await supabase
    .from('trabalhos')
    .select('id')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  // Exclui registros dependentes (caso FK sem CASCADE no banco)
  await supabase.from('secoes_trabalho').delete().eq('trabalho_id', id)
  await supabase.from('referencias').delete().eq('trabalho_id', id)

  // Exclui o trabalho em si
  const { error } = await supabase
    .from('trabalhos')
    .delete()
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('[DELETE /api/trabalhos/[id]]', error)
    return NextResponse.json({ error: 'Erro ao excluir trabalho' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
