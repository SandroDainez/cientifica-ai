'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import type { ExecutionAnalysisRecord, ExecutionAnalysisReadiness } from '@/lib/research-os/execution-analysis-lock'
import type { ProtocolLockRecord } from '@/lib/research-os/protocol-lock'

interface Props {
  trabalhoId: string
  protocolLock: ProtocolLockRecord | null
  initialRecord: ExecutionAnalysisRecord | null
}

export function ExecutionAnalysisPanel({ trabalhoId, protocolLock, initialRecord }: Props) {
  const snapshot = protocolLock?.snapshot
  const [actualSampleSize, setActualSampleSize] = useState(initialRecord?.actualSampleSize?.toString() ?? '')
  const [primaryOutcome, setPrimaryOutcome] = useState(initialRecord?.primaryOutcomeAnalyzed ?? snapshot?.question.primaryOutcome ?? '')
  const [primaryAnalysis, setPrimaryAnalysis] = useState(initialRecord?.primaryAnalysisPerformed ?? snapshot?.statistics.primaryAnalysis ?? snapshot?.methodology?.primaryAnalysis ?? '')
  const [missingData, setMissingData] = useState(initialRecord?.missingDataHandling ?? snapshot?.statistics.missingDataStrategy ?? snapshot?.methodology?.missingDataStrategy ?? '')
  const [analysisPopulation, setAnalysisPopulation] = useState(initialRecord?.analysisPopulation ?? '')
  const [exclusions, setExclusions] = useState(initialRecord?.exclusionsSummary ?? '')
  const [sensitivities, setSensitivities] = useState((initialRecord?.sensitivityAnalyses ?? []).join('\n'))
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries((initialRecord?.deviations ?? []).map(d => [d.category, d.reason])))
  const [readiness, setReadiness] = useState<ExecutionAnalysisReadiness | null>(null)
  const [record, setRecord] = useState(initialRecord)
  const [loading, setLoading] = useState<'save' | 'freeze' | null>(null)

  const frozen = record?.status === 'congelado'
  const plannedN = snapshot?.statistics.sampleSize ?? snapshot?.sampleSize?.adjustedSampleSize ?? undefined
  const categories = useMemo(() => ['amostra', 'desfecho', 'analise', 'missing_data', 'exclusoes'] as const, [])

  function buildInput() {
    const n = Number(actualSampleSize)
    const values: Record<string, { planned: string; actual: string }> = {
      amostra: { planned: plannedN ? String(plannedN) : '(não definido)', actual: Number.isFinite(n) ? String(n) : '' },
      desfecho: { planned: snapshot?.question.primaryOutcome ?? '', actual: primaryOutcome },
      analise: { planned: snapshot?.statistics.primaryAnalysis ?? snapshot?.methodology?.primaryAnalysis ?? '', actual: primaryAnalysis },
      missing_data: { planned: snapshot?.statistics.missingDataStrategy ?? snapshot?.methodology?.missingDataStrategy ?? '', actual: missingData },
      exclusoes: { planned: 'Conforme critérios do protocolo', actual: exclusions },
    }
    const deviations = categories
      .filter(category => reasons[category]?.trim())
      .map((category, index) => ({
        id: `D${index + 1}`,
        category,
        planned: values[category].planned,
        actual: values[category].actual,
        reason: reasons[category].trim(),
      }))

    return {
      actualSampleSize: Number.isFinite(n) && n > 0 ? Math.round(n) : undefined,
      primaryOutcomeAnalyzed: primaryOutcome,
      primaryAnalysisPerformed: primaryAnalysis,
      missingDataHandling: missingData,
      analysisPopulation,
      exclusionsSummary: exclusions,
      sensitivityAnalyses: sensitivities.split('\n').map(v => v.trim()).filter(Boolean),
      deviations,
    }
  }

  async function submit(action: 'save' | 'freeze') {
    setLoading(action)
    try {
      const response = await fetch(`/api/trabalhos/${trabalhoId}/research-os/execution-analysis`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, input: buildInput() }),
      })
      const data = await response.json()
      setReadiness(data.readiness ?? null)
      if (!response.ok) throw new Error(data.error ?? 'Falha ao salvar execução/análise')
      setRecord(data.record as ExecutionAnalysisRecord)
      toast.success(action === 'freeze' ? 'Execução e análise congeladas' : 'Rascunho de execução/análise salvo')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar execução/análise')
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardCheck className="h-5 w-5" /> Execution / Analysis Lock</h2>
          <p className="mt-1 text-sm text-muted-foreground">Registre o que realmente foi executado. O protocolo permanece imutável; divergências viram desvios documentados.</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold">{frozen ? 'Congelado' : protocolLock ? 'Em preparação' : 'Aguardando protocolo'}</span>
      </div>

      {!protocolLock ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mr-2 inline h-4 w-4" /> Congele primeiro o Protocol Lock.
        </div>
      ) : (
        <>
          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            Protocolo vigente: v{snapshot?.version} · fingerprint {snapshot?.fingerprint}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs">Amostra efetivamente analisada
              <input disabled={frozen} value={actualSampleSize} onChange={e => setActualSampleSize(e.target.value)} type="number" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" placeholder={plannedN ? `Planejado: ${plannedN}` : 'n analisado'} />
            </label>
            <label className="text-xs">População de análise
              <input disabled={frozen} value={analysisPopulation} onChange={e => setAnalysisPopulation(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" placeholder="Ex.: intenção de tratar" />
            </label>
            <label className="text-xs">Desfecho primário efetivamente analisado
              <textarea disabled={frozen} value={primaryOutcome} onChange={e => setPrimaryOutcome(e.target.value)} className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
            <label className="text-xs">Análise primária efetivamente executada
              <textarea disabled={frozen} value={primaryAnalysis} onChange={e => setPrimaryAnalysis(e.target.value)} className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
            <label className="text-xs">Tratamento real de dados ausentes
              <textarea disabled={frozen} value={missingData} onChange={e => setMissingData(e.target.value)} className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
            <label className="text-xs">Exclusões após início/coleta
              <textarea disabled={frozen} value={exclusions} onChange={e => setExclusions(e.target.value)} className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm" placeholder="Deixe vazio se não houve exclusões adicionais." />
            </label>
          </div>
          <label className="block text-xs">Análises de sensibilidade — uma por linha
            <textarea disabled={frozen} value={sensitivities} onChange={e => setSensitivities(e.target.value)} className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
          </label>

          <div className="space-y-2 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Justificativas de desvios</h3>
            <p className="text-xs text-muted-foreground">Preencha somente quando a execução divergir do protocolo. O motor também valida isso no servidor.</p>
            {categories.map(category => (
              <label key={category} className="block text-xs capitalize">{category.replace('_', ' ')}
                <input disabled={frozen} value={reasons[category] ?? ''} onChange={e => setReasons(prev => ({ ...prev, [category]: e.target.value }))} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" placeholder="Motivo da divergência, se houver" />
              </label>
            ))}
          </div>

          {readiness && (
            <div className={`rounded-lg border p-3 text-sm ${readiness.blockers.length ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'}`}>
              <div className="flex items-center gap-2 font-medium">{readiness.blockers.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {readiness.status}</div>
              {readiness.blockers.map((item, i) => <div key={i} className="mt-1 text-xs">• {item}</div>)}
              {readiness.warnings.map((item, i) => <div key={`w${i}`} className="mt-1 text-xs text-muted-foreground">• {item}</div>)}
            </div>
          )}

          {!frozen && <div className="flex flex-wrap gap-2">
            <button disabled={Boolean(loading)} onClick={() => submit('save')} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">
              {loading === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Salvar rascunho
            </button>
            <button disabled={Boolean(loading)} onClick={() => submit('freeze')} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {loading === 'freeze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Congelar execução/análise
            </button>
          </div>}
        </>
      )}
    </section>
  )
}
