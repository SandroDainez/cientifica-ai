// Rota de revisão por IA — análise (com ou sem correção). SERVER-ONLY.
// Nenhuma chave de API vai ao cliente (a key vive no ReviewService, server-side).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { reviewService, type ReviewParams, type ReviewErrorCode } from '@/lib/ai/reviewService'

// Revisão pode ser longa (modelo grande) — aumenta o timeout da função.
export const maxDuration = 300

const Schema = z.object({
  trabalho: z.string().min(1, 'trabalho é obrigatório'),
  tipo: z.string(),
  tema: z.string(),
  area: z.string(),
  normas: z.string(),
  idioma: z.string(),
  modoCorrecao: z.boolean(),
})

function statusDoErro(codigo: ReviewErrorCode): number {
  switch (codigo) {
    case 'INPUT_TOO_LARGE': return 413
    case 'CONFIG_ERROR':    return 503
    case 'API_ERROR':
    case 'PARSE_ERROR':     return 502
    default:                return 500
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'review-analyze')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  // Validação com zod ANTES de qualquer chamada externa.
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parsed.error.issues.map(i => ({ campo: i.path.join('.'), msg: i.message })) },
      { status: 400 },
    )
  }

  const { modoCorrecao, ...rest } = parsed.data
  const params: ReviewParams = rest

  const out = modoCorrecao
    ? await reviewService.analyzeAndCorrect(params)
    : await reviewService.analyze(params)

  if (!out.ok) return NextResponse.json({ error: out.error, codigo: out.codigo }, { status: statusDoErro(out.codigo) })
  return NextResponse.json(out.data)
}
