'use client'

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SecaoTrabalho, Referencia } from '@/types'

interface Props {
  titulo?: string
  secoes: SecaoTrabalho[]
  referencias: Referencia[]
}

interface ItemChecklist {
  id: string
  label: string
  ok: boolean
  aviso?: boolean
}

export function ChecklistFinal({ titulo, secoes, referencias }: Props) {
  const secoesComConteudo = secoes.filter(s => s.conteudo?.trim())
  const temResumo = secoes.some(s => s.chave_secao === 'resumo' && s.conteudo?.trim())
  const temPendente = secoes.some(s => s.status === 'pendente')
  const temTitulo = !!titulo?.trim()

  const itens: ItemChecklist[] = [
    {
      id: 'titulo',
      label: 'Título definitivo definido',
      ok: temTitulo,
    },
    {
      id: 'secoes',
      label: `Seções com conteúdo (${secoesComConteudo.length}/${secoes.length})`,
      ok: secoesComConteudo.length === secoes.length,
      aviso: secoesComConteudo.length > 0 && secoesComConteudo.length < secoes.length,
    },
    {
      id: 'resumo',
      label: 'Resumo e abstract presentes',
      ok: temResumo,
    },
    {
      id: 'referencias',
      label: `Referências bibliográficas (${referencias.length} cadastrada${referencias.length !== 1 ? 's' : ''})`,
      ok: referencias.length >= 5,
      aviso: referencias.length > 0 && referencias.length < 5,
    },
    {
      id: 'pendente',
      label: 'Nenhuma seção marcada como pendente',
      ok: !temPendente,
    },
  ]

  const totalOk = itens.filter(i => i.ok).length
  const percentual = Math.round((totalOk / itens.length) * 100)
  const pronto = totalOk === itens.length

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Checklist para exportação</p>
        <span className={cn(
          'text-xs font-semibold px-2 py-1 rounded-full',
          pronto ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        )}>
          {totalOk}/{itens.length} itens
        </span>
      </div>

      <div className="space-y-2">
        {itens.map(item => (
          <div key={item.id} className="flex items-center gap-2.5">
            {item.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : item.aviso ? (
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span className={cn(
              'text-sm',
              item.ok ? 'text-gray-700' : item.aviso ? 'text-yellow-700' : 'text-red-600'
            )}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Prontidão para exportação</span>
          <span className="text-xs font-semibold text-gray-700">{percentual}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', pronto ? 'bg-green-500' : 'bg-yellow-400')}
            style={{ width: `${percentual}%` }}
          />
        </div>
        {pronto && (
          <p className="text-xs text-green-600 mt-1.5 font-medium">✓ Trabalho pronto para exportação</p>
        )}
      </div>
    </div>
  )
}
