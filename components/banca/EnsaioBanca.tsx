'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { GraduationCap, Loader2, MessageSquareQuote, Lightbulb, AlertTriangle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PerguntaBanca { pergunta: string; o_que_a_banca_quer: string; esboco_resposta: string; lacuna: string }

/**
 * Ensaio para a Banca: a IA gera as perguntas que a banca faria e, para CADA uma,
 * o que a banca quer + um ESBOÇO de resposta ancorado no trabalho (não deixa o autor
 * sozinho). O autor treina a resposta com as próprias palavras no campo de cada ponto.
 */
export function EnsaioBanca({ trabalhoId }: { trabalhoId: string }) {
  const [carregando, setCarregando] = useState(false)
  const [perguntas, setPerguntas] = useState<PerguntaBanca[] | null>(null)

  async function ensaiar() {
    setCarregando(true)
    try {
      const res = await fetch('/api/ia/ensaio-banca', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trabalhoId }),
      })
      const data = await res.json() as { ok?: boolean; perguntas?: PerguntaBanca[]; error?: string }
      if (!res.ok || !data.perguntas?.length) throw new Error(data.error ?? 'falha')
      setPerguntas(data.perguntas)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao gerar o ensaio.') }
    finally { setCarregando(false) }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start gap-2">
        <GraduationCap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Ensaio para a Banca</p>
          <p className="text-xs text-muted-foreground">
            A banca não examina só o texto — ela sonda <strong>você</strong>. A IA simula as perguntas da defesa e, para cada uma, te dá <strong>o que a banca quer</strong> e um <strong>esboço de resposta</strong> baseado no seu trabalho. Você não fica sozinho nesta fase.
          </p>
        </div>
      </div>

      {!perguntas && (
        <Button onClick={ensaiar} disabled={carregando} className="gap-2">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {carregando ? 'Preparando seu ensaio…' : 'Ensaiar a banca'}
        </Button>
      )}

      {perguntas && (
        <div className="space-y-3">
          {perguntas.map((p, i) => <PerguntaCard key={i} numero={i + 1} p={p} />)}
          <Button variant="outline" size="sm" onClick={ensaiar} disabled={carregando} className="gap-1.5">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareQuote className="h-4 w-4" />}
            Gerar outras perguntas
          </Button>
        </div>
      )}
    </div>
  )
}

function PerguntaCard({ numero, p }: { numero: number; p: PerguntaBanca }) {
  const [resposta, setResposta] = useState('')
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-semibold text-foreground flex gap-2">
        <span className="text-primary">{numero}.</span>
        <span>{p.pergunta}</span>
      </p>
      {p.o_que_a_banca_quer && (
        <p className="text-xs text-muted-foreground"><strong>O que a banca quer ver:</strong> {p.o_que_a_banca_quer}</p>
      )}
      {p.esboco_resposta && (
        <div className="rounded-md bg-muted/60 p-2.5 text-sm text-foreground">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1"><Lightbulb className="h-3.5 w-3.5" /> Esboço de resposta (ponto de partida — adapte com suas palavras)</p>
          {p.esboco_resposta}
        </div>
      )}
      {p.lacuna?.trim() && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200"><strong>No seu trabalho isto ainda não está claro:</strong> {p.lacuna}</p>
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Sua resposta (treine com as suas palavras — é assim que você se prepara de verdade):</p>
        <textarea
          value={resposta}
          onChange={e => setResposta(e.target.value)}
          rows={3}
          placeholder="Responda como responderia à banca…"
          className="w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  )
}
