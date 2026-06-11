'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2, PenLine, ShieldAlert, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { prontidaoAutor, type PontoAutorAvaliado } from '@/lib/trabalho/pontos-autor'
import type { DadosProjeto } from '@/types'

interface Props {
  trabalhoId: string
  dadosProjeto?: DadosProjeto | null
}

/**
 * Pontos do Autor: os lugares onde SÓ o autor pode dar a substância (dados reais,
 * método real, contribuição, interpretação). Cada um com instrução clara, o porquê
 * da banca, e ALERTA bem visível de obrigatoriedade. O autor escreve → salva → a IA
 * usa na geração (sem inventar). Reusa o save de dados_projeto.
 */
export function PontosDoAutor({ trabalhoId, dadosProjeto }: Props) {
  const router = useRouter()
  const { pontos, obrigatoriosPendentes, totalObrigatorios } = prontidaoAutor(dadosProjeto)

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start gap-2">
        <GraduationCap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Pontos do Autor — o que só você pode dar</p>
          <p className="text-xs text-muted-foreground">
            O app escreve o trabalho; estes pontos são a sua parte — o que a <strong>banca cobra de você</strong>. A IA usa exatamente o que você escrever aqui e <strong>não inventa</strong> dados.
          </p>
        </div>
      </div>

      {obrigatoriosPendentes > 0 && (
        <div className="flex items-start gap-2 rounded-lg border-2 border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3">
          <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Faltam {obrigatoriosPendentes} de {totalObrigatorios} pontos OBRIGATÓRIOS.</strong> Sem eles, o trabalho fica genérico e <strong>não é real</strong> — a IA não preenche dados que só você tem. Um trabalho assim a banca reprova.
          </p>
        </div>
      )}
      {totalObrigatorios > 0 && obrigatoriosPendentes === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-2.5">
          <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-300" />
          <p className="text-sm text-green-800 dark:text-green-200">Todos os pontos obrigatórios estão preenchidos. 🎓</p>
        </div>
      )}

      <div className="space-y-3">
        {pontos.map(p => (
          <PontoCard key={p.id} ponto={p} trabalhoId={trabalhoId} dadosProjeto={dadosProjeto} onSalvo={() => router.refresh()} />
        ))}
      </div>
    </div>
  )
}

function PontoCard({ ponto, trabalhoId, dadosProjeto, onSalvo }: {
  ponto: PontoAutorAvaliado
  trabalhoId: string
  dadosProjeto?: DadosProjeto | null
  onSalvo: () => void
}) {
  const valorInicial = (dadosProjeto?.[ponto.campo] as string | undefined) ?? ''
  const [texto, setTexto] = useState(valorInicial)
  const [salvando, setSalvando] = useState(false)
  const pendenteObrig = ponto.obrigatorio && !ponto.preenchido

  async function salvar() {
    setSalvando(true)
    try {
      const dp = { ...(dadosProjeto ?? {}), [ponto.campo]: texto.trim(), confirmado: dadosProjeto?.confirmado ?? false, criado_em: dadosProjeto?.criado_em ?? new Date().toISOString() }
      const res = await fetch(`/api/trabalhos/${trabalhoId}/projeto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dados_projeto: dp }),
      })
      if (!res.ok) throw new Error('falha')
      toast.success(`"${ponto.titulo}" salvo — a IA vai usar isto ao gerar/ajustar as seções.`)
      onSalvo()
    } catch { toast.error('Falha ao salvar. Tente novamente.') }
    finally { setSalvando(false) }
  }

  return (
    <div className={cn('rounded-lg border p-3', pendenteObrig ? 'border-2 border-amber-400 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border')}>
      <div className="flex items-center gap-2 mb-1">
        {ponto.preenchido ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : pendenteObrig ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /> : <PenLine className="h-4 w-4 text-muted-foreground shrink-0" />}
        <p className="text-sm font-semibold text-foreground">{ponto.titulo}</p>
        {ponto.obrigatorio
          ? <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">Obrigatório</span>
          : <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground">Recomendado</span>}
      </div>
      {pendenteObrig && (
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1.5">⚠️ Sem este ponto, o trabalho não fica real nem aprovável pela banca.</p>
      )}
      <p className="text-sm text-foreground"><strong>O que escrever:</strong> {ponto.oQueEscrever}</p>
      <p className="text-xs text-muted-foreground mt-0.5"><strong>Por que a banca cobra:</strong> {ponto.porQue}</p>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={4}
        placeholder="Escreva aqui o que só você pode informar — a IA integra ao texto, sem inventar."
        className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={salvar} disabled={salvando || texto.trim() === valorInicial.trim()} className="gap-1.5">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Salvar este ponto
        </Button>
      </div>
    </div>
  )
}
