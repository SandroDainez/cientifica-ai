import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildAnalisarPlanilhaPrompt } from '@/lib/ai/prompts'
import { detectarCampo, getRegrasCampoAcademico } from '@/lib/ai/campos-academicos'
import { streamText } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, DadosProjeto } from '@/types'

export const maxDuration = 120

/**
 * Analisa os dados de uma planilha e auxilia o pesquisador na seção atual.
 * Retorna streaming de markdown com: interpretação dos dados, estatísticas
 * descritivas, achados, análises recomendadas e orientação para a seção.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'sugerir-melhorias')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId, chaveSecao, dadosPlanilha } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    dadosPlanilha: string
  }

  if (!dadosPlanilha?.trim() || dadosPlanilha.trim().length < 10) {
    return NextResponse.json({ error: 'Adicione dados na planilha antes de analisar.' }, { status: 400 })
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const dadosProjeto = ((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as DadosProjeto | undefined) ?? null

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  const nomeSecao = fase?.nome ?? 'Resultados'

  // Regras do campo acadêmico — análise estatística varia por área
  const campo = detectarCampo(trabalho.area_conhecimento ?? '')
  const regrasCampo = getRegrasCampoAcademico(campo, trabalho.tipo_trabalho)

  const systemPrompt = `Você é um estatístico e metodologista sênior, especialista na área de ${trabalho.area_conhecimento ?? 'pesquisa científica'}. Auxilia pesquisadores a interpretar dados de forma rigorosa e prática.
${regrasCampo}`

  const userPrompt = buildAnalisarPlanilhaPrompt(dadosPlanilha, nomeSecao, chaveSecao, {
    tipoTrabalho: trabalho.tipo_trabalho,
    area: trabalho.area_conhecimento ?? undefined,
    pergunta_pesquisa: dadosProjeto?.pergunta_pesquisa,
    objetivo_geral: dadosProjeto?.objetivo_geral,
    delineamento: dadosProjeto?.delineamento,
  })

  return streamText(systemPrompt, userPrompt, false, 4000)
}
