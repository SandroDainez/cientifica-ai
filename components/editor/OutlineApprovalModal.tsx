'use client'

import { useEffect, useState } from 'react'
import { Loader2, ListTree, Sparkles, RefreshCw, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SubtopicoOutline {
  titulo: string
  argumento: string
  referencias: string[]
}

/** Serializa o esqueleto num texto editável (o que será enviado como outline aprovado). */
function serializar(subtopicos: SubtopicoOutline[]): string {
  return subtopicos
    .map((s, i) => {
      const fontes = s.referencias?.length ? `\n   Fontes: ${s.referencias.join('; ')}` : ''
      const arg = s.argumento?.trim() ? `\n   ${s.argumento.trim()}` : ''
      return `${i + 1}. ${s.titulo.trim()}${arg}${fontes}`
    })
    .join('\n\n')
}

interface Props {
  nomeSecao: string
  /** true enquanto o esqueleto está sendo gerado pela IA. */
  gerando: boolean
  subtopicos: SubtopicoOutline[]
  onAprovar: (textoEditado: string) => void
  onPular: () => void
  onRegenerar: () => void
  onCancelar: () => void
}

/**
 * Fase 2 do método-professor: mostra o ESQUELETO (subtópicos + fontes) da seção para
 * o usuário aprovar/editar ANTES da prosa. Texto editável → vira o outline aprovado.
 */
export default function OutlineApprovalModal({ nomeSecao, gerando, subtopicos, onAprovar, onPular, onRegenerar, onCancelar }: Props) {
  const [texto, setTexto] = useState('')

  // Quando o esqueleto chega (ou regenera), preenche o textarea editável.
  useEffect(() => {
    if (!gerando && subtopicos.length > 0) setTexto(serializar(subtopicos))
  }, [gerando, subtopicos])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancelar}>
      <div className="w-full max-w-2xl rounded-xl bg-background border border-border shadow-xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border">
          <p className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ListTree className="h-5 w-5 text-primary" /> Esqueleto da seção · {nomeSecao}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Como um orientador: primeiro o <strong>plano</strong> (subtópicos e as fontes que sustentam cada um). Revise, ajuste se quiser, e só então a IA escreve a prosa <strong>em cima do que você aprovou</strong>.
          </p>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {gerando ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Planejando o esqueleto da seção…
            </div>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <PencilLine className="h-3.5 w-3.5" /> Você pode editar livremente o plano abaixo antes de aprovar.
              </p>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </>
          )}
        </div>

        <div className="p-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onCancelar}>Cancelar</Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRegenerar} disabled={gerando}>
              <RefreshCw className="h-4 w-4" /> Refazer plano
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onPular} disabled={gerando}>Escrever sem esqueleto</Button>
            <Button size="sm" className="gap-1.5" onClick={() => onAprovar(texto)} disabled={gerando || !texto.trim()}>
              <Sparkles className="h-4 w-4" /> Aprovar e escrever
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
