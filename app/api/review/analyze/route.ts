// Rota de revisão por IA — análise (com ou sem correção). SERVER-ONLY.
// Nenhuma chave de API vai ao cliente (a key vive no ReviewService, server-side).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { reviewService, type ReviewParams, type ReviewErrorCode } from '@/lib/ai/reviewService'
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'
import { montarFontesParaRevisao } from '@/lib/referencias/dossie'
import type { Referencia, FormatoCitacao } from '@/types'

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
  trabalhoId: z.string().optional(),       // BLOCO E: p/ carregar fontes citadas
  formato: z.string().optional(),          // formato de citação (abnt/vancouver/apa)
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

  const { modoCorrecao, trabalhoId, formato, ...rest } = parsed.data
  const params: ReviewParams = rest

  // BLOCO E: se houver trabalhoId, dá à revisão o RESUMO das fontes citadas,
  // para ela conferir se cada citação tem suporte real na fonte. Best-effort.
  if (trabalhoId) {
    try {
      const { data: trab } = await supabase
        .from('trabalhos').select('id, formato_citacao').eq('id', trabalhoId).eq('usuario_id', user.id).single()
      if (trab) {
        const { data: refsData } = await supabase
          .from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at')
        const refs = (refsData ?? []) as Referencia[]
        if (refs.length > 0) {
          const fmt = ((formato || (trab as { formato_citacao?: string }).formato_citacao) ?? 'abnt') as FormatoCitacao
          const { citadas } = separarReferenciasCitadas(refs, params.trabalho, fmt)
          const fontesResumo = montarFontesParaRevisao(citadas, fmt, 18)
          if (fontesResumo) params.fontesResumo = fontesResumo
        }
      }
    } catch { /* segue sem o resumo das fontes */ }
  }

  const out = modoCorrecao
    ? await reviewService.analyzeAndCorrect(params)
    : await reviewService.analyze(params)

  if (!out.ok) return NextResponse.json({ error: out.error, codigo: out.codigo }, { status: statusDoErro(out.codigo) })
  return NextResponse.json(out.data)
}
