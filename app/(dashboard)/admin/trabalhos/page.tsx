import { createAdminClient } from '@/lib/supabase/admin'
import { TrabalhosAdminClient } from './TrabalhosAdminClient'
import Link from 'next/link'
import type { StatusTrabalho } from '@/types'

export const dynamic = 'force-dynamic'

const statusLabel: Record<StatusTrabalho, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
}

export default async function AdminTrabalhosPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string; status?: string }>
}) {
  const { usuario, status } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('trabalhos')
    .select('id, titulo, tipo_trabalho, status, fases_concluidas, updated_at, liberado, usuario_id, profiles:usuario_id(nome, email)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (usuario) query = query.eq('usuario_id', usuario)
  if (status)  query = query.eq('status', status)

  const { data: raw } = await query

  const trabalhos = (raw ?? []).map(t => {
    const perfil = t.profiles as { nome?: string; email?: string } | null
    return {
      id: t.id,
      titulo: t.titulo,
      tipo_trabalho: t.tipo_trabalho,
      status: t.status,
      fases_concluidas: Array.isArray(t.fases_concluidas) ? t.fases_concluidas.length : 0,
      updated_at: t.updated_at,
      liberado: t.liberado ?? false,
      usuario_nome: perfil?.nome,
      usuario_email: perfil?.email,
    }
  })

  const liberados   = trabalhos.filter(t => t.liberado).length
  const bloqueados  = trabalhos.filter(t => !t.liberado).length

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trabalhos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {trabalhos.length} trabalho(s) · {liberados} liberado(s) · {bloqueados} aguardando pagamento
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Link
            href={`/admin/trabalhos${usuario ? `?usuario=${usuario}` : ''}`}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              !status ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground border-border hover:bg-accent'
            }`}
          >
            Todos
          </Link>
          {(['em_andamento', 'concluido', 'arquivado'] as StatusTrabalho[]).map(s => (
            <Link
              key={s}
              href={`/admin/trabalhos?status=${s}${usuario ? `&usuario=${usuario}` : ''}`}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                status === s ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground border-border hover:bg-accent'
              }`}
            >
              {statusLabel[s]}
            </Link>
          ))}
        </div>
      </div>

      {usuario && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrando por usuário.</span>
          <Link href="/admin/trabalhos" className="text-sm text-primary hover:underline">Limpar filtro</Link>
        </div>
      )}

      <TrabalhosAdminClient trabalhos={trabalhos} />
    </div>
  )
}
