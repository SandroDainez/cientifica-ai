'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Calculator, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ResearchProjectState } from '@/lib/research-os/types'
import type { MethodologyInput, MethodologyPlan, VariableType } from '@/lib/research-os/methodology-engine'

interface Props {
  trabalhoId: string
  initialState: ResearchProjectState | null
  initialPlan: MethodologyPlan | null
  initialInput: MethodologyInput | null
}

const OUTCOME_TYPES: Array<{ value: VariableType; label: string }> = [
  { value: 'binaria', label: 'Binária (sim/não)' },
  { value: 'continua', label: 'Contínua' },
  { value: 'categorica', label: 'Categórica' },
  { value: 'ordinal', label: 'Ordinal' },
  { value: 'contagem', label: 'Contagem/taxa' },
  { value: 'tempo_ate_evento', label: 'Tempo até evento' },
  { value: 'desconhecida', label: 'Ainda não sei' },
]

export function MethodologyPanel({ trabalhoId, initialState, initialPlan, initialInput }: Props) {
  const [primaryOutcome, setPrimaryOutcome] = useState(initialInput?.primaryOutcome?.name ?? initialState?.question.primaryOutcome ?? '')
  const [outcomeType, setOutcomeType] = useState<VariableType>(initialInput?.primaryOutcome?.type ?? 'desconhecida')
  const [repeatedMeasures, setRepeatedMeasures] = useState(Boolean(initialInput?.repeatedMeasures))
  const [clustering, setClustering] = useState(Boolean(initialInput?.clustering))
  const [censoring, setCensoring] = useState(Boolean(initialInput?.censoring))
  const [expectedMissingData, setExpectedMissingData] = useState(Boolean(initialInput?.expectedMissingData))
  const [multiplePrimaryOutcomes, setMultiplePrimaryOutcomes] = useState(Boolean(initialInput?.multiplePrimaryOutcomes))
  const [confounders, setConfounders] = useState((initialInput?.expectedConfounders ?? initialState?.statisticalPlan.confounders ?? []).join(', '))
  const [plan, setPlan] = useState<MethodologyPlan | null>(initialPlan)
  const [loading, setLoading] = useState(false)

  const canBuild = Boolean(initialState && initialState.studyDesign !== 'indefinido' && primaryOutcome.trim() && !loading)
  const status = plan?.readiness ?? initialState?.readiness.statistics ?? 'pendente'

  const statusClass = useMemo(() => {
    if (status === 'pronto') return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
    if (status === 'parcial') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
    return 'border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'
  }, [status])

  async function buildPlan() {
    if (!initialState || !canBuild) return
    setLoading(true)
    try {
      const methodologyInput: MethodologyInput = {
        design: initialState.studyDesign,
        primaryOutcome: { name: primaryOutcome.trim(), type: outcomeType },
        exposureOrIntervention: initialState.question.interventionOrExposure,
        comparator: initialState.question.comparator,
        repeatedMeasures,
        clustering,
        censoring,
        expectedMissingData,
        multiplePrimaryOutcomes,
        expectedConfounders: confounders.split(',').map(v => v.trim()).filter(Boolean),
      }

      const response = await fetch(`/api/trabalhos/${trabalhoId}/research-os/methodology`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodologyInput }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Falha ao montar plano metodológico')
      setPlan(data.plan as MethodologyPlan)
      toast.success('Plano metodológico e estatístico salvo')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao montar plano metodológico')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Calculator className="h-5 w-5" /> Methodology Engine + SAP</h2>
          <p className="mt-1 text-sm text-muted-foreground">Primeiro estruturamos as decisões metodológicas. A seção de Métodos só deve ser redigida depois.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>Estatística: {status}</span>
      </div>

      {!initialState || initialState.studyDesign === 'indefinido' ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Defina e salve primeiro o desenho científico no Intake.</div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs">Desfecho primário
              <input value={primaryOutcome} onChange={e => setPrimaryOutcome(e.target.value)} placeholder="Ex.: mortalidade em 28 dias" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
            <label className="text-xs">Tipo do desfecho
              <select value={outcomeType} onChange={e => setOutcomeType(e.target.value as VariableType)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm">
                {OUTCOME_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-xs">Confundidores esperados
              <input value={confounders} onChange={e => setConfounders(e.target.value)} placeholder="idade, sepse, gravidade..." className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Medidas repetidas', repeatedMeasures, setRepeatedMeasures],
              ['Clusterização', clustering, setClustering],
              ['Censura/tempo-evento', censoring, setCensoring],
              ['Dados ausentes esperados', expectedMissingData, setExpectedMissingData],
              ['Múltiplos primários', multiplePrimaryOutcomes, setMultiplePrimaryOutcomes],
            ].map(([label, value, setter]) => (
              <label key={String(label)} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                <input type="checkbox" checked={Boolean(value)} onChange={e => (setter as (value: boolean) => void)(e.target.checked)} />
                {String(label)}
              </label>
            ))}
          </div>

          <button onClick={buildPlan} disabled={!canBuild} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            {loading ? 'Construindo plano...' : 'Construir e salvar plano metodológico'}
          </button>
        </>
      )}

      {plan && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border p-4">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Análise primária</p><p className="mt-1 text-sm font-medium">{plan.primaryAnalysis ?? 'Ainda não definida'}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Medida de efeito</p><p className="mt-1 text-sm">{plan.effectMeasure ?? 'Ainda não definida'}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Ajuste</p><p className="mt-1 text-sm">{plan.adjustmentStrategy ?? 'Não aplicável ou ainda não definido'}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Dados ausentes</p><p className="mt-1 text-sm">{plan.missingDataStrategy ?? 'Ainda não definido'}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Multiplicidade</p><p className="mt-1 text-sm">{plan.multiplicityStrategy ?? 'Ainda não definida'}</p></div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" /> Requisitos antes de escrever Métodos</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">{plan.requiredElements.map((item, i) => <li key={i}>• {item}</li>)}</ul>
            {plan.sampleSizeRequirements.length > 0 && <><h3 className="pt-2 text-sm font-semibold">Tamanho amostral</h3><ul className="space-y-1 text-sm text-muted-foreground">{plan.sampleSizeRequirements.map((item, i) => <li key={i}>• {item}</li>)}</ul></>}
            {plan.prohibitedShortcuts.length > 0 && <><h3 className="pt-2 text-sm font-semibold text-red-700 dark:text-red-300">Atalhos proibidos</h3><ul className="space-y-1 text-sm text-muted-foreground">{plan.prohibitedShortcuts.map((item, i) => <li key={i}>• {item}</li>)}</ul></>}
          </div>

          {plan.unresolvedQuestions.length > 0 && (
            <div className="lg:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="font-medium">Pendências metodológicas</div>
              <ul className="mt-2 space-y-1">{plan.unresolvedQuestions.map((item, i) => <li key={i}>• {item}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
