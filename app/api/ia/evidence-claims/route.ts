import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildEvidenceClaimsPrompt } from '@/lib/research-os/evidence-claims-prompt'
import type { ResearchProjectState } from '@/lib/research-os/types'
import type { ClaimCandidate } from '@/lib/research-os/evidence-engine'

export const maxDuration = 120

function parseObject(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch { /* segue */ }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function sanitizeClaims(raw: unknown): ClaimCandidate[] {
  if (!Array.isArray(raw)) return []
  const importance = new Set(['alta', 'media', 'baixa'])
  const kinds = new Set(['efeito', 'associacao', 'frequencia', 'diagnostico', 'prognostico', 'metodologia', 'definicao', 'outro'])
  const seen = new Set<string>()

  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const obj = item as Record<string, unknown>
    const text = typeof obj.text === 'string' ? obj.text.trim() : ''
    if (text.length < 12) return []
    const key = text.toLowerCase().replace(/\s+/g, ' ').slice(0, 160)
    if (seen.has(key)) return []
    seen.add(key)

    return [{
      id: `C${index + 1}`,
      text: text.slice(0, 1000),
      importance: importance.has(String(obj.importance)) ? obj.importance as ClaimCandidate['importance'] : 'media',
      kind: kinds.has(String(obj.kind)) ? obj.kind as ClaimCandidate['kind'] : 'outro',
    }]
  }).slice(0, 12)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'evidence-claims')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas gerações em sequência. Aguarde um momento.' }, { status: 429 })

  const body = await request.json() as { trabalhoId?: string }
  const trabalhoId = body.trabalhoId?.trim()
  if (!trabalhoId) return NextResponse.json({ error: 'trabalhoId é obrigatório.' }, { status: 400 })

  const { data: trabalho } = await supabase
    .from('trabalhos')
    .select('titulo, area_conhecimento, dados_trabalho')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado.' }, { status: 404 })

  const dados = (trabalho.dados_trabalho as Record<string, unknown>) ?? {}
  const researchOs = (dados.research_os as Record<string, unknown>) ?? {}
  const state = researchOs.project_state as ResearchProjectState | undefined
  if (!state) return NextResponse.json({ error: 'Salve primeiro o estado científico do Research OS.' }, { status: 409 })
  if (state.studyDesign === 'indefinido') return NextResponse.json({ error: 'Defina o desenho científico antes de construir o mapa de evidência.' }, { status: 409 })

  const prompt = buildEvidenceClaimsPrompt(state, trabalho.titulo ?? undefined, trabalho.area_conhecimento ?? undefined)
  let claims: ClaimCandidate[] = []
  try {
    const raw = await callAI(prompt.system, prompt.user, true, 2400)
    const parsed = parseObject(raw)
    claims = sanitizeClaims(parsed.claims)
  } catch (error) {
    console.error('[evidence-claims] falha:', error)
  }

  if (claims.length === 0) {
    return NextResponse.json({ error: 'Não foi possível gerar claims auditáveis para este projeto.' }, { status: 422 })
  }

  return NextResponse.json({ claims })
}
