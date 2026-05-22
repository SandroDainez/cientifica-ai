'use client'

import { CheckCircle2, XCircle, AlertTriangle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResultadoValidacao, SugestaoIA } from '@/types'

interface ValidadorSecaoProps {
  resultado: ResultadoValidacao
  onAplicarSugestao?: (id: string) => void
}

export function ValidadorSecao({ resultado, onAplicarSugestao }: ValidadorSecaoProps) {
  const scoreColor =
    resultado.score >= 80 ? 'text-green-600' :
    resultado.score >= 60 ? 'text-yellow-600' :
    'text-red-600'

  const scoreBg =
    resultado.score >= 80 ? 'bg-green-50 border-green-200' :
    resultado.score >= 60 ? 'bg-yellow-50 border-yellow-200' :
    'bg-red-50 border-red-200'

  return (
    <div className="space-y-3">
      {/* Score + status */}
      <div className={cn('rounded-xl border p-4 flex items-center gap-4', scoreBg)}>
        <div className="text-center shrink-0">
          <p className={cn('text-3xl font-bold', scoreColor)}>{resultado.score}</p>
          <p className="text-xs text-muted-foreground">pontos</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {resultado.aprovado
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <XCircle className="h-4 w-4 text-red-600" />
            }
            <span className="text-sm font-semibold">
              {resultado.aprovado ? 'Seção aprovada' : 'Precisa de revisão'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{resultado.comentarios}</p>
        </div>
      </div>

      {/* Sugestões */}
      {resultado.sugestoes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Sugestões da IA
          </p>
          {resultado.sugestoes.map(s => (
            <SugestaoCard key={s.id} sugestao={s} onAplicar={onAplicarSugestao} />
          ))}
        </div>
      )}
    </div>
  )
}

function SugestaoCard({
  sugestao,
  onAplicar,
}: {
  sugestao: SugestaoIA
  onAplicar?: (id: string) => void
}) {
  const { icon: Icon, color, bg } = {
    critico:    { icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
    importante: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
    sugestao:   { icon: Lightbulb,     color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  }[sugestao.tipo]

  return (
    <div className={cn('rounded-lg border p-3 space-y-1.5', bg, sugestao.aplicado && 'opacity-50')}>
      <div className="flex items-start gap-2">
        <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', color)} />
        <p className="text-xs font-semibold text-gray-900">{sugestao.titulo}</p>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed pl-5">{sugestao.descricao}</p>
      {onAplicar && !sugestao.aplicado && (
        <button
          onClick={() => onAplicar(sugestao.id)}
          className="ml-5 text-xs text-primary hover:underline"
        >
          Marcar como aplicado
        </button>
      )}
    </div>
  )
}
