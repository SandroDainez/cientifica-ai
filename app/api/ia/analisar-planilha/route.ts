import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildAnalisarPlanilhaPrompt } from '@/lib/ai/prompts'
import { callAI, streamStringComEfeito } from '@/lib/ai/stream'
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

  // System prompt CURTO e focado. O bloco completo de regras do campo é longo e,
  // somado aos dados, fazia o modelo retornar vazio / derrubar o streaming
  // (aparecia "Failed to fetch" no cliente). Mantemos só o essencial aqui.
  const systemPrompt = `Você é um estatístico e metodologista sênior, especialista na área de ${trabalho.area_conhecimento ?? 'pesquisa científica'}. Interpreta dados de forma rigorosa, prática e objetiva, usando SOMENTE os números reais fornecidos (nunca inventa valores).`

  const userPrompt = buildAnalisarPlanilhaPrompt(dadosPlanilha, nomeSecao, chaveSecao, {
    tipoTrabalho: trabalho.tipo_trabalho,
    area: trabalho.area_conhecimento ?? undefined,
    pergunta_pesquisa: dadosProjeto?.pergunta_pesquisa,
    objetivo_geral: dadosProjeto?.objetivo_geral,
    delineamento: dadosProjeto?.delineamento,
  })

  // Geração confiável: callAI (não-streaming) com retry e fallback de modelo.
  // Devolve a string pronta com efeito de digitação — assim um erro da IA vira
  // mensagem clara em vez de "Failed to fetch".
  let analise = ''
  let ultimoErro = ''
  const tentativas: Array<{ fast: boolean }> = [{ fast: false }, { fast: false }, { fast: true }]
  for (const t of tentativas) {
    if (analise.trim()) break
    try {
      const out = await callAI(systemPrompt, userPrompt, t.fast, 4000)
      console.log('[analisar-planilha] resposta len=', out?.length ?? 0, 'fast=', t.fast)
      if (out?.trim()) analise = out.trim()
    } catch (err) {
      ultimoErro = err instanceof Error ? err.message : String(err)
      console.error('[analisar-planilha] tentativa falhou:', ultimoErro)
    }
  }

  if (!analise) {
    const msg = `⚠️ A IA não retornou a análise desta vez${ultimoErro ? ` (${ultimoErro})` : ''}. Tente novamente em alguns segundos. Se persistir, confira se os dados estão em colunas (ID, grupo, variáveis) e tente de novo.`
    return streamStringComEfeito(msg)
  }

  return streamStringComEfeito(analise)
}
