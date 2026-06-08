'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, AlertTriangle, Trash2, ChevronDown, ChevronUp, Loader2, PencilLine } from 'lucide-react'
import { auditarReferencias } from '@/lib/revisao/auditar-referencias'
import type { Referencia, FormatoCitacao } from '@/types'

interface Props {
  trabalhoId: string
  referencias: Referencia[]
  /** Corpo completo do trabalho (todas as seções concatenadas) para cruzar citações. */
  corpo: string
  formato: FormatoCitacao
}

const SEVERIDADE_COR: Record<'alta' | 'media', string> = {
  alta: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40',
  media: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
}

export function PainelRevisaoConsistencia({ trabalhoId, referencias, corpo, formato }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [removidos, setRemovidos] = useState<Set<string>>(new Set())

  const anoAtual = new Date().getFullYear()
  const issues = useMemo(
    () => auditarReferencias(referencias, corpo, formato, anoAtual).filter(i => !removidos.has(i.referenciaId)),
    [referencias, corpo, formato, anoAtual, removidos],
  )

  async function remover(referenciaId: string) {
    setRemovendo(referenciaId)
    try {
      const res = await fetch(`/api/trabalhos/${trabalhoId}/remover-referencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenciaId }),
      })
      const data = (await res.json()) as { ok?: boolean; restaramManuais?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Falha ao remover')
      setRemovidos(prev => new Set(prev).add(referenciaId))
      if (data.restaramManuais) {
        toast.warning('Referência removida da lista. Restaram citações no texto que precisam de revisão manual.')
      } else {
        toast.success('Referência e suas citações removidas com segurança.')
      }
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover.')
    } finally {
      setRemovendo(null)
    }
  }

  if (issues.length === 0) {
    return (
      <div className="no-print rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-4 flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
        <ShieldCheck className="h-5 w-5 flex-shrink-0" />
        Revisão de consistência: nenhuma referência problemática encontrada.
      </div>
    )
  }

  return (
    <div className="no-print rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          Revisão de Consistência — {issues.length} {issues.length === 1 ? 'item a verificar' : 'itens a verificar'}
        </span>
        {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            O app aponta abaixo o que <strong>não deveria estar</strong> no trabalho. Você decide o que remover —
            a remoção é feita <strong>sem danificar o texto</strong> (apaga só a citação parentética da referência).
          </p>
          {issues.map(issue => (
            <div key={`${issue.referenciaId}-${issue.tipo}`} className={`rounded-lg border p-3 ${SEVERIDADE_COR[issue.severidade]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground break-words">{issue.rotulo}</p>
                  <p className="text-xs text-foreground/80 mt-0.5">{issue.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-1"><strong>Como resolver:</strong> {issue.comoResolver}</p>
                </div>
                <div className="flex-shrink-0">
                  {issue.removivelComSeguranca ? (
                    <button
                      type="button"
                      onClick={() => remover(issue.referenciaId)}
                      disabled={removendo === issue.referenciaId}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      {removendo === issue.referenciaId
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removendo</>
                        : <><Trash2 className="h-3.5 w-3.5" /> Remover</>}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium bg-muted border border-border text-muted-foreground" title="Citada no texto de forma que a remoção automática quebraria a frase — edite no Editor.">
                      <PencilLine className="h-3.5 w-3.5" /> Revisar manual
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
