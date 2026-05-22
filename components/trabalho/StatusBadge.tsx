import { cn } from '@/lib/utils'
import type { StatusTrabalho, StatusSecao } from '@/types'

const STATUS_TRABALHO: Record<StatusTrabalho, { label: string; class: string }> = {
  em_andamento: { label: 'Em andamento', class: 'bg-blue-100 text-blue-700' },
  concluido:    { label: 'Concluído',    class: 'bg-green-100 text-green-700' },
  arquivado:    { label: 'Arquivado',    class: 'bg-gray-100 text-gray-600' },
}

const STATUS_SECAO: Record<StatusSecao, { label: string; class: string }> = {
  pendente:  { label: 'Pendente',   class: 'badge-pendente' },
  gerando:   { label: 'Gerando…',   class: 'badge-gerando' },
  gerado:    { label: 'Gerado',     class: 'badge-gerado' },
  editado:   { label: 'Editado',    class: 'badge-editado' },
  aprovado:  { label: 'Aprovado',   class: 'badge-aprovado' },
}

export function StatusBadge({ status }: { status: StatusTrabalho }) {
  const s = STATUS_TRABALHO[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', s.class)}>
      {s.label}
    </span>
  )
}

export function StatusSecaoBadge({ status }: { status: StatusSecao }) {
  const s = STATUS_SECAO[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', s.class)}>
      {s.label}
    </span>
  )
}
