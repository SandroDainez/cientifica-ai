import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ResearchProjectState } from '@/lib/research-os/types'
import {
  requiredRegulatoryEvidenceRoutes,
  upsertRegulatoryEvidence,
  verifiedRegulatoryRoutes,
  type RegulatoryEvidenceEntry,
  type RegulatoryEvidenceRegistry,
} from '@/lib/research-os/regulatory-evidence'

function asState(value: unknown): ResearchProjectState | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ResearchProjectState>
  return v.schemaVersion === 2 && typeof v.studyDesign === 'string' && Boolean(v.regulatory)
    ? value as ResearchProjectState
    : null
}

function asRegistry(value: unknown): RegulatoryEvidenceRegistry | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<RegulatoryEvidenceRegistry>
  return v.version === 1 && Array.isArray(v.entries) ? value as RegulatoryEvidenceRegistry : null
}

function sanitizeEntry(value: unknown): Partial<RegulatoryEvidenceEntry> {
  if (!value || typeof value !== 'object') return {}
  const v = value as Record<string, unknown>
  const status = ['registrado', 'verificado', 'revogado'].includes(String(v.status))
    ? String(v.status) as RegulatoryEvidenceEntry['status']
    : 'registrado'
  return {
    id: typeof v.id === 'string' ? v.id.slice(0, 80) : undefined,
    route: typeof v.route === 'string' ? v.route as RegulatoryEvidenceEntry['route'] : undefined,
    status,
    identifier: typeof v.identifier === 'string' ? v.identifier.slice(0, 300) : '',
    issuer: typeof v.issuer === 'string' ? v.issuer.slice(0, 300) : undefined,
    documentReference: typeof v.documentReference === 'string' ? v.documentReference.slice(0, 1000) : undefined,
    issuedAt: typeof v.issuedAt === 'string' ? v.issuedAt.slice(0, 30) : undefined,
    expiresAt: typeof v.expiresAt === 'string' ? v.expiresAt.slice(0, 30) : undefined,
    verifiedAt: typeof v.verifiedAt === 'string' ? v.verifiedAt.slice(0, 40) : undefined,
    notes: typeof v.notes === 'string' ? v.notes.slice(0, 3000) : undefined,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { action?: 'status' | 'upsert'; entry?: unknown }
  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const current = (existing.dados_trabalho as Record<string, unknown>) ?? {}
  const researchOs = (current.research_os as Record<string, unknown>) ?? {}
  const state = asState(researchOs.project_state)
  if (!state) return NextResponse.json({ error: 'ResearchProjectState inválido ou ausente.' }, { status: 409 })

  const registry = asRegistry(researchOs.regulatory_evidence)
  if ((body.action ?? 'status') === 'status') {
    return NextResponse.json({
      ok: true,
      registry,
      requiredRoutes: requiredRegulatoryEvidenceRoutes(state),
      verifiedRoutes: verifiedRegulatoryRoutes(registry, state),
    })
  }

  try {
    const nextRegistry = upsertRegulatoryEvidence({ registry, state, entry: sanitizeEntry(body.entry) })
    const verifiedRoutes = verifiedRegulatoryRoutes(nextRegistry, state)
    const now = new Date().toISOString()
    const nextDadosTrabalho = {
      ...current,
      research_os: {
        ...researchOs,
        regulatory_evidence: nextRegistry,
        ethics_verified_routes: verifiedRoutes,
        regulatory_evidence_updated_at: now,
        updated_at: now,
      },
    }
    const { error } = await supabase
      .from('trabalhos')
      .update({ dados_trabalho: nextDadosTrabalho, updated_at: now })
      .eq('id', id)
      .eq('usuario_id', user.id)
    if (error) {
      console.error('[research-os/regulatory-evidence] falha ao persistir:', error)
      return NextResponse.json({ error: 'Falha ao salvar evidência regulatória.' }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      registry: nextRegistry,
      requiredRoutes: requiredRegulatoryEvidenceRoutes(state),
      verifiedRoutes,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Evidência regulatória inválida.' }, { status: 409 })
  }
}
