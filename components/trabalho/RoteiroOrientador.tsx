'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Compass, CheckCircle2, Circle, CircleDashed, ChevronDown, Bot, PenLine, Users, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { roteiroOrientador, type RoteiroParams, type PassoRoteiro } from '@/lib/trabalho/roteiro-orientador'

interface Props extends RoteiroParams {
  trabalhoId: string
}

const QUEM = {
  ia: { label: 'a IA faz', icon: Bot, cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' },
  autor: { label: 'sua parte', icon: PenLine, cls: 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200' },
  misto: { label: 'IA + você', icon: Users, cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200' },
}

/** Conduz o autor: o que fazer a seguir, o que a IA faz, o que é sua parte, o que já está pronto. */
export function RoteiroOrientador({ trabalhoId, ...params }: Props) {
  const [aberto, setAberto] = useState(true)
  const passos = roteiroOrientador(params)
  const relevantes = passos.filter(p => p.status !== 'opcional')
  const feitos = relevantes.filter(p => p.status === 'feito').length
  const proximo = passos.find(p => p.status === 'pendente')

  function linkPara(acao?: string): string | null {
    if (!acao) return null
    if (acao === 'projeto' || acao.startsWith('doc:')) return `/trabalhos/${trabalhoId}/projeto`
    if (acao === 'referencias') return `/trabalhos/${trabalhoId}/referencias`
    if (['revisao', 'diretriz', 'ensaio', 'exportar'].includes(acao)) return `/trabalhos/${trabalhoId}/exportar`
    return null   // editor / pontos-autor → já está no editor
  }

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
      <button onClick={() => setAberto(v => !v)} className="w-full flex items-center gap-2 text-left">
        <Compass className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Roteiro do Orientador — {feitos}/{relevantes.length} concluídos</p>
          <p className="text-xs text-muted-foreground">
            {proximo ? <>Próximo passo: <strong>{proximo.titulo}</strong></> : 'Tudo encaminhado — confira a revisão e exporte. 🎓'}
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
      </button>

      {/* Barra de progresso */}
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${relevantes.length ? (feitos / relevantes.length) * 100 : 0}%` }} />
      </div>

      {aberto && (
        <ol className="mt-3 space-y-2">
          {passos.map((p, i) => <PassoItem key={p.id} numero={i + 1} passo={p} href={linkPara(p.acao)} ehProximo={p.id === proximo?.id} />)}
        </ol>
      )}
    </div>
  )
}

function PassoItem({ numero, passo, href, ehProximo }: { numero: number; passo: PassoRoteiro; href: string | null; ehProximo: boolean }) {
  const feito = passo.status === 'feito'
  const opcional = passo.status === 'opcional'
  const quem = QUEM[passo.quemResolve]
  const QuemIcon = quem.icon
  return (
    <li className={cn('rounded-lg border p-2.5', feito ? 'border-border bg-background/60' : ehProximo ? 'border-primary/50 bg-background' : 'border-border bg-background')}>
      <div className="flex items-center gap-2">
        {feito ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : opcional ? <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" /> : <Circle className={cn('h-4 w-4 shrink-0', ehProximo ? 'text-primary' : 'text-muted-foreground')} />}
        <span className="text-xs text-muted-foreground w-4">{numero}</span>
        <p className={cn('text-sm font-medium flex-1', feito ? 'text-muted-foreground' : 'text-foreground')}>{passo.titulo}</p>
        <span className={cn('text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 inline-flex items-center gap-1 shrink-0', quem.cls)}>
          <QuemIcon className="h-3 w-3" /> {quem.label}
        </span>
      </div>
      {!feito && (
        <div className="pl-6 mt-1 space-y-0.5">
          <p className="text-xs text-muted-foreground">{passo.oQueE}</p>
          <p className="text-xs text-foreground"><strong>Como fazer:</strong> {passo.comoFazer}</p>
          {href && (
            <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-0.5">
              Ir para este passo <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </li>
  )
}
