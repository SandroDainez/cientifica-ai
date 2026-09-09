import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildScientificIntakeExtractionPrompt } from '@/lib/research-os/intake-prompt'
import { runScientificIntake, type ScientificIntakeInput } from '@/lib/research-os/intake-engine'
import type { AcademicPurpose, HumanDataSource } from '@/lib/research-os/types'
import type { StudyDesignFacts } from '@/lib/research-os/study-design-classifier'

export const maxDuration = 120

type ExtractedFacts = StudyDesignFacts & {
  involvesHumans?: boolean
  involvesAnimals?: boolean
  humanDataSource?: HumanDataSource
  vulnerablePopulation?: boolean
  multicenter?: boolean
}

const HUMAN_DATA_SOURCES = new Set<HumanDataSource>([
  'intervencao_prospectiva',
  'observacional_prospectiva',
  'prontuario_retrospectivo',
  'questionario_entrevista',
  'material_biologico',
  'imagem_audio_video',
  'base_publica_anonimizada',
  'base_privada_anonimizada',
  'dados_identificaveis',
  'nenhum',
])

function sanitizeExtractedFacts(raw: unknown): ExtractedFacts {
  if (!raw || typeof raw !== 'object') return {}
  const source = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}

  const booleanKeys = [
    'literatureOnly', 'systematicSearch', 'metaAnalysisPlanned', 'animalExperiment',
    'qualitativeData', 'quantitativeData', 'investigatorAssignsIntervention', 'randomized',
    'startsFromOutcome', 'followsForwardInTime', 'historicalDataOnly', 'singleTimePoint',
    'diagnosticAccuracyQuestion', 'prognosticQuestion', 'predictionModelQuestion',
    'qualityImprovement', 'economicEvaluation', 'involvesHumans', 'involvesAnimals',
    'vulnerablePopulation', 'multicenter',
  ]

  for (const key of booleanKeys) {
    if (typeof source[key] === 'boolean') out[key] = source[key]
  }

  if (typeof source.caseCount === 'number' && Number.isFinite(source.caseCount) && source.caseCount >= 0) {
    out.caseCount = Math.floor(source.caseCount)
  }

  if (typeof source.humanDataSource === 'string' && HUMAN_DATA_SOURCES.has(source.humanDataSource as HumanDataSource)) {
    out.humanDataSource = source.humanDataSource
  }

  return out as ExtractedFacts
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* segue */ }
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try { return JSON.parse(match[0]) } catch { return {} }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'intake-cientifico')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas análises em sequência. Aguarde um momento.' }, { status: 429 })
  }

  const body = await request.json() as {
    description?: string
    area?: string
    academicPurpose?: AcademicPurpose
    confirmedFacts?: ExtractedFacts
  }

  const description = (body.description ?? '').trim()
  if (description.length < 10) {
    return NextResponse.json({ error: 'Descreva a ideia de pesquisa com um pouco mais de detalhe.' }, { status: 400 })
  }

  const prompt = buildScientificIntakeExtractionPrompt({
    description,
    area: body.area,
    academicPurpose: body.academicPurpose,
  })

  let extractedFacts: ExtractedFacts = {}
  try {
    const raw = await callAI(prompt.system, prompt.user, true, 1200)
    extractedFacts = sanitizeExtractedFacts(parseJsonObject(raw))
  } catch (error) {
    console.error('[intake-cientifico] falha ao extrair fatos; usando apenas fatos confirmados:', error)
  }

  // Fatos confirmados pelo usuário têm precedência sobre inferência da IA.
  const facts = { ...extractedFacts, ...(body.confirmedFacts ?? {}) }
  const input: ScientificIntakeInput = {
    description,
    area: body.area,
    academicPurpose: body.academicPurpose,
    facts,
  }

  const result = runScientificIntake(input)

  return NextResponse.json({
    ...result,
    extractedFacts,
    confirmedFacts: body.confirmedFacts ?? {},
    principle: 'A IA extrai fatos; o motor determinístico classifica desenho e rota regulatória.',
  })
}
