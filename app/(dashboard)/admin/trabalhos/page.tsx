import { createAdminClient } from '@/lib/supabase/admin'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import type { TipoTrabalho, StatusTrabalho } from '@/types'

export const dynamic = 'force-dynamic'

const statusLabel: Record<StatusTrabalho, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
}

const statusClass: Record<StatusTrabalho, string> = {
  em_andamento: 'bg-blue-900/50 text-blue-300',
  concluido:    'bg-teal-900/50 text-teal-300',
  arquivado:    'bg-slate-800/80 text-slate-400',
}

export default async function AdminTrabalhosPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string; tipo?: string; status?: string }>
}) {
  const { usuario, tipo, status } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('trabalhos')
    .select('id, titulo, tipo_trabalho, status, fase_atual, fases_concluidas, created_at, updated_at, usuario_id, profiles:usuario_id(nome, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (usuario) query = query.eq('usuario_id', usuario)
  if (tipo)    query = query.eq('tipo_trabalho', tipo)
  if (status)  query = query.eq('status', status)

  const { data: trabalhos } = await query

  // Total de fases por tipo para calcular progresso
  const { data: fluxosData } = await supabase
    .from('trabalhos')
    .select('tipo_trabalho, fases_concluidas')

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trabalhos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {usuario ? 'Trabalhos deste usuário.' : 'Todos os trabalhos da plataforma.'}{' '}
            {trabalhos?.length ?? 0} resultado(s).
          </p>
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Link
            href="/admin/trabalhos"
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              !status && !tipo ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground border-border hover:bg-accent'
            }`}
          >
            Todos
          </Link>
          {(['em_andamento', 'concluido', 'arquivado'] as StatusTrabalho[]).map(s => (
            <Link
              key={s}
              href={`/admin/trabalhos?status=${s}${usuario ? `&usuario=${usuario}` : ''}`}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground border-border hover:bg-accent'
              }`}
            >
              {statusLabel[s]}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden glow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trabalho</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Seções</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Atualizado</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!trabalhos?.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum trabalho encontrado.
                  </td>
                </tr>
              ) : trabalhos.map(t => {
                const perfil = t.profiles as { nome?: string; email?: string } | null
                const fasesConcluidas = Array.isArray(t.fases_concluidas) ? t.fases_concluidas.length : 0
                const st = t.status as StatusTrabalho

                return (
                  <tr key={t.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[200px]">
                        {t.titulo || <span className="text-muted-foreground italic">Sem título</span>}
                      </p>
                      <p className="text-xs text-muted-foreground md:hidden">{perfil?.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-foreground truncate max-w-[150px]">{perfil?.nome || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">{perfil?.email || '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {getTipoLabel(t.tipo_trabalho as TipoTrabalho)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${statusClass[st] ?? 'bg-slate-800 text-slate-400'}`}>
                        {statusLabel[st] ?? st}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-muted-foreground">
                      {fasesConcluidas} seções
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/trabalhos/${t.id}/visualizar`}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors inline-flex"
                        title="Visualizar trabalho"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
