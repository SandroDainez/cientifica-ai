'use client'

import { CheckCircle2, Circle, ChevronRight, Lock, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FaseConfig, SecaoTrabalho } from '@/types'

interface SidebarProps {
  fases: FaseConfig[]
  faseAtual: string
  fasesConcluidas: string[]
  onSelectFase?: (chave: string) => void
  progressoGeral: number
  secoes?: SecaoTrabalho[]
}

export function Sidebar({ fases, faseAtual, fasesConcluidas, onSelectFase, progressoGeral }: SidebarProps) {
  const faseAtualIdx = fases.findIndex(f => f.chave_secao === faseAtual)
  const proximaFase = fases[faseAtualIdx + 1]

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col border-r bg-sidebar h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto scrollbar-thin">

      {/* ── Progresso geral ──────────────────────────────────── */}
      <div className="p-4 border-b space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seu progresso</span>
          <span className="text-sm font-bold text-primary">{progressoGeral}%</span>
        </div>
        <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
          <div
            className="gradient-brand h-2.5 rounded-full transition-all duration-700"
            style={{ width: `${progressoGeral}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {fasesConcluidas.length === 0
            ? 'Você está começando — ótimo!'
            : fasesConcluidas.length === fases.length
            ? '🎉 Trabalho concluído!'
            : `${fasesConcluidas.length} de ${fases.length} seções concluídas`}
        </p>

        {/* Próximo passo quando há fase ativa */}
        {proximaFase && fasesConcluidas.length < fases.length && (
          <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
            <p className="text-[11px] text-primary/70 font-medium uppercase tracking-wide mb-0.5">Próxima seção</p>
            <p className="text-xs font-semibold text-primary truncate">{proximaFase.nome}</p>
          </div>
        )}
      </div>

      {/* ── Lista de fases ───────────────────────────────────── */}
      <nav className="flex-1 p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Seções do trabalho
        </p>
        <ul className="space-y-0.5">
          {fases.map((fase, idx) => {
            const concluida = fasesConcluidas.includes(fase.chave_secao)
            const ativa = faseAtual === fase.chave_secao
            const acessivel = idx === 0 || fasesConcluidas.includes(fases[idx - 1]?.chave_secao)
            const bloqueada = !acessivel && !concluida

            return (
              <li key={fase.id}>
                <button
                  onClick={() => acessivel && onSelectFase?.(fase.chave_secao)}
                  disabled={bloqueada}
                  title={bloqueada ? `Conclua "${fases[idx - 1]?.nome}" para desbloquear` : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-all',
                    ativa && 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/20',
                    !ativa && concluida && 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950',
                    !ativa && !concluida && acessivel && 'text-foreground hover:bg-accent',
                    bloqueada && 'text-muted-foreground/40 cursor-not-allowed',
                  )}
                >
                  {/* Número + ícone de status */}
                  <span className="shrink-0 relative">
                    {concluida ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                    ) : ativa ? (
                      // Círculo pulsante para a seção ativa
                      <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-30" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-primary/80 items-center justify-center">
                          <span className="text-[9px] text-white font-bold">{idx + 1}</span>
                        </span>
                      </span>
                    ) : bloqueada ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/30" />
                    ) : (
                      <span className="flex h-4 w-4 rounded-full border border-muted-foreground/30 items-center justify-center">
                        <span className="text-[9px] text-muted-foreground font-medium">{idx + 1}</span>
                      </span>
                    )}
                  </span>

                  {/* Nome + meta-info */}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{fase.nome}</span>
                    {ativa && fase.tempo_estimado_minutos && (
                      <span className="flex items-center gap-1 text-[11px] text-primary/60 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        ~{fase.tempo_estimado_minutos} min
                      </span>
                    )}
                  </span>

                  {ativa && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Dica de uso ─────────────────────────────────────── */}
      <div className="p-4 border-t">
        <div className="rounded-lg bg-muted/60 px-3 py-2.5 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Como funciona</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Complete cada seção em ordem. Use a IA para gerar um rascunho e valide antes de avançar.
          </p>
        </div>
      </div>
    </aside>
  )
}
