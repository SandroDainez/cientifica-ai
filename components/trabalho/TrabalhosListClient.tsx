'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { TrabalhoCard } from './TrabalhoCard'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { Trabalho } from '@/types'

interface TrabalhosListClientProps {
  trabalhos: Array<{ trabalho: Trabalho; totalFases: number }>
}

export function TrabalhosListClient({ trabalhos }: TrabalhosListClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Estado do modal de confirmação de exclusão
  const [pendingDelete, setPendingDelete] = useState<Trabalho | null>(null)
  const [deletando, setDeletando] = useState(false)

  // ── Arquivar ────────────────────────────────────────────────────────────────

  async function handleArquivar(id: string) {
    try {
      const res = await fetch(`/api/trabalhos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'arquivado' }),
      })
      if (!res.ok) throw new Error('Erro ao arquivar')
      toast.success('Trabalho arquivado.')
      startTransition(() => router.refresh())
    } catch {
      toast.error('Não foi possível arquivar o trabalho.')
    }
  }

  // ── Deletar ─────────────────────────────────────────────────────────────────

  async function handleConfirmarDelete() {
    if (!pendingDelete) return
    setDeletando(true)
    try {
      const res = await fetch(`/api/trabalhos/${pendingDelete.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao excluir')
      toast.success('Trabalho excluído permanentemente.')
      setPendingDelete(null)
      startTransition(() => router.refresh())
    } catch {
      toast.error('Não foi possível excluir o trabalho. Tente novamente.')
    } finally {
      setDeletando(false)
    }
  }

  return (
    <>
      {/* Grid de cards */}
      <div className={cn('grid sm:grid-cols-2 xl:grid-cols-3 gap-4', isPending && 'opacity-60 pointer-events-none')}>
        {trabalhos.map(({ trabalho, totalFases }) => (
          <TrabalhoCard
            key={trabalho.id}
            trabalho={trabalho}
            totalFases={totalFases}
            onArquivar={handleArquivar}
            onDeletar={setPendingDelete}
          />
        ))}
      </div>

      {/* Modal de confirmação de exclusão */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => {
            if (e.target === e.currentTarget && !deletando) setPendingDelete(null)
          }}
        >
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            {/* Ícone + título */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Excluir trabalho?
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Esta ação é <span className="font-medium text-foreground">permanente e irreversível</span>.
                  Todos os dados, seções geradas e referências serão perdidos.
                </p>
              </div>
            </div>

            {/* Nome do trabalho */}
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {pendingDelete.titulo || 'Trabalho sem título'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingDelete.fases_concluidas.length} seção(ões) gerada(s) serão apagadas
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deletando}
                className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarDelete}
                disabled={deletando}
                className={cn(
                  buttonVariants({ variant: 'destructive' }),
                  'flex-1 gap-2'
                )}
              >
                {deletando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Excluir definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
