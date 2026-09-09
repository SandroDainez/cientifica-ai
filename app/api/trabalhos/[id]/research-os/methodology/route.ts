import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  applyMethodologyPlanToProjectState,
  buildMethodologyPlan,
  type MethodologyInput,
} from '@/lib/research-os/methodology-engine'
import type { ResearchProjectState } from '@/lib/research-os/types'

function isProjectState(value: unknown): value is ResearchProjectState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.schemaVersion === 2 && typeof v.studyDesign === 'string'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json() as { methodologyInput?: MethodologyInput }
  if (!body.methodologyInput || typeof body.methodologyInput !== 'object') {
    return NextResponse.json({ error: 'Entrada metodológica inválida' }, { status: 400 })
  }

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
    return NextResponse.json({ error: 'Ative e salve o Research OS antes de montar a metodologia.' }, { status: 409 })
  }

  const input: MethodologyInput = {
    ...body.methodologyInput,
    design: projectState.studyDesign,
    primaryOutcome: body.methodologyInput.primaryOutcome ?? (
      projectState.question.primaryOutcome
        ? { name: projectState.question.primaryOutcome, type: 'desconhecida' }
        : undefined
    ),
    exposureOrIntervention: body.methodologyInput.exposureOrIntervention ?? projectState.question.interventionOrExposure,
    comparator: body.methodologyInput.comparator ?? projectState.question.comparator,
    expectedConfounders: body.methodologyInput.expectedConfounders ?? projectState.statisticalPlan.confounders,
    covariates: body.methodologyInput.covariates ?? projectState.statisticalPlan.covariates,
  }

  const plan = buildMethodologyPlan(input)
  const nextState = applyMethodologyPlanToProjectState(projectState, plan)

  const nextDadosTrabalho = {
    ...current,
    research_os: {
      ...researchOs,
      project_state: nextState,
      methodology_input: input,
      methodology_plan: plan,
      methodology_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('trabalhos')
    .update({ dados_trabalho: nextDadosTrabalho, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('[research-os/methodology] falha ao persistir plano:', error)
    return NextResponse.json({ error: 'Falha ao salvar plano metodológico' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, plan, state: nextState, input })
}
