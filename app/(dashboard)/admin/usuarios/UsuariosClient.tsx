'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Ban, CheckCircle, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Usuario {
  id: string
  nome: string
  email: string
  created_at: string
  nivel_academico?: string
  instituicao?: string
  totalTrabalhos: number
  banned: boolean
}

export function UsuariosClient({ usuarios: inicial }: { usuarios: Usuario[] }) {
  const [usuarios, setUsuarios] = useState(inicial)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const filtrados = usuarios.filter(u =>
    u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    u.email?.toLowerCase().includes(busca.toLowerCase())
  )

  async function toggleBloquear(id: string, banido: boolean) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: banido ? 'desbloquear' : 'bloquear' }),
      })
      if (!res.ok) throw new Error()

      setUsuarios(prev => prev.map(u =>
        u.id === id ? { ...u, banned: !u.banned } : u
      ))
      toast.success(banido ? 'Usuário desbloqueado.' : 'Usuário bloqueado.')
    } catch {
      toast.error('Erro ao alterar status do usuário.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Buscar por nome ou email…"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="w-full max-w-sm px-3 py-2 text-sm rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <div className="bg-card border rounded-xl overflow-hidden glow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Nível</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trabalhos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Cadastro</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : filtrados.map(u => (
                <tr key={u.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-[180px]">{u.nome || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-muted-foreground capitalize">{u.nivel_academico ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/trabalhos?usuario=${u.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {u.totalTrabalhos}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.banned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-900/50 text-red-300">
                        <Ban className="h-3 w-3" /> Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-900/50 text-teal-300">
                        <CheckCircle className="h-3 w-3" /> Ativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/trabalhos?usuario=${u.id}`}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                        title="Ver trabalhos"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => toggleBloquear(u.id, u.banned)}
                        disabled={loadingId === u.id}
                        title={u.banned ? 'Desbloquear' : 'Bloquear'}
                        className={`p-1.5 rounded-md transition-colors ${
                          u.banned
                            ? 'text-teal-400 hover:bg-teal-900/30'
                            : 'text-red-400 hover:bg-red-900/30'
                        }`}
                      >
                        {loadingId === u.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : u.banned
                            ? <CheckCircle className="h-3.5 w-3.5" />
                            : <Ban className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtrados.length} usuário(s) encontrado(s)</p>
    </div>
  )
}
