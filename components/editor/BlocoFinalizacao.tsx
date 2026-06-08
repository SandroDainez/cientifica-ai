'use client'

import Link from 'next/link'
import { Eye, FileDown, Send, CheckCircle2, ArrowRight } from 'lucide-react'

interface Props {
  trabalhoId: string
}

/**
 * Encerramento do trabalho — aparece ao chegar na última seção do Editor.
 * Deixa claro a FASE FINAL: revisar → formatar/exportar → submeter.
 * Espelha a separação feita na área de Projeto (planejamento × finalização).
 */
export function BlocoFinalizacao({ trabalhoId }: Props) {
  const passos = [
    {
      n: 1,
      icone: <Eye className="h-5 w-5" />,
      titulo: 'Revisar o trabalho',
      descricao: 'Confira coerência, o Revisor de Consistência (referências) e o checklist final.',
      acao: 'Abrir revisão',
      href: `/trabalhos/${trabalhoId}/visualizar`,
    },
    {
      n: 2,
      icone: <FileDown className="h-5 w-5" />,
      titulo: 'Formatar e exportar',
      descricao: 'Gere o documento em Word (ABNT) ou PDF, já formatado nas normas.',
      acao: 'Exportar',
      href: `/trabalhos/${trabalhoId}/exportar`,
    },
    {
      n: 3,
      icone: <Send className="h-5 w-5" />,
      titulo: 'Submeter',
      descricao: 'Periódicos sugeridos, carta de submissão e checklist final de envio.',
      acao: 'Ver submissão',
      href: `/trabalhos/${trabalhoId}/projeto`,
    },
  ]

  return (
    <div className="mt-6 rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-5">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
        <h3 className="text-base font-semibold text-foreground">Encerramento do trabalho</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Você chegou à última seção. Agora é a <strong>fase final</strong>: revise, formate e submeta.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {passos.map(p => (
          <div key={p.n} className="rounded-lg border border-border bg-card p-3 flex flex-col">
            <div className="flex items-center gap-2 mb-1.5 text-primary">
              <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">{p.n}</span>
              {p.icone}
            </div>
            <p className="text-sm font-semibold text-foreground">{p.titulo}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex-1">{p.descricao}</p>
            <Link
              href={p.href}
              className="mt-3 inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {p.acao} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
