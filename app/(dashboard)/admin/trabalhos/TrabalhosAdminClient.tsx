'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Eye, Unlock, Lock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import type { TipoTrabalho, StatusTrabalho } from '@/types'

interface TrabalhoAdmin {
  id: string
  titulo?: string
  tipo_trabalho: string
  status: string
  fases_concluidas: number
  updated_at: string
  liberado: boolean
  usuario_nome?: string
  usuario_email?: string
}

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

export function TrabalhosAdminClient({ trabalhos: inicial, filtrosUrl }: {
  trabalhos: TrabalhoAdmin[]
  filtrosUrl: string
}) {
  const [trabalhos, setTrabalhos] = useState(inicial)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function toggleLiberar(id: string, liberadoAtual: boolean) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/admin/trabalhos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liberado: !liberadoAtual }),
      })
      if (!res.ok) throw new Error()
      setTrabalhos(prev => prev.map(t => t.id === id ? { ...t, liberado: !t.liberado } : t))
      toast.success(liberadoAtual ? 'Exportação bloqueada.' : 'Trabalho liberado para exportar!')
    } catch {
      toast.error('Erro ao alterar acesso.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden glow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trabalho</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Tipo</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exportar</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Atualizado</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trabalhos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum trabalho encontrado.
                </td>
              </tr>
            ) : trabalhos.map(t => {
              const st = t.status as StatusTrabalho
              return (
                <tr key={t.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-[180px]">
                      {t.titulo || <span className="text-muted-foreground italic text-xs">Sem título</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.fases_concluidas} seções</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-foreground truncate max-w-[140px]">{t.usuario_nome || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">{t.usuario_email || '—'}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {getTipoLabel(t.tipo_trabalho as TipoTrabalho)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${statusClass[st] ?? 'bg-slate-800 text-slate-400'}`}>
                      {statusLabel[st] ?? st}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.liberado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-900/50 text-teal-300">
                        <Unlock className="h-3 w-3" /> Liberado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-800/80 text-slate-400">
                        <Lock className="h-3 w-3" /> Bloqueado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/trabalhos/${t.id}/visualizar`}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => toggleLiberar(t.id, t.liberado)}
                        disabled={loadingId === t.id}
                        title={t.liberado ? 'Bloquear exportação' : 'Liberar exportação'}
                        className={`p-1.5 rounded-md transition-colors ${
                          t.liberado
                            ? 'text-slate-400 hover:text-red-400 hover:bg-red-900/20'
                            : 'text-teal-400 hover:bg-teal-900/30'
                        }`}
                      >
                        {loadingId === t.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : t.liberado
                            ? <Lock className="h-3.5 w-3.5" />
                            : <Unlock className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
