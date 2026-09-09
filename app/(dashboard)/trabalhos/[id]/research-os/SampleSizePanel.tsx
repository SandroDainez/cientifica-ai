'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Calculator, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ResearchProjectState } from '@/lib/research-os/types'
import type { MethodologyInput } from '@/lib/research-os/methodology-engine'
import type { SampleSizeInput, SampleSizePlan } from '@/lib/research-os/sample-size-engine'

interface Props {
  trabalhoId: string
  initialState: ResearchProjectState | null
  methodologyInput: MethodologyInput | null
  initialInput: SampleSizeInput | null
  initialPlan: SampleSizePlan | null
}

function num(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function SampleSizePanel({ trabalhoId, initialState, methodologyInput, initialInput, initialPlan }: Props) {
  const design = initialState?.studyDesign ?? 'indefinido'
  const outcomeType = methodologyInput?.primaryOutcome?.type ?? 'desconhecida'
  const [alpha, setAlpha] = useState(String(initialInput?.alpha ?? 0.05))
  const [power, setPower] = useState(String(initialInput?.power ?? 0.8))
  const [ratio, setRatio] = useState(String(initialInput?.allocationRatio ?? 1))
  const [loss, setLoss] = useState(String(initialInput?.expectedLossFraction ?? 0.1))
  const [controlRisk, setControlRisk] = useState(String(initialInput?.binary?.controlRisk ?? ''))
  const [targetRisk, setTargetRisk] = useState(String(initialInput?.binary?.interventionRisk ?? ''))
  const [sd, setSd] = useState(String(initialInput?.continuous?.standardDeviation ?? ''))
  const [delta, setDelta] = useState(String(initialInput?.continuous?.clinicallyRelevantDifference ?? ''))
  const [prevalence, setPrevalence] = useState(String(initialInput?.prevalence?.expectedProportion ?? ''))
  const [precision, setPrecision] = useState(String(initialInput?.prevalence?.absolutePrecision ?? ''))
  const [parameters, setParameters] = useState(String(initialInput?.prediction?.candidateParameters ?? ''))
  const [eventFraction, setEventFraction] = useState(String(initialInput?.prediction?.expectedEventFraction ?? ''))
  const [epp, setEpp] = useState(String(initialInput?.prediction?.minimumEventsPerParameter ?? 20))
  const [clusterSize, setClusterSize] = useState(String(initialInput?.clustering?.averageClusterSize ?? ''))
  const [icc, setIcc] = useState(String(initialInput?.clustering?.icc ?? ''))
  const [rho, setRho] = useState(String(initialInput?.repeatedMeasures?.withinSubjectCorrelation ?? ''))
  const [plan, setPlan] = useState<SampleSizePlan | null>(initialPlan)
  const [loading, setLoading] = useState(false)

  const isComparative = ['ensaio_clinico_randomizado', 'ensaio_clinico_nao_randomizado', 'coorte_prospectiva', 'coorte_retrospectiva', 'caso_controle'].includes(design)
  const isPrediction = design === 'modelo_preditivo' || design === 'prognostico'
  const isPrevalence = (design === 'transversal' || design === 'ecologico') && outcomeType === 'binaria'
  const canCalculate = Boolean(initialState && methodologyInput && outcomeType !== 'desconhecida' && !loading)

  const statusClass = useMemo(() => {
    if (plan?.status === 'calculado') return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
    if (plan?.status === 'parcial') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
    return 'border-muted bg-muted/40 text-muted-foreground'
  }, [plan?.status])

  async function calculate() {
    if (!canCalculate) return
    setLoading(true)
    try {
      const sampleSizeInput = {
        alpha: num(alpha),
        power: num(power),
        allocationRatio: num(ratio),
        expectedLossFraction: num(loss),
        binary: { controlRisk: num(controlRisk), interventionRisk: num(targetRisk) },
        continuous: { standardDeviation: num(sd), clinicallyRelevantDifference: num(delta) },
        prevalence: { expectedProportion: num(prevalence), absolutePrecision: num(precision) },
        prediction: { candidateParameters: num(parameters), expectedEventFraction: num(eventFraction), minimumEventsPerParameter: num(epp) },
        clustering: { averageClusterSize: num(clusterSize), icc: num(icc) },
        repeatedMeasures: { withinSubjectCorrelation: num(rho) },
      }
      const response = await fetch(`/api/trabalhos/${trabalhoId}/research-os/sample-size`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleSizeInput }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Falha no planejamento amostral')
      setPlan(data.plan as SampleSizePlan)
      toast.success(data.plan?.status === 'calculado' ? 'Planejamento amostral calculado e salvo' : 'Planejamento amostral atualizado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no planejamento amostral')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Calculator className="h-5 w-5" /> Planejamento amostral</h2>
          <p className="mt-1 text-sm text-muted-foreground">O sistema só calcula quando os parâmetros que realmente determinam n estão informados. Se faltar algo, ele mantém a conta pendente.</p>
        </div>
        {plan && <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>Status: {plan.status}</span>}
      </div>

      {!initialState || !methodologyInput || outcomeType === 'desconhecida' ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Conclua primeiro o plano metodológico e defina o tipo do desfecho primário.</div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs">Alfa
              <input value={alpha} onChange={e => setAlpha(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
            <label className="text-xs">Poder
              <input value={power} onChange={e => setPower(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
            <label className="text-xs">Razão de alocação
              <input value={ratio} onChange={e => setRatio(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
            <label className="text-xs">Perdas previstas
              <input value={loss} onChange={e => setLoss(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
          </div>

          {isComparative && outcomeType === 'binaria' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">Risco esperado no controle
                <input value={controlRisk} onChange={e => setControlRisk(e.target.value)} placeholder="0.30" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
              <label className="text-xs">Risco alvo / clinicamente relevante
                <input value={targetRisk} onChange={e => setTargetRisk(e.target.value)} placeholder="0.20" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
            </div>
          )}

          {isComparative && outcomeType === 'continua' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">Desvio-padrão esperado
                <input value={sd} onChange={e => setSd(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
              <label className="text-xs">Diferença mínima clinicamente relevante
                <input value={delta} onChange={e => setDelta(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
            </div>
          )}

          {isPrevalence && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">Prevalência esperada
                <input value={prevalence} onChange={e => setPrevalence(e.target.value)} placeholder="0.20" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
              <label className="text-xs">Precisão absoluta desejada
                <input value={precision} onChange={e => setPrecision(e.target.value)} placeholder="0.04" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
            </div>
          )}

          {isPrediction && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs">Parâmetros candidatos
                <input value={parameters} onChange={e => setParameters(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
              <label className="text-xs">Fração esperada de eventos
                <input value={eventFraction} onChange={e => setEventFraction(e.target.value)} placeholder="0.20" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
              <label className="text-xs">Eventos por parâmetro — mínimo inicial
                <input value={epp} onChange={e => setEpp(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
            </div>
          )}

          {methodologyInput.clustering && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">Tamanho médio do cluster
                <input value={clusterSize} onChange={e => setClusterSize(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
              <label className="text-xs">ICC
                <input value={icc} onChange={e => setIcc(e.target.value)} placeholder="0.05" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
              </label>
            </div>
          )}

          {methodologyInput.repeatedMeasures && (
            <label className="block max-w-sm text-xs">Correlação intraindivíduo esperada
              <input value={rho} onChange={e => setRho(e.target.value)} placeholder="0.60" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" />
            </label>
          )}

          <button onClick={calculate} disabled={!canCalculate} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            {loading ? 'Calculando...' : 'Calcular e salvar planejamento'}
          </button>
        </>
      )}

      {plan && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</p>
            <div className="mt-2 text-3xl font-semibold">{plan.adjustedSampleSize ?? '—'}</div>
            <p className="mt-1 text-sm text-muted-foreground">n total ajustado</p>
            {plan.baseSampleSize && <p className="mt-3 text-sm">n base: <strong>{plan.baseSampleSize}</strong></p>}
            {plan.perGroup && <p className="mt-1 text-sm">por grupo: <strong>{plan.perGroup.join(' / ')}</strong></p>}
            {plan.formulaFamily && <p className="mt-3 text-xs text-muted-foreground">{plan.formulaFamily}</p>}
          </div>

          <div className="space-y-3 rounded-lg border p-4 text-sm">
            {plan.assumptions.length > 0 && <div><h3 className="font-semibold">Premissas</h3><ul className="mt-1 space-y-1 text-muted-foreground">{plan.assumptions.map((item, i) => <li key={i}>• {item}</li>)}</ul></div>}
            {plan.adjustments.length > 0 && <div><h3 className="font-semibold">Ajustes</h3><ul className="mt-1 space-y-1 text-muted-foreground">{plan.adjustments.map((item, i) => <li key={i}>• {item}</li>)}</ul></div>}
          </div>

          {plan.unresolvedQuestions.length > 0 && (
            <div className="lg:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="font-medium">O cálculo ainda não é definitivo</div>
              <ul className="mt-2 space-y-1">{plan.unresolvedQuestions.map((item, i) => <li key={i}>• {item}</li>)}</ul>
            </div>
          )}

          {plan.warnings.length > 0 && (
            <div className="lg:col-span-2 rounded-lg border p-3 text-sm">
              <div className="font-medium">Alertas metodológicos</div>
              <ul className="mt-2 space-y-1 text-muted-foreground">{plan.warnings.map((item, i) => <li key={i}>• {item}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
