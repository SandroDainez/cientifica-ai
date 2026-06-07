import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Archive, Eye, Download, BookMarked, Map, Trash2, Presentation } from 'lucide-react'
import { TipoTrabalhoIcon, getTipoLabel } from './TipoTrabalhoIcon'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import type { Trabalho } from '@/types'

interface TrabalhoCardProps {
  trabalho: Trabalho
  totalFases: number
  onArquivar?: (id: string) => void
  onDeletar?: (trabalho: Trabalho) => void
}

export function TrabalhoCard({ trabalho, totalFases, onArquivar, onDeletar }: TrabalhoCardProps) {
  const progresso = totalFases > 0
    ? Math.round((trabalho.fases_concluidas.length / totalFases) * 100)
    : 0

  // Status exibido: se o progresso chegou a 100%, mostra "Concluído" mesmo que o
  // status salvo ainda esteja "em andamento" (corrige trabalhos antigos sem novo
  // salvamento). Não sobrescreve "arquivado".
  const statusExibido =
    trabalho.status !== 'arquivado' && progresso >= 100 ? 'concluido' : trabalho.status

  const atualizado = formatDistanceToNow(new Date(trabalho.updated_at), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <div className="card-trabalho bg-card border rounded-xl p-5 flex flex-col gap-4 glow-card">
      {/* Header */}
      <div className="flex items-start gap-3">
        <TipoTrabalhoIcon tipo={trabalho.tipo_trabalho} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate text-sm leading-snug">
            {trabalho.titulo || 'Trabalho sem título'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getTipoLabel(trabalho.tipo_trabalho)}
          </p>
        </div>
        <StatusBadge status={statusExibido} />
      </div>

      {/* Progresso */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span>{trabalho.fases_concluidas.length}/{totalFases} seções</span>
        </div>
        <ProgressBar value={progresso} size="sm" />
      </div>

      {/* Footer */}
      <div className="pt-1 border-t border-border/60 space-y-2">
        {/* Linha de ações */}
        <div className="flex items-center justify-between">
          {/* Ícones secundários */}
          <div className="flex items-center gap-0.5">
            {onArquivar && trabalho.status !== 'arquivado' && (
              <button
                onClick={() => onArquivar(trabalho.id)}
                title="Arquivar"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            )}
            <Link href={`/trabalhos/${trabalho.id}/referencias`} title="Referências"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
              <BookMarked className="h-3.5 w-3.5" />
            </Link>
            <Link href={`/trabalhos/${trabalho.id}/visualizar`} title="Visualizar"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
              <Eye className="h-3.5 w-3.5" />
            </Link>
            <Link href={`/trabalhos/${trabalho.id}/apresentacao`} title="Gerar Slides"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
              <Presentation className="h-3.5 w-3.5" />
            </Link>
            <Link href={`/trabalhos/${trabalho.id}/exportar`} title="Exportar"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
              <Download className="h-3.5 w-3.5" />
            </Link>
            {onDeletar && (
              <button onClick={() => onDeletar(trabalho)} title="Excluir trabalho"
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Botões principais */}
          <div className="flex items-center gap-1.5">
            <Link
              href={`/trabalhos/${trabalho.id}/projeto`}
              title="Plano do Projeto — roadmap, checklists e documentos"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Map className="h-3.5 w-3.5" />
              Projeto
            </Link>
            <Link
              href={`/trabalhos/${trabalho.id}/editar`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Continuar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">Atualizado {atualizado}</p>
      </div>
    </div>
  )
}
