'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ClipboardCheck, Loader2, CheckCircle2, MinusCircle, XCircle, Sparkles, Bot, PenLine, Wand2, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ItemDiretriz {
  id: string; rotulo: string; exige: string
  status: string; nota: string; como_resolver: string; quem_resolve: string
}

/**
 * Verificador de Diretriz de Relato (EQUATOR): confere o trabalho item a item da
 * diretriz CERTA pela natureza e GUIA o autor no que falta. Cada item AUSENTE/parcial
 * abre um campo onde a IA (modelo de revisão — Sonnet) ESCREVE um rascunho pronto, o
 * autor adapta e INSERE no trabalho; ao inserir, a conferência re-roda automaticamente.
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
            Trabalhos reconhecidos seguem a diretriz do seu tipo (PRISMA, STROBE, CONSORT, CARE…). A IA confere o seu item a item e, no que falta, <strong>escreve um rascunho pronto pra você</strong> — é só adaptar e inserir. Você não fica perdido.
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
          {res.itens.map(it => (
            <ItemCard key={it.id} it={it} trabalhoId={trabalhoId} sigla={res.sigla} onInserido={conferir} />
          ))}
          <Button variant="outline" size="sm" onClick={conferir} disabled={carregando} className="gap-1.5 mt-1">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Conferir de novo
          </Button>
        </div>
      )}
    </div>
  )
}

function ItemCard({ it, trabalhoId, sigla, onInserido }: {
  it: ItemDiretriz; trabalhoId: string; sigla: string; onInserido: () => void
}) {
  const presente = it.status === 'presente'
  const parcial = it.status === 'parcial'

  const [aberto, setAberto] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [inserindo, setInserindo] = useState(false)
  const [texto, setTexto] = useState('')
  const [exemplo, setExemplo] = useState('')
  const [secao, setSecao] = useState<{ chave: string; nome: string } | null>(null)

  async function escreverComIA() {
    setGerando(true)
    try {
      const r = await fetch('/api/ia/diretriz-ajudar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, sigla, rotulo: it.rotulo, exige: it.exige, comoResolver: it.como_resolver }),
      })
      const data = await r.json() as { ok?: boolean; rascunho?: string; exemplo?: string; secaoChave?: string; secaoNome?: string; error?: string; codigo?: string }
      if (!r.ok || !data.ok || !data.rascunho) throw new Error(data.error ?? 'Não consegui escrever agora. Tente de novo.')
      setTexto(data.rascunho)
      setExemplo(data.exemplo ?? '')
      setSecao(data.secaoChave ? { chave: data.secaoChave, nome: data.secaoNome || data.secaoChave } : null)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao escrever com a IA.') }
    finally { setGerando(false) }
  }

  async function inserir() {
    if (!texto.trim()) { toast.error('Escreva ou gere um texto antes de inserir.'); return }
    if (!secao?.chave) { toast.error('Não há seção-alvo definida. Use "Copiar" e cole na seção certa.'); return }
    setInserindo(true)
    try {
      const r = await fetch('/api/ia/diretriz-inserir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, secaoChave: secao.chave, texto }),
      })
      const data = await r.json() as { ok?: boolean; secaoNome?: string; jaPresente?: boolean; error?: string }
      if (!r.ok || !data.ok) throw new Error(data.error ?? 'Falha ao inserir.')
      toast.success(data.jaPresente ? 'Esse texto já estava na seção.' : `Inserido em "${data.secaoNome}". Reconferindo…`)
      setAberto(false)
      onInserido()   // re-roda a conferência da diretriz (valida de novo)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao inserir no trabalho.') }
    finally { setInserindo(false) }
  }

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
        {!presente && (
          <button onClick={() => setAberto(v => !v)} className="ml-auto text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline">
            {aberto ? <>Fechar <ChevronUp className="h-3.5 w-3.5" /></> : <>Completar <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        )}
      </div>

      {!presente && it.nota && <p className="text-xs text-muted-foreground mt-1">{it.nota}</p>}
      {!presente && it.como_resolver && (
        <p className="text-sm text-foreground mt-1.5"><strong>Como resolver:</strong> {it.como_resolver}</p>
      )}

      {/* Campo editável com a IA — abre ao clicar em "Completar" */}
      {!presente && aberto && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-background/60 p-2.5">
          {!texto && (
            <Button size="sm" onClick={escreverComIA} disabled={gerando} className="gap-1.5">
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {gerando ? 'Escrevendo…' : 'Escrever com a IA'}
            </Button>
          )}

          {(texto || gerando) && (
            <>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rascunho (edite à vontade)</label>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                rows={Math.min(10, Math.max(4, texto.split('\n').length + 1))}
                placeholder="A IA escreve aqui um rascunho pronto pra você adaptar…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
              />
              {exemplo && <p className="text-[11px] text-muted-foreground"><strong>Exemplo do que um bom preenchimento traz:</strong> {exemplo}</p>}
              <p className="text-[11px] text-amber-700 dark:text-amber-400">Onde aparecer <code>[preencha: …]</code>, é um dado que só você tem — complete antes de inserir (a IA nunca inventa).</p>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Button size="sm" onClick={inserir} disabled={inserindo || !texto.trim()} className="gap-1.5">
                  {inserindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {secao?.nome ? `Inserir em "${secao.nome}"` : 'Inserir no trabalho'}
                </Button>
                <Button size="sm" variant="outline" onClick={escreverComIA} disabled={gerando} className="gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" /> Reescrever
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(texto); toast.success('Copiado.') }} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
