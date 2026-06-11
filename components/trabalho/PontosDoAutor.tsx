'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2, PenLine, ShieldAlert, GraduationCap, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { prontidaoAutor, avaliarPreenchimento, type PontoAutorAvaliado } from '@/lib/trabalho/pontos-autor'
import type { DadosProjeto } from '@/types'

interface Props {
  trabalhoId: string
  tipo?: string
  dadosProjeto?: DadosProjeto | null
}

/**
 * Pontos do Autor: os lugares onde SÓ o autor pode dar a substância (dados reais,
 * método real, contribuição, interpretação). Cada um com instrução clara, o porquê
 * da banca, e ALERTA bem visível de obrigatoriedade. O autor escreve → salva → a IA
 * usa na geração (sem inventar). Reusa o save de dados_projeto.
 */
export function PontosDoAutor({ trabalhoId, tipo, dadosProjeto }: Props) {
  const router = useRouter()
  const { pontos, obrigatoriosPendentes, totalObrigatorios } = prontidaoAutor(tipo, dadosProjeto)

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
  const [integrando, setIntegrando] = useState(false)
  const [ajudando, setAjudando] = useState(false)
  const [exemplo, setExemplo] = useState('')
  const pendenteObrig = ponto.obrigatorio && !ponto.preenchido

  // "Me ajude a escrever": a IA gera um rascunho de partida (ancorado no trabalho, com
  // [preencha: ...] onde precisa de dado real) e preenche o campo para o autor adaptar.
  async function ajudar() {
    setAjudando(true)
    try {
      const res = await fetch('/api/ia/ajudar-ponto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, titulo: ponto.titulo, oQueEscrever: ponto.oQueEscrever, porQue: ponto.porQue, campo: ponto.campo }),
      })
      const data = await res.json() as { ok?: boolean; rascunho?: string; exemplo?: string; error?: string }
      if (!res.ok || !data.rascunho) throw new Error(data.error ?? 'falha')
      setTexto(t => (t.trim() ? `${t}\n\n${data.rascunho}` : data.rascunho!))
      setExemplo(data.exemplo ?? '')
      toast.success('Rascunho criado! Adapte com a sua realidade e substitua os [preencha: …].')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao gerar o rascunho.') }
    finally { setAjudando(false) }
  }

  // Integra: salva a nota E tece na seção-alvo (se já existir), sem inventar.
  async function integrar() {
    setIntegrando(true)
    try {
      const res = await fetch('/api/ia/integrar-ponto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, campo: ponto.campo, secaoAlvo: ponto.secaoAlvo, texto: texto.trim() }),
      })
      const data = await res.json() as { ok?: boolean; integradoNaSecao?: string | null; mensagem?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'falha')
      toast.success(data.integradoNaSecao
        ? `Integrado à seção "${data.integradoNaSecao}". A IA teceu sua nota no texto.`
        : (data.mensagem ?? 'Nota salva — será usada ao gerar a seção.'))
      onSalvo()
    } catch { toast.error('Falha ao integrar. Tente novamente.') }
    finally { setIntegrando(false) }
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

      {/* Não sabe o que pôr? A IA escreve um rascunho de partida para você adaptar. */}
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1.5">
        <span className="text-xs text-muted-foreground flex-1">Não sabe o que escrever? A IA cria um rascunho de partida pra você só adaptar.</span>
        <Button size="sm" variant="outline" onClick={ajudar} disabled={ajudando} className="gap-1.5 shrink-0">
          {ajudando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Me ajude a escrever
        </Button>
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={4}
        placeholder="Escreva aqui o que só você pode informar — ou clique em 'Me ajude a escrever'. A IA integra ao texto, sem inventar."
        className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {exemplo && <p className="mt-1 text-xs text-muted-foreground"><strong>Exemplo de um bom preenchimento:</strong> {exemplo}</p>}
      {(() => {
        const aval = avaliarPreenchimento(ponto.campo, texto)
        return !aval.ok && aval.dica ? (
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">💡 {aval.dica}</p>
        ) : null
      })()}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">A IA integra ao texto — sem inventar nada além do que você escreveu.</span>
        <Button size="sm" onClick={integrar} disabled={integrando || !texto.trim() || texto.trim() === valorInicial.trim()} className="gap-1.5">
          {integrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
          Integrar ao trabalho
        </Button>
      </div>
    </div>
  )
}
