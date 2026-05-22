import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, buildGerarReferenciasPrompt } from '@/lib/ai/prompts'
import { getTransversalPrompt } from '@/lib/ai/prompts-secoes'
import { callAI } from '@/lib/ai/stream'
import type { Trabalho } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId, tema } = await request.json() as {
    trabalhoId: string
    tema?: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const systemPrompt = getTransversalPrompt('T1') ?? buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  const temaFinal = tema || trabalho.titulo || `trabalho de ${trabalho.tipo_trabalho}`
  const area = trabalho.area_conhecimento || 'área não especificada'

  const userPrompt = buildGerarReferenciasPrompt(
    temaFinal,
    area,
    trabalho.tipo_trabalho,
    trabalho.formato_citacao
  )

  try {
    const raw = await callAI(systemPrompt, userPrompt, false)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Resposta inválida da IA')

    const referencias = JSON.parse(jsonMatch[0])
    return NextResponse.json({ referencias })
  } catch (err) {
    console.error('Erro ao gerar referências:', err)
    return NextResponse.json({ error: 'Erro ao gerar referências' }, { status: 500 })
  }
}
