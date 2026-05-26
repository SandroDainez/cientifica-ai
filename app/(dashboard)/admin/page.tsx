import { createAdminClient } from '@/lib/supabase/admin'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import { Users, FileText, TrendingUp, CheckCircle } from 'lucide-react'
import type { TipoTrabalho } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminMetricasPage() {
  const supabase = createAdminClient()

  // eslint-disable-next-line react-hooks/purity
  const umaSemanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsuarios },
    { count: totalTrabalhos },
    { count: usuariosNovos },
    { count: trabalhosSemana },
    { data: trabalhosPorTipo },
    { data: trabalhosPorStatus },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('trabalhos').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', umaSemanaAtras),
    supabase.from('trabalhos').select('*', { count: 'exact', head: true }).gte('created_at', umaSemanaAtras),
    supabase.from('trabalhos').select('tipo_trabalho'),
    supabase.from('trabalhos').select('status'),
  ])

  // Agrupa por tipo
  const contagemTipo = (trabalhosPorTipo ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.tipo_trabalho] = (acc[t.tipo_trabalho] ?? 0) + 1
    return acc
  }, {})

  // Agrupa por status
  const contagemStatus = (trabalhosPorStatus ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  const tiposOrdenados = Object.entries(contagemTipo).sort((a, b) => b[1] - a[1])
  const maxTipo = tiposOrdenados[0]?.[1] ?? 1

  const stats = [
    { label: 'Total de usuários',  value: totalUsuarios ?? 0,   icon: Users,       color: 'text-teal-400',  bg: 'bg-teal-900/40' },
    { label: 'Total de trabalhos', value: totalTrabalhos ?? 0,  icon: FileText,    color: 'text-blue-400',  bg: 'bg-blue-900/40' },
    { label: 'Novos esta semana',  value: usuariosNovos ?? 0,   icon: TrendingUp,  color: 'text-purple-400',bg: 'bg-purple-900/40' },
    { label: 'Trabalhos criados',  value: trabalhosSemana ?? 0, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/40' },
  ]

  const statusLabel: Record<string, string> = {
    em_andamento: 'Em andamento',
    concluido: 'Concluído',
    arquivado: 'Arquivado',
  }
  const statusColor: Record<string, string> = {
    em_andamento: 'bg-blue-500',
    concluido: 'bg-teal-500',
    arquivado: 'bg-slate-500',
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma em tempo real.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border rounded-xl p-5 flex items-center gap-4 glow-card">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trabalhos por tipo */}
        <div className="bg-card border rounded-xl p-6 glow-card">
          <h2 className="text-sm font-semibold text-foreground mb-4">Trabalhos por tipo</h2>
          {tiposOrdenados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum trabalho ainda.</p>
          ) : (
            <div className="space-y-3">
              {tiposOrdenados.map(([tipo, count]) => (
                <div key={tipo}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{getTipoLabel(tipo as TipoTrabalho)}</span>
                    <span className="font-medium text-foreground">{count}</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className="gradient-brand h-1.5 rounded-full transition-all"
                      style={{ width: `${(count / maxTipo) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trabalhos por status */}
        <div className="bg-card border rounded-xl p-6 glow-card">
          <h2 className="text-sm font-semibold text-foreground mb-4">Trabalhos por status</h2>
          {Object.keys(contagemStatus).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum trabalho ainda.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(contagemStatus).map(([status, count]) => {
                const pct = totalTrabalhos ? Math.round((count / totalTrabalhos) * 100) : 0
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor[status] ?? 'bg-gray-500'}`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{statusLabel[status] ?? status}</span>
                        <span className="font-medium text-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${statusColor[status] ?? 'bg-gray-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
