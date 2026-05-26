'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2 } from 'lucide-react'
import { TipoTrabalhoIcon, getTipoLabel } from './TipoTrabalhoIcon'
import type { TipoTrabalho } from '@/types'

interface TipoTrabalhoCardProps {
  tipo: TipoTrabalho
  selected: boolean
  onClick: () => void
  duracao?: number
}

export function TipoTrabalhoCard({ tipo, selected, onClick, duracao }: TipoTrabalhoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full text-left rounded-xl border-2 p-4 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-white hover:border-primary/40'
      )}
    >
      {selected && (
        <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
      )}
      <TipoTrabalhoIcon tipo={tipo} size="md" />
      <p className="mt-3 text-sm font-semibold text-gray-900 leading-tight">
        {getTipoLabel(tipo)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
        {DESCRICOES[tipo]}
      </p>
      {duracao && (
        <p className="mt-2 text-xs text-primary font-medium">~{duracao}h estimadas</p>
      )}
    </button>
  )
}

const DESCRICOES: Record<TipoTrabalho, string> = {
  tcc:                  'Requisito final da graduação. Do tema à defesa.',
  artigo_original:      'Pesquisa inédita com hipótese, método e resultados.',
  artigo_revisao:       'Síntese crítica da literatura sobre um tema.',
  relato_caso:          'Descrição detalhada de caso clínico incomum.',
  monografia:           'Trabalho de especialização ou pós-graduação lato sensu.',
  dissertacao_mestrado: 'Pesquisa aprofundada para o grau de Mestre.',
  tese_doutorado:       'Contribuição original para o conhecimento científico.',
  revisao_sistematica:  'Revisão com protocolo PRISMA e análise estruturada.',
  projeto_pesquisa:     'Proposta detalhada de pesquisa futura para financiamento.',
  relatorio_ic:         'Relatório de Iniciação Científica para agências de fomento.',
}
