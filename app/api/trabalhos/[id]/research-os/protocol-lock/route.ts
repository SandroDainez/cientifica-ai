import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateProtocolReadiness, freezeProtocol, type ProtocolLockRecord } from '@/lib/research-os/protocol-lock'
import type { ResearchProjectState } from '@/lib/research-os/types'
import type { MethodologyPlan } from '@/lib/research-os/methodology-engine'
import type { SampleSizePlan } from '@/lib/research-os/sample-size-engine'

function isProjectState(value: unknown): value is ResearchProjectState {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<ResearchProjectState>
  return v.schemaVersion === 2 && typeof v.studyDesign === 'string' && Boolean(v.question) && Boolean(v.statisticalPlan) && Boolean(v.readiness)
}

function asMethodologyPlan(value: unknown): MethodologyPlan | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<MethodologyPlan>
  return typeof v.design === 'string' && typeof v.readiness === 'string' ? value as MethodologyPlan : null
}

function asSampleSizePlan(value: unknown): SampleSizePlan | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<SampleSizePlan>
  return typeof v.status === 'string' ? value as SampleSizePlan : null
}

function asProtocolLock(value: unknown): ProtocolLockRecord | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ProtocolLockRecord>
  return v.status === 'congelado' && Boolean(v.snapshot) && Array.isArray(v.amendments) ? value as ProtocolLockRecord : null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { action?: 'status' | 'freeze' | 'amend'; reason?: string }
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
  const state = researchOs.project_state
  if (!isProjectState(state)) {
    return NextResponse.json({ error: 'Ative e salve o Research OS antes de congelar o protocolo.' }, { status: 409 })
  }

  const methodology = asMethodologyPlan(researchOs.methodology_plan)
  const sampleSize = asSampleSizePlan(researchOs.sample_size_plan)
  const existingLock = asProtocolLock(researchOs.protocol_lock)
  const readiness = evaluateProtocolReadiness({ state, methodology, sampleSize, existingLock })

  if (action === 'status') {
    return NextResponse.json({ ok: true, readiness, protocolLock: existingLock })
  }

  if (action === 'freeze' && existingLock) {
    return NextResponse.json({
      error: 'O protocolo já foi congelado. Mudanças posteriores exigem amendment com justificativa.',
      readiness,
    }, { status: 409 })
  }

  if (action === 'amend' && !existingLock) {
    return NextResponse.json({ error: 'Não existe protocolo congelado para receber amendment.' }, { status: 409 })
  }

  try {
    const protocolLock = freezeProtocol({
      state,
      methodology,
      sampleSize,
      existingLock,
      amendmentReason: action === 'amend' ? body.reason : undefined,
    })

    const nextDadosTrabalho = {
      ...current,
      research_os: {
        ...researchOs,
        protocol_lock: protocolLock,
        protocol_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }

    const { error } = await supabase
      .from('trabalhos')
      .update({ dados_trabalho: nextDadosTrabalho, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('usuario_id', user.id)

    if (error) {
      console.error('[research-os/protocol-lock] falha ao persistir:', error)
      return NextResponse.json({ error: 'Falha ao salvar o Protocol Lock' }, { status: 500 })
    }

    const nextReadiness = evaluateProtocolReadiness({ state, methodology, sampleSize, existingLock: protocolLock })
    return NextResponse.json({ ok: true, protocolLock, readiness: nextReadiness })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível congelar o protocolo.',
      readiness,
    }, { status: 409 })
  }
}
