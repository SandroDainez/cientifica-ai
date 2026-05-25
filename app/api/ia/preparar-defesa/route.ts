import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildPrepararDefesaPrompt } from '@/lib/ai/prompts/preparar-defesa'
import type { Trabalho } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'preparar-defesa')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Aguarde um momento antes de gerar outra análise.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId } = await request.json() as { trabalhoId: string }
  if (!trabalhoId) return NextResponse.json({ error: 'trabalhoId obrigatório' }, { status: 400 })

  // Carrega trabalho com ownership check
  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  // Carrega todas as seções com conteúdo
  const { data: secoesData } = await supabase
    .from('secoes_trabalho')
    .select('nome_secao, conteudo')
    .eq('trabalho_id', trabalhoId)
    .in('status', ['gerado', 'editado', 'aprovado'])
    .order('ordem')

  const secoes = (secoesData ?? []).map(s => ({
    nome_secao: s.nome_secao as string,
    conteudo: (s.conteudo as string) ?? '',
  }))

  const { system, user: userPrompt } = buildPrepararDefesaPrompt(trabalho, secoes)

  try {
    // Análise densa — usa modelo smart com tokens generosos
    const raw = await callAI(system, userPrompt, false, 8000)

    // Extrai JSON após o delimitador
    const jsonMatch = raw.match(/===ANALISE_JSON===\s*([\s\S]+)/)
    if (!jsonMatch) {
      console.error('[preparar-defesa] Resposta sem delimitador JSON:', raw.slice(0, 300))
      throw new Error('Resposta inválida da IA. Tente novamente.')
    }

    let analise
    try {
      analise = JSON.parse(jsonMatch[1].trim())
    } catch (parseErr) {
      console.error('[preparar-defesa] JSON inválido:', parseErr, jsonMatch[1].slice(0, 300))
      throw new Error('Erro ao processar análise. Tente novamente.')
    }

    return NextResponse.json({ analise, secoes_analisadas: secoes.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[preparar-defesa] Erro:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
