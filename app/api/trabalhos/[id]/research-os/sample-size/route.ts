import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSampleSizePlan, type SampleSizeInput } from '@/lib/research-os/sample-size-engine'
import type { MethodologyInput } from '@/lib/research-os/methodology-engine'
import type { ResearchProjectState } from '@/lib/research-os/types'

function isProjectState(value: unknown): value is ResearchProjectState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.schemaVersion === 2 && typeof v.studyDesign === 'string' && Boolean(v.statisticalPlan)
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function sanitizeInput(raw: unknown, state: ResearchProjectState, methodology: MethodologyInput | null): SampleSizeInput {
  const v = object(raw)
  const binary = object(v.binary)
  const continuous = object(v.continuous)
  const prevalence = object(v.prevalence)
  const prediction = object(v.prediction)
  const clustering = object(v.clustering)
  const repeated = object(v.repeatedMeasures)

  return {
    design: state.studyDesign,
    outcomeType: methodology?.primaryOutcome?.type ?? 'desconhecida',
    alpha: finite(v.alpha),
    power: finite(v.power),
    allocationRatio: finite(v.allocationRatio),
    expectedLossFraction: finite(v.expectedLossFraction),
    binary: {
      controlRisk: finite(binary.controlRisk),
      interventionRisk: finite(binary.interventionRisk),
    },
    continuous: {
      standardDeviation: finite(continuous.standardDeviation),
      clinicallyRelevantDifference: finite(continuous.clinicallyRelevantDifference),
    },
    prevalence: {
      expectedProportion: finite(prevalence.expectedProportion),
      absolutePrecision: finite(prevalence.absolutePrecision),
    },
    prediction: {
      candidateParameters: finite(prediction.candidateParameters),
      expectedEventFraction: finite(prediction.expectedEventFraction),
      minimumEventsPerParameter: finite(prediction.minimumEventsPerParameter),
    },
    clustering: {
      enabled: methodology?.clustering === true,
      averageClusterSize: finite(clustering.averageClusterSize),
      icc: finite(clustering.icc),
    },
    repeatedMeasures: {
      enabled: methodology?.repeatedMeasures === true,
      withinSubjectCorrelation: finite(repeated.withinSubjectCorrelation),
    },
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json() as { sampleSizeInput?: unknown }

  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const current = (existing.dados_trabalho as Record<string, unknown>) ?? {}
  const researchOs = (current.research_os as Record<string, unknown>) ?? {}
  const projectState = researchOs.project_state
  if (!isProjectState(projectState)) {
    return NextResponse.json({ error: 'Salve primeiro o estado científico do Research OS.' }, { status: 409 })
  }

  const methodology = (researchOs.methodology_input as MethodologyInput | undefined) ?? null
  if (!methodology?.primaryOutcome?.type || methodology.primaryOutcome.type === 'desconhecida') {
    return NextResponse.json({ error: 'Defina primeiro o tipo do desfecho no plano metodológico.' }, { status: 409 })
  }

  const input = sanitizeInput(body.sampleSizeInput, projectState, methodology)
  const plan = buildSampleSizePlan(input)

  const rationale = [
    plan.formulaFamily ? `Família de cálculo: ${plan.formulaFamily}.` : null,
    ...plan.assumptions,
    ...plan.adjustments,
    plan.unresolvedQuestions.length ? `Pendências: ${plan.unresolvedQuestions.join(' | ')}` : null,
  ].filter(Boolean).join(' ')

  const nextState: ResearchProjectState = {
    ...projectState,
    statisticalPlan: {
      ...projectState.statisticalPlan,
      sampleSize: plan.adjustedSampleSize ?? projectState.statisticalPlan.sampleSize,
      sampleSizeRationale: rationale || projectState.statisticalPlan.sampleSizeRationale,
    },
  }

  const nextDadosTrabalho = {
    ...current,
    research_os: {
      ...researchOs,
      project_state: nextState,
      sample_size_input: input,
      sample_size_plan: plan,
      sample_size_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('trabalhos')
    .update({ dados_trabalho: nextDadosTrabalho, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('[research-os/sample-size] falha ao persistir cálculo:', error)
    return NextResponse.json({ error: 'Falha ao salvar planejamento amostral' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, input, plan, state: nextState })
}
