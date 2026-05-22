import { FileText, BookOpen, Microscope, GraduationCap, FlaskConical, ClipboardList, Search, Award, FolderOpen, FileBarChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TipoTrabalho } from '@/types'

const TIPOS: Record<TipoTrabalho, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  tcc:                 { icon: GraduationCap, label: 'TCC',                color: 'text-blue-600',   bg: 'bg-blue-100' },
  artigo_original:     { icon: FileText,      label: 'Artigo Original',    color: 'text-green-600',  bg: 'bg-green-100' },
  artigo_revisao:      { icon: BookOpen,      label: 'Artigo de Revisão',  color: 'text-emerald-600',bg: 'bg-emerald-100' },
  relato_caso:         { icon: ClipboardList, label: 'Relato de Caso',     color: 'text-orange-600', bg: 'bg-orange-100' },
  monografia:          { icon: FolderOpen,    label: 'Monografia',         color: 'text-indigo-600', bg: 'bg-indigo-100' },
  dissertacao_mestrado:{ icon: Award,         label: 'Dissertação',        color: 'text-violet-600', bg: 'bg-violet-100' },
  tese_doutorado:      { icon: Microscope,    label: 'Tese de Doutorado',  color: 'text-yellow-600', bg: 'bg-yellow-100' },
  revisao_sistematica: { icon: Search,        label: 'Revisão Sistemática',color: 'text-purple-600', bg: 'bg-purple-100' },
  projeto_pesquisa:    { icon: FlaskConical,  label: 'Projeto de Pesquisa',color: 'text-cyan-600',   bg: 'bg-cyan-100' },
  relatorio_ic:        { icon: FileBarChart,  label: 'Relatório IC',       color: 'text-teal-600',   bg: 'bg-teal-100' },
}

interface TipoTrabalhoIconProps {
  tipo: TipoTrabalho
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function TipoTrabalhoIcon({ tipo, size = 'md', showLabel = false }: TipoTrabalhoIconProps) {
  const t = TIPOS[tipo]
  const Icon = t.icon
  const sizes = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-10 w-10' }
  const iconSizes = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex items-center justify-center rounded-lg shrink-0', t.bg, sizes[size])}>
        <Icon className={cn(t.color, iconSizes[size])} />
      </div>
      {showLabel && <span className="text-sm font-medium text-foreground">{t.label}</span>}
    </div>
  )
}

export function getTipoLabel(tipo: TipoTrabalho): string {
  return TIPOS[tipo]?.label ?? tipo
}

export { TIPOS }
