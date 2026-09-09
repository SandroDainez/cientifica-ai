import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildExecutionAnalysisRecord,
  evaluateExecutionAnalysisReadiness,
  type ExecutionAnalysisInput,
  type ExecutionAnalysisRecord,
} from '@/lib/research-os/execution-analysis-lock'
import type { ProtocolLockRecord } from '@/lib/research-os/protocol-lock'

function asProtocolLock(value: unknown): ProtocolLockRecord | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ProtocolLockRecord>
  return v.status === 'congelado' && Boolean(v.snapshot) && Array.isArray(v.amendments)
    ? value as ProtocolLockRecord
    : null
}

function asExecutionRecord(value: unknown): ExecutionAnalysisRecord | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ExecutionAnalysisRecord>
  return (v.status === 'rascunho' || v.status === 'congelado') && typeof v.protocolVersion === 'number'
    ? value as ExecutionAnalysisRecord
    : null
}

function sanitizeInput(value: unknown): ExecutionAnalysisInput {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const number = typeof v.actualSampleSize === 'number' && Number.isFinite(v.actualSampleSize) && v.actualSampleSize > 0
    ? Math.round(v.actualSampleSize)
    : undefined
  const text = (key: string) => typeof v[key] === 'string' ? String(v[key]).trim().slice(0, 4000) : undefined
  const sensitivities = Array.isArray(v.sensitivityAnalyses)
    ? v.sensitivityAnalyses.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, 20)
    : []
  const deviations = Array.isArray(v.deviations)
    ? v.deviations.filter(item => item && typeof item === 'object').slice(0, 30).map((item, index) => {
        const d = item as Record<string, unknown>
        const category = ['amostra', 'desfecho', 'analise', 'missing_data', 'exclusoes', 'sensibilidade', 'outro'].includes(String(d.category))
          ? String(d.category) as 'amostra' | 'desfecho' | 'analise' | 'missing_data' | 'exclusoes' | 'sensibilidade' | 'outro'
          : 'outro'
        return {
          id: typeof d.id === 'string' && d.id.trim() ? d.id.trim().slice(0, 50) : `D${index + 1}`,
          category,
          planned: typeof d.planned === 'string' ? d.planned.trim().slice(0, 3000) : '',
          actual: typeof d.actual === 'string' ? d.actual.trim().slice(0, 3000) : '',
          reason: typeof d.reason === 'string' ? d.reason.trim().slice(0, 4000) : '',
          impact: typeof d.impact === 'string' ? d.impact.trim().slice(0, 4000) : undefined,
        }
      })
    : []

  return {
    actualSampleSize: number,
    primaryOutcomeAnalyzed: text('primaryOutcomeAnalyzed'),
    primaryAnalysisPerformed: text('primaryAnalysisPerformed'),
    missingDataHandling: text('missingDataHandling'),
    analysisPopulation: text('analysisPopulation'),
    exclusionsSummary: text('exclusionsSummary'),
    sensitivityAnalyses: sensitivities,
    deviations,
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

  const body = await request.json().catch(() => ({})) as { action?: 'status' | 'save' | 'freeze'; input?: unknown }
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
  const protocolLock = asProtocolLock(researchOs.protocol_lock)
  const existingRecord = asExecutionRecord(researchOs.execution_analysis)
  const input = sanitizeInput(body.input ?? existingRecord ?? {})
  const readiness = evaluateExecutionAnalysisReadiness({ protocolLock, input, existingRecord })

  if (action === 'status') {
    return NextResponse.json({ ok: true, readiness, record: existingRecord, input })
  }

  if (!protocolLock) {
    return NextResponse.json({ error: 'Congele o protocolo antes de registrar execução/análise.', readiness }, { status: 409 })
  }

  if (existingRecord?.status === 'congelado') {
    return NextResponse.json({ error: 'O registro de execução/análise já está congelado e não pode ser sobrescrito.', readiness }, { status: 409 })
  }

  try {
    const record = buildExecutionAnalysisRecord({
      protocolLock,
      input,
      freeze: action === 'freeze',
    })

    const projectState = researchOs.project_state && typeof researchOs.project_state === 'object'
      ? researchOs.project_state as Record<string, unknown>
      : null

    const nextDadosTrabalho = {
      ...current,
      research_os: {
        ...researchOs,
        project_state: projectState ? { ...projectState, _execution_analysis: record } : researchOs.project_state,
        execution_analysis: record,
        execution_analysis_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }

    const { error } = await supabase
      .from('trabalhos')
      .update({ dados_trabalho: nextDadosTrabalho, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('usuario_id', user.id)

    if (error) {
      console.error('[research-os/execution-analysis] falha ao persistir:', error)
      return NextResponse.json({ error: 'Falha ao salvar execução/análise' }, { status: 500 })
    }

    const nextReadiness = evaluateExecutionAnalysisReadiness({ protocolLock, input, existingRecord: record })
    return NextResponse.json({ ok: true, record, readiness: nextReadiness })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível congelar a execução/análise.',
      readiness,
    }, { status: 409 })
  }
}
