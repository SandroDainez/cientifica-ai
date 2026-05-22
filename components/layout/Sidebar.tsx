'use client'

import { CheckCircle2, Circle, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FaseConfig } from '@/types'

interface SidebarProps {
  fases: FaseConfig[]
  faseAtual: string
  fasesConcluidas: string[]
  onSelectFase?: (chave: string) => void
  progressoGeral: number
}

export function Sidebar({ fases, faseAtual, fasesConcluidas, onSelectFase, progressoGeral }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col border-r bg-sidebar h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto scrollbar-thin">
      {/* Progresso geral */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progresso</span>
          <span className="text-sm font-bold text-primary">{progressoGeral}%</span>
        </div>
        <div className="w-full bg-border rounded-full h-2">
          <div
            className="gradient-brand h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressoGeral}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {fasesConcluidas.length} de {fases.length} seções concluídas
        </p>
      </div>

      {/* Lista de fases */}
      <nav className="flex-1 p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">Seções</p>
        <ul className="space-y-0.5">
          {fases.map((fase, idx) => {
            const concluida = fasesConcluidas.includes(fase.chave_secao)
            const ativa = faseAtual === fase.chave_secao
            const acessivel = idx === 0 || fasesConcluidas.includes(fases[idx - 1]?.chave_secao)

            return (
              <li key={fase.id}>
                <button
                  onClick={() => acessivel && onSelectFase?.(fase.chave_secao)}
                  disabled={!acessivel}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-all',
                    ativa && 'bg-primary/10 text-primary font-medium',
                    !ativa && concluida && 'text-green-700 hover:bg-green-50',
                    !ativa && !concluida && acessivel && 'text-foreground hover:bg-accent',
                    !acessivel && 'text-muted-foreground/50 cursor-not-allowed',
                  )}
                >
                  {/* Ícone de status */}
                  <span className="shrink-0">
                    {concluida ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : ativa ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <Circle className={cn('h-4 w-4', acessivel ? 'text-muted-foreground' : 'text-muted-foreground/30')} />
                    )}
                  </span>

                  {/* Nome + estimativa */}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{fase.nome}</span>
                    {ativa && (
                      <span className="text-xs text-primary/70">~{fase.tempo_estimado_minutos} min</span>
                    )}
                  </span>

                  {ativa && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
