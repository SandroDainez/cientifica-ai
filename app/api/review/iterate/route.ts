// Rota de revisão ITERATIVA por IA — roda runIterativeReview e devolve o
// histórico completo + versão final. SERVER-ONLY (nenhuma chave vai ao cliente).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { reviewService, type ReviewParams, type ReviewErrorCode } from '@/lib/ai/reviewService'

export const maxDuration = 300

const Schema = z.object({
  trabalho: z.string(),
  tipo: z.string(),
  tema: z.string(),
  area: z.string(),
  normas: z.string(),
  idioma: z.string(),
  modoCorrecao: z.boolean().optional(), // ignorado na iteração (sempre corrige internamente)
  versaoAtual: z.string().min(1, 'versaoAtual é obrigatória'),
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

  const rl = await checkRateLimit(supabase, user.id, 'review-iterate')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parsed.error.issues.map(i => ({ campo: i.path.join('.'), msg: i.message })) },
      { status: 400 },
    )
  }

  const { tipo, tema, area, normas, idioma, versaoAtual } = parsed.data
  // A iteração começa da versão ATUAL do trabalho.
  const params: ReviewParams = { trabalho: versaoAtual, tipo, tema, area, normas, idioma }

  const out = await reviewService.runIterativeReview(params)
  if (!out.ok) return NextResponse.json({ error: out.error, codigo: out.codigo }, { status: statusDoErro(out.codigo) })
  return NextResponse.json(out.data)
}
