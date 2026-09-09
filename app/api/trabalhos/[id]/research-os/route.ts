import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ResearchProjectState } from '@/lib/research-os/types'

function isResearchProjectState(value: unknown): value is ResearchProjectState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.schemaVersion === 2 && typeof v.academicPurpose === 'string' && typeof v.studyDesign === 'string'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json() as { researchProjectState?: unknown; intakeMetadata?: unknown }
  if (!isResearchProjectState(body.researchProjectState)) {
    return NextResponse.json({ error: 'Estado científico inválido' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const current = (existing.dados_trabalho as Record<string, unknown>) ?? {}
  const researchOsCurrent = (current.research_os as Record<string, unknown>) ?? {}

  const nextDadosTrabalho = {
    ...current,
    research_os: {
      ...researchOsCurrent,
      project_state: body.researchProjectState,
      intake_metadata: body.intakeMetadata ?? researchOsCurrent.intake_metadata ?? null,
      updated_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('trabalhos')
    .update({ dados_trabalho: nextDadosTrabalho, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('[research-os] falha ao persistir estado científico:', error)
    return NextResponse.json({ error: 'Falha ao salvar estado científico' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, state: body.researchProjectState })
}
