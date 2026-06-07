import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPlanejadorPrompt } from '@/lib/ai/prompts/planejar-projeto'
import { streamText } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'

export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'planejar-projeto')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429 }
    )
  }

  const { descricao, trabalhoId } = await request.json() as {
    descricao: string
    trabalhoId: string
  }

  // Validate that trabalhoId belongs to the user + carrega o tipo escolhido
  const { data: trabalho } = await supabase
    .from('trabalhos')
    .select('id, tipo_trabalho')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  if (!descricao?.trim() || descricao.trim().length < 20) {
    return NextResponse.json({ error: 'Descreva sua ideia com mais detalhes.' }, { status: 400 })
  }

  // O fluxo correto depende do tipo de trabalho ESCOLHIDO pelo usuário.
  const tipoTrabalho = (trabalho as { tipo_trabalho?: string }).tipo_trabalho ?? undefined
  const fluxo = tipoTrabalho ? getFluxo(tipoTrabalho) : null

  const { system, user: userPrompt } = buildPlanejadorPrompt(descricao.trim(), {
    tipoTrabalho,
    nomeTipo: fluxo?.nome_completo,
    requerCep: fluxo?.requer_cep ?? false,
    requerPrisma: fluxo?.requer_prisma ?? false,
  })
  // Tokens generosos: a resposta tem a ANÁLISE (texto livre) + o PLANO JSON completo
  // (roadmap + checklist). Com pouco token, a análise ou o JSON poderiam ser cortados.
  return streamText(system, userPrompt, false, 16000)
}
