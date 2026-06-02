import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { streamText, callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho } from '@/types'

export const maxDuration = 120

/**
 * Aplica uma sugestão específica ao texto de uma seção usando IA.
 * Recebe o texto atual + a descrição da sugestão e retorna o texto corrigido.
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

  const { trabalhoId, chaveSecao, conteudo, sugestaoTitulo, sugestaoDescricao } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    conteudo: string
    sugestaoTitulo: string
    sugestaoDescricao: string
  }

  if (!conteudo?.trim() || !sugestaoDescricao?.trim()) {
    return NextResponse.json({ error: 'Conteúdo e sugestão são obrigatórios' }, { status: 400 })
  }

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
    trabalho.formato_citacao,
    trabalho.area_conhecimento ?? undefined,
  )

  const userPrompt = `Você recebeu um texto acadêmico e uma sugestão de melhoria específica. Sua tarefa é aplicar EXATAMENTE essa sugestão ao texto e devolver o texto completo corrigido.

SUGESTÃO A APLICAR:
Título: "${sugestaoTitulo}"
Descrição: "${sugestaoDescricao}"

REGRAS ABSOLUTAS:
1. Aplique APENAS a mudança descrita na sugestão — não altere o restante do texto
2. Preserve 100% do conteúdo, dados, citações e estrutura que não se relacionam à sugestão
3. Mantenha a formatação markdown (**, ##, listas, etc.)
4. Preserve todas as citações bibliográficas intactas — (SOBRENOME, ANO), [1], etc.
5. Entregue SOMENTE o texto corrigido — sem comentários, sem explicações, sem títulos extras

TEXTO ORIGINAL A CORRIGIR:
${conteudo}

Texto corrigido (completo, com a sugestão aplicada):`

  // Streaming direto — o cliente recebe o texto corrigido em tempo real
  return streamText(systemPrompt, userPrompt, false, Math.max(6000, conteudo.split(/\s+/).length * 3))
}
