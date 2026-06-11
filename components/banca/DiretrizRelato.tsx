'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ClipboardCheck, Loader2, CheckCircle2, MinusCircle, XCircle, Sparkles, Bot, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ItemDiretriz {
  id: string; rotulo: string; exige: string
  status: string; nota: string; como_resolver: string; quem_resolve: string
}

/**
 * Verificador de Diretriz de Relato (EQUATOR): confere o trabalho item a item da
 * diretriz CERTA pela natureza e GUIA o autor no que falta — com modelo do que escrever,
 * marcando o que a IA completa e o que é do autor. Não deixa ninguém perdido.
 */
export function DiretrizRelato({ trabalhoId }: { trabalhoId: string }) {
  const [carregando, setCarregando] = useState(false)
  const [res, setRes] = useState<{ sigla: string; nome: string; itens: ItemDiretriz[] } | null>(null)

  async function conferir() {
    setCarregando(true)
    try {
      const r = await fetch('/api/ia/diretriz-relato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trabalhoId }),
      })
      const data = await r.json() as { ok?: boolean; sigla?: string; nome?: string; itens?: ItemDiretriz[]; error?: string }
      if (!r.ok || !data.itens?.length) throw new Error(data.error ?? 'falha')
      setRes({ sigla: data.sigla ?? '', nome: data.nome ?? '', itens: data.itens })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao conferir a diretriz.') }
    finally { setCarregando(false) }
  }

  const pendentes = res?.itens.filter(i => i.status !== 'presente').length ?? 0

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Padrão de excelência — Diretriz de relato</p>
          <p className="text-xs text-muted-foreground">
            Trabalhos reconhecidos seguem a diretriz do seu tipo (PRISMA, STROBE, CONSORT, CARE…). A IA confere o seu item a item e, no que falta, <strong>te diz exatamente o que fazer</strong> — com modelo pronto. Você não fica perdido.
          </p>
        </div>
      </div>

      {!res && (
        <Button onClick={conferir} disabled={carregando} className="gap-2">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {carregando ? 'Conferindo…' : 'Conferir padrão de excelência'}
        </Button>
      )}

      {res && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {res.nome} — {pendentes === 0 ? 'tudo presente 🎉' : `${pendentes} item(ns) a completar`}
          </p>
          {res.itens.map(it => <ItemCard key={it.id} it={it} />)}
          <Button variant="outline" size="sm" onClick={conferir} disabled={carregando} className="gap-1.5 mt-1">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Conferir de novo
          </Button>
        </div>
      )}
    </div>
  )
}

function ItemCard({ it }: { it: ItemDiretriz }) {
  const presente = it.status === 'presente'
  const parcial = it.status === 'parcial'
  return (
    <div className={cn('rounded-lg border p-3', presente ? 'border-border' : parcial ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20' : 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20')}>
      <div className="flex items-center gap-2">
        {presente ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : parcial ? <MinusCircle className="h-4 w-4 text-amber-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
        <p className="text-sm font-semibold text-foreground">{it.rotulo}</p>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{presente ? 'presente' : parcial ? 'parcial' : 'ausente'}</span>
        {!presente && (
          <span className={cn('text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 inline-flex items-center gap-1', it.quem_resolve === 'ia' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200')}>
            {it.quem_resolve === 'ia' ? <><Bot className="h-3 w-3" /> a IA completa</> : <><PenLine className="h-3 w-3" /> sua parte</>}
          </span>
        )}
      </div>
      {!presente && it.nota && <p className="text-xs text-muted-foreground mt-1">{it.nota}</p>}
      {!presente && it.como_resolver && (
        <p className="text-sm text-foreground mt-1.5"><strong>Como resolver:</strong> {it.como_resolver}</p>
      )}
    </div>
  )
}
