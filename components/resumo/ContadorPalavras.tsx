'use client'

import { cn } from '@/lib/utils'

interface Props {
  texto: string
  min: number
  max: number
  label?: string
}

function contarPalavras(texto: string): number {
  return texto.trim() === '' ? 0 : texto.trim().split(/\s+/).length
}

export function ContadorPalavras({ texto, min, max, label }: Props) {
  const total = contarPalavras(texto)
  const pct = Math.min((total / max) * 100, 100)

  const status =
    total === 0 ? 'vazio'
    : total < min ? 'abaixo'
    : total > max ? 'acima'
    : 'ok'

  const cor = {
    vazio: 'bg-gray-200',
    abaixo: 'bg-yellow-400',
    ok: 'bg-green-500',
    acima: 'bg-red-500',
  }[status]

  const textoCor = {
    vazio: 'text-gray-400',
    abaixo: 'text-yellow-600',
    ok: 'text-green-600',
    acima: 'text-red-600',
  }[status]

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        {label && <span className="text-muted-foreground">{label}</span>}
        <span className={cn('font-medium ml-auto', textoCor)}>
          {total} palavra{total !== 1 ? 's' : ''}
          {' '}<span className="text-muted-foreground font-normal">({min}–{max})</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', cor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {status === 'acima' && (
        <p className="text-xs text-red-600">
          Excede o limite em {total - max} palavra{total - max !== 1 ? 's' : ''}.
        </p>
      )}
      {status === 'abaixo' && total > 0 && (
        <p className="text-xs text-yellow-600">
          Faltam {min - total} palavra{min - total !== 1 ? 's' : ''} para atingir o mínimo.
        </p>
      )}
    </div>
  )
}
