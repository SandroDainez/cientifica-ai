'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'
import type { SecaoTrabalho, FaseConfig } from '@/types'

interface Props {
  fases: FaseConfig[]
  secoes: SecaoTrabalho[]
  className?: string
}

export function ProgressoTrabalho({ fases, secoes, className }: Props) {
  const total = fases.length
  const concluidas = fases.filter(f =>
    secoes.some(s => (s.chave_secao === f.chave_secao || s.chave_secao === f.id) && s.conteudo?.trim())
  ).length
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0

  const cor = percentual >= 80 ? 'bg-green-500' : percentual >= 40 ? 'bg-blue-500' : 'bg-yellow-400'

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900">Progresso do trabalho</span>
        <span className="text-muted-foreground">{concluidas}/{total} seções</span>
      </div>

      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', cor)}
          style={{ width: `${percentual}%` }}
        />
      </div>

      <div className="grid gap-1.5">
        {fases.map(fase => {
          const secao = secoes.find(s => s.chave_secao === fase.chave_secao || s.chave_secao === fase.id)
          const temConteudo = !!secao?.conteudo?.trim()
          return (
            <div key={fase.id} className="flex items-center gap-2">
              {temConteudo ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-gray-300 shrink-0" />
              )}
              <span className={cn('text-xs truncate', temConteudo ? 'text-gray-700' : 'text-muted-foreground')}>
                {fase.nome}
              </span>
              {temConteudo && secao?.conteudo && (
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {secao.conteudo.trim().split(/\s+/).length} pal.
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {percentual}% completo
        {percentual === 100 && ' — pronto para exportar!'}
      </p>
    </div>
  )
}
