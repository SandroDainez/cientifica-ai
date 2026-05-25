import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, buildGerarResumoPrompt, buildGerarAbstractPrompt } from '@/lib/ai/prompts'

export const maxDuration = 300
import { streamText } from '@/lib/ai/stream'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-resumo')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const body = await request.json() as {
    trabalhoId: string
    modo?: 'resumo_pt' | 'abstract_en'
    resumo_pt?: string
  }
  const { trabalhoId, modo = 'resumo_pt', resumo_pt } = body

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const systemPrompt = buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  // Modo abstract: recebe o resumo PT já pronto
  if (modo === 'abstract_en') {
    if (!resumo_pt?.trim()) {
      return NextResponse.json({ error: 'Resumo em português necessário para gerar abstract' }, { status: 400 })
    }
    const userPrompt = buildGerarAbstractPrompt(trabalho.tipo_trabalho, resumo_pt)
    return streamText(systemPrompt, userPrompt, false)
  }

  // Modo resumo PT: usa as seções concluídas
  const { data: secoes } = await supabase
    .from('secoes_trabalho')
    .select('nome_secao, chave_secao, conteudo, status')
    .eq('trabalho_id', trabalhoId)
    .in('status', ['gerado', 'editado', 'aprovado'])
    .order('ordem')

  if (!secoes || secoes.length === 0) {
    return NextResponse.json({ error: 'Nenhuma seção concluída encontrada' }, { status: 400 })
  }

  const secoesConteudo = Object.fromEntries(
    secoes
      .filter(s => s.conteudo && s.chave_secao !== 'resumo')
      .map(s => [s.nome_secao, extrairTextoSecao(s.conteudo ?? '')])
  )

  const userPrompt = buildGerarResumoPrompt(trabalho.tipo_trabalho, secoesConteudo)
  return streamText(systemPrompt, userPrompt, false)
}
