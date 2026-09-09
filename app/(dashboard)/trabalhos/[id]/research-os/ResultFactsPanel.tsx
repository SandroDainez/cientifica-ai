'use client'

import { useState } from 'react'
import { CheckCircle2, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ExecutionAnalysisRecord } from '@/lib/research-os/execution-analysis-lock'
import type { ResultFactInput, ResultFactKind, ResultFactRegistry } from '@/lib/research-os/result-fact-lock'

interface Props {
  trabalhoId: string
  executionRecord: ExecutionAnalysisRecord | null
  initialRegistry: ResultFactRegistry | null
}

const kinds: Array<{ value: ResultFactKind; label: string }> = [
  { value: 'primario', label: 'Resultado primário' },
  { value: 'secundario', label: 'Resultado secundário' },
  { value: 'descritivo', label: 'Descritivo' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'evento_adverso', label: 'Evento adverso' },
  { value: 'sensibilidade', label: 'Sensibilidade' },
  { value: 'fluxo', label: 'Fluxo/amostra' },
  { value: 'outro', label: 'Outro' },
]

export function ResultFactsPanel({ trabalhoId, executionRecord, initialRegistry }: Props) {
  const [facts, setFacts] = useState<ResultFactInput[]>(initialRegistry?.facts ?? [{ kind: 'primario', text: '' }])
  const [registry, setRegistry] = useState(initialRegistry)
  const [loading, setLoading] = useState(false)
  const frozen = registry?.status === 'congelado'
  const executionReady = executionRecord?.status === 'congelado'

  function updateFact(index: number, patch: Partial<ResultFactInput>) {
    setFacts(current => current.map((fact, i) => i === index ? { ...fact, ...patch } : fact))
  }

  async function submit(action: 'save' | 'freeze') {
    setLoading(true)
    try {
      const response = await fetch(`/api/trabalhos/${trabalhoId}/research-os/result-facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, facts }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Falha ao salvar fatos de resultado')
      setRegistry(data.registry)
      if (data.registry?.facts) setFacts(data.registry.facts)
      toast.success(action === 'freeze' ? 'Fatos de resultado congelados' : 'Fatos de resultado salvos')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar fatos de resultado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-5 w-5" /> Result Fact Lock</h2>
          <p className="mt-1 text-sm text-muted-foreground">A seção Resultados só poderá usar fatos aprovados aqui. Não informe interpretações; registre fatos observados e valores exatos.</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold">{frozen ? 'Congelado' : executionReady ? 'Em preparação' : 'Aguardando execução'}</span>
      </div>

      {!executionReady && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Congele primeiro o Execution / Analysis Lock.</div>}

      <div className="space-y-3">
        {facts.map((fact, index) => (
          <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[180px_1fr_auto]">
            <select disabled={frozen} value={fact.kind} onChange={e => updateFact(index, { kind: e.target.value as ResultFactKind })} className="rounded-md border bg-background p-2 text-sm">
              {kinds.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <textarea disabled={frozen} value={fact.text} onChange={e => updateFact(index, { text: e.target.value })} placeholder="Ex.: Mortalidade em 28 dias: 18/100 (18%). OR ajustado 0,72; IC95% 0,60–0,86; p=0,003." className="min-h-20 rounded-md border bg-background p-2 text-sm" />
            {!frozen && <button type="button" onClick={() => setFacts(current => current.filter((_, i) => i !== index))} className="self-start rounded-md border p-2"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>

      {!frozen && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFacts(current => [...current, { kind: 'secundario', text: '' }])} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Adicionar fato</button>
          <button type="button" disabled={!executionReady || loading} onClick={() => submit('save')} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">Salvar rascunho</button>
          <button type="button" disabled={!executionReady || loading} onClick={() => submit('freeze')} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Lock className="h-4 w-4" /> Congelar fatos aprovados</button>
        </div>
      )}

      {frozen && registry && <div className="rounded-lg border p-3 text-xs text-muted-foreground">Fingerprint: <span className="font-mono">{registry.fingerprint}</span> · {registry.facts.length} fato(s) aprovado(s).</div>}
    </section>
  )
}
