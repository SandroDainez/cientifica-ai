import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildResultFactRegistry,
  evaluateResultFactReadiness,
  sanitizeResultFacts,
  type ResultFactInput,
  type ResultFactRegistry,
} from '@/lib/research-os/result-fact-lock'
import type { ExecutionAnalysisRecord } from '@/lib/research-os/execution-analysis-lock'

function asExecutionRecord(value: unknown): ExecutionAnalysisRecord | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ExecutionAnalysisRecord>
  return v.status === 'congelado' && typeof v.fingerprint === 'string' && typeof v.protocolVersion === 'number'
    ? value as ExecutionAnalysisRecord
    : null
}

function asRegistry(value: unknown): ResultFactRegistry | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ResultFactRegistry>
  return (v.status === 'rascunho' || v.status === 'congelado') && typeof v.fingerprint === 'string' && Array.isArray(v.facts)
    ? value as ResultFactRegistry
    : null
}

function sanitizeFacts(value: unknown): ResultFactInput[] {
  if (!Array.isArray(value)) return []
  return sanitizeResultFacts(value.filter(item => item && typeof item === 'object').map(item => {
    const v = item as Record<string, unknown>
    return {
      id: typeof v.id === 'string' ? v.id.slice(0, 50) : undefined,
      kind: ['primario', 'secundario', 'descritivo', 'baseline', 'evento_adverso', 'sensibilidade', 'fluxo', 'outro'].includes(String(v.kind))
        ? String(v.kind) as ResultFactInput['kind']
        : 'outro',
      text: typeof v.text === 'string' ? v.text.slice(0, 5000) : '',
      sourceNote: typeof v.sourceNote === 'string' ? v.sourceNote.slice(0, 2000) : undefined,
    }
  })).map(fact => ({ id: fact.id, kind: fact.kind, text: fact.text, sourceNote: fact.sourceNote }))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { action?: 'status' | 'save' | 'freeze'; facts?: unknown }
  const action = body.action ?? 'status'

  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const current = (existing.dados_trabalho as Record<string, unknown>) ?? {}
  const researchOs = (current.research_os as Record<string, unknown>) ?? {}
  const execution = asExecutionRecord(researchOs.execution_analysis)
  const existingRegistry = asRegistry(researchOs.result_fact_registry)
  const facts = sanitizeFacts(body.facts ?? existingRegistry?.facts ?? [])
  const readiness = evaluateResultFactReadiness({ executionRecord: execution, facts, existingRegistry })

  if (action === 'status') return NextResponse.json({ ok: true, readiness, registry: existingRegistry, facts })
  if (!execution) return NextResponse.json({ error: 'Congele primeiro o Execution / Analysis Lock.', readiness }, { status: 409 })
  if (existingRegistry?.status === 'congelado') {
    return NextResponse.json({ error: 'O Result Fact Lock já está congelado e não pode ser sobrescrito.', readiness }, { status: 409 })
  }

  try {
    const registry = buildResultFactRegistry({ executionRecord: execution, facts, freeze: action === 'freeze' })
    const projectState = researchOs.project_state && typeof researchOs.project_state === 'object'
      ? researchOs.project_state as Record<string, unknown>
      : null

    const nextDadosTrabalho = {
      ...current,
      research_os: {
        ...researchOs,
        project_state: projectState ? { ...projectState, _execution_analysis: execution, _result_fact_registry: registry } : researchOs.project_state,
        result_fact_registry: registry,
        result_fact_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }

    const { error } = await supabase
      .from('trabalhos')
      .update({ dados_trabalho: nextDadosTrabalho, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('usuario_id', user.id)

    if (error) {
      console.error('[research-os/result-facts] falha ao persistir:', error)
      return NextResponse.json({ error: 'Falha ao salvar fatos de resultado' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, registry, readiness: evaluateResultFactReadiness({ executionRecord: execution, facts, existingRegistry: registry }) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível congelar os fatos de resultado.', readiness }, { status: 409 })
  }
}
