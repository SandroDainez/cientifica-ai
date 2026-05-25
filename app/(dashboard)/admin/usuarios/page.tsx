import { createAdminClient } from '@/lib/supabase/admin'
import { UsuariosClient } from './UsuariosClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsuariosPage() {
  const supabase = createAdminClient()

  // Busca todos os perfis
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome, email, created_at, nivel_academico, instituicao, acesso_beta')
    .order('created_at', { ascending: false })

  // Busca contagem de trabalhos por usuário
  const { data: trabalhos } = await supabase
    .from('trabalhos')
    .select('usuario_id')

  // Busca usuários banidos via Auth Admin API
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  const bannedIds = new Set(
    (authUsers?.users ?? [])
      .filter(u => u.banned_until && new Date(u.banned_until) > new Date())
      .map(u => u.id)
  )

  const workCountByUser = (trabalhos ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.usuario_id] = (acc[t.usuario_id] ?? 0) + 1
    return acc
  }, {})

  const usuarios = (profiles ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    created_at: p.created_at,
    nivel_academico: p.nivel_academico,
    instituicao: p.instituicao,
    totalTrabalhos: workCountByUser[p.id] ?? 0,
    banned: bannedIds.has(p.id),
    acesso_beta: p.acesso_beta ?? false,
  }))

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {usuarios.length} usuário(s) cadastrado(s). Bloqueie ou desbloqueie acesso manualmente.
        </p>
      </div>

      <UsuariosClient usuarios={usuarios} />
    </div>
  )
}
