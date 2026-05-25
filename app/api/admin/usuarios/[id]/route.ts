import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/is-admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id } = await params
  const { acao } = await request.json() as { acao: 'bloquear' | 'desbloquear' | 'liberar_beta' | 'revogar_beta' }

  const admin = createAdminClient()

  if (acao === 'bloquear') {
    // 876600h ≈ 100 anos = banido permanentemente
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: '876600h',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (acao === 'desbloquear') {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: 'none',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (acao === 'liberar_beta') {
    const { error } = await admin.from('profiles').update({ acesso_beta: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (acao === 'revogar_beta') {
    const { error } = await admin.from('profiles').update({ acesso_beta: false }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
