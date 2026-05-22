import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildSystemPrompt, buildSugerirMelhorasPrompt } from '@/lib/ai/prompts'
import { callAI } from '@/lib/ai/stream'
import type { Trabalho, SugestaoIA } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId, chaveSecao, conteudo } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    conteudo: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  if (!fase) return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 })

  const systemPrompt = buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  const userPrompt = buildSugerirMelhorasPrompt(fase.nome, conteudo)

  try {
    const raw = await callAI(systemPrompt, userPrompt, true)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Resposta inválida da IA')

    const sugestoes: SugestaoIA[] = JSON.parse(jsonMatch[0])

    // Atualiza sugestões na seção
    await supabase
      .from('secoes_trabalho')
      .update({ sugestoes_ia: sugestoes })
      .eq('trabalho_id', trabalhoId)
      .eq('chave_secao', chaveSecao)

    return NextResponse.json({ sugestoes })
  } catch (err) {
    console.error('Erro em sugerir melhorias:', err)
    return NextResponse.json({ error: 'Erro ao gerar sugestões' }, { status: 500 })
  }
}
