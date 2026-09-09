import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildEvidenceAssessmentPrompt } from '@/lib/research-os/evidence-prompt'
import { buildEvidenceMapResult, type ClaimCandidate, type EvidenceLinkAssessment } from '@/lib/research-os/evidence-engine'
import type { Referencia } from '@/types'

export const maxDuration = 180

function parseArray(text: string): unknown[] {
  const trimmed = text.trim()
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : []
  } catch { /* continua */ }

  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function sanitizeLinks(raw: unknown[]): EvidenceLinkAssessment[] {
  const support = new Set(['nao_avaliado', 'insuficiente', 'parcial', 'confirmado', 'contraditorio'])
  const directness = new Set(['direta', 'indireta', 'incerta'])
  const tiers = new Set(['sintese_alta', 'ensaio', 'observacional', 'diagnostico_prognostico', 'qualitativo', 'preclinico', 'diretriz', 'outra', 'incerta'])
  const matches = new Set(['alta', 'parcial', 'baixa', 'incerta'])
  const numeric = new Set(['nao_aplicavel', 'confirmado', 'nao_encontrado', 'incerto'])

  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const o = item as Record<string, unknown>
    if (typeof o.claimId !== 'string' || typeof o.referenceId !== 'string' || typeof o.rationale !== 'string') return []
    if (!support.has(String(o.supportStatus)) || !directness.has(String(o.directness)) || !tiers.has(String(o.sourceTier))) return []
    if (!matches.has(String(o.populationMatch)) || !matches.has(String(o.outcomeMatch)) || !numeric.has(String(o.numericSupport))) return []

    const link: EvidenceLinkAssessment = {
      claimId: o.claimId,
      referenceId: o.referenceId,
      supportStatus: o.supportStatus as EvidenceLinkAssessment['supportStatus'],
      directness: o.directness as EvidenceLinkAssessment['directness'],
      sourceTier: o.sourceTier as EvidenceLinkAssessment['sourceTier'],
      populationMatch: o.populationMatch as EvidenceLinkAssessment['populationMatch'],
      outcomeMatch: o.outcomeMatch as EvidenceLinkAssessment['outcomeMatch'],
      numericSupport: o.numericSupport as EvidenceLinkAssessment['numericSupport'],
      rationale: o.rationale.slice(0, 700),
    }
    if (typeof o.supportingExcerpt === 'string' && o.supportingExcerpt.trim()) link.supportingExcerpt = o.supportingExcerpt.slice(0, 400)
    return [link]
  })
}

function sanitizeClaims(raw: unknown): ClaimCandidate[] {
  if (!Array.isArray(raw)) return []
  const importance = new Set(['alta', 'media', 'baixa'])
  const kinds = new Set(['efeito', 'associacao', 'frequencia', 'diagnostico', 'prognostico', 'metodologia', 'definicao', 'outro'])
  const ids = new Set<string>()

  return raw.flatMap((item, i) => {
    if (!item || typeof item !== 'object') return []
    const o = item as Record<string, unknown>
    const text = typeof o.text === 'string' ? o.text.trim() : ''
    if (text.length < 8) return []
    const idRaw = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `C${i + 1}`
    const id = ids.has(idRaw) ? `C${i + 1}` : idRaw
    ids.add(id)
    return [{
      id,
      text: text.slice(0, 1200),
      importance: importance.has(String(o.importance)) ? o.importance as ClaimCandidate['importance'] : 'media',
      kind: kinds.has(String(o.kind)) ? o.kind as ClaimCandidate['kind'] : 'outro',
    }]
  }).slice(0, 40)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'evidence-map')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas auditorias em sequência. Aguarde um momento.' }, { status: 429 })

  const body = await request.json() as { trabalhoId?: string; claims?: unknown[] }
  const trabalhoId = body.trabalhoId?.trim()
  const claims = sanitizeClaims(body.claims)
  if (!trabalhoId) return NextResponse.json({ error: 'trabalhoId é obrigatório.' }, { status: 400 })
  if (claims.length === 0) return NextResponse.json({ error: 'Informe pelo menos um claim científico válido.' }, { status: 400 })

  const { data: trabalho } = await supabase
    .from('trabalhos')
    .select('id')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()
  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado.' }, { status: 404 })

  const { data: refsData } = await supabase
    .from('referencias')
    .select('*')
    .eq('trabalho_id', trabalhoId)

  const references = (refsData ?? []) as Referencia[]
  if (references.length === 0) {
    return NextResponse.json(buildEvidenceMapResult(claims, [], []))
  }

  // Abstract é a unidade mínima permitida nesta versão. Fontes sem abstract podem
  // continuar cadastradas, mas não entram na avaliação semântica por IA.
  const evaluableRefs = references.filter(r => Boolean(r.abstract?.trim())).slice(0, 60)
  let rawLinks: EvidenceLinkAssessment[] = []

  if (evaluableRefs.length > 0) {
    try {
      const prompt = buildEvidenceAssessmentPrompt(claims, evaluableRefs)
      const raw = await callAI(prompt.system, prompt.user, true, 7000)
      rawLinks = sanitizeLinks(parseArray(raw))
    } catch (error) {
      console.error('[evidence-map] falha na avaliação semântica:', error)
    }
  }

  const result = buildEvidenceMapResult(claims, references, rawLinks)

  // Persiste somente o mapa estruturado, não altera seções/manuscrito.
  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()
  const dados = ((existing?.dados_trabalho as Record<string, unknown>) ?? {})
  const researchOs = ((dados.research_os as Record<string, unknown>) ?? {})

  await supabase
    .from('trabalhos')
    .update({
      dados_trabalho: {
        ...dados,
        research_os: {
          ...researchOs,
          evidence_map: result,
          evidence_map_updated_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)

  return NextResponse.json(result)
}
