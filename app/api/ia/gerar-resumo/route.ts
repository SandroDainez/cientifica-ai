import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, buildGerarResumoPrompt } from '@/lib/ai/prompts'
import { streamText } from '@/lib/ai/stream'
import type { Trabalho } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId } = await request.json() as { trabalhoId: string }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  // Carrega seções concluídas
  const { data: secoes } = await supabase
    .from('secoes_trabalho')
    .select('nome_secao, conteudo, status')
    .eq('trabalho_id', trabalhoId)
    .in('status', ['gerado', 'editado', 'aprovado'])
    .order('ordem')

  if (!secoes || secoes.length === 0) {
    return NextResponse.json({ error: 'Nenhuma seção concluída encontrada' }, { status: 400 })
  }

  const secoesConteudo = Object.fromEntries(
    secoes.map(s => [s.nome_secao, s.conteudo ?? ''])
  )

  const systemPrompt = buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  const userPrompt = buildGerarResumoPrompt(trabalho.tipo_trabalho, secoesConteudo)

  return streamText(systemPrompt, userPrompt, false)
}
