import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { aiClient, currentModel } from '@/lib/ai/client'
import type { Trabalho, MensagemIA } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId, mensagens, chaveSecao } = await request.json() as {
    trabalhoId: string
    mensagens: MensagemIA[]
    chaveSecao?: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const baseSystem = buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  const contextSystem = chaveSecao
    ? `${baseSystem}\n\nO usuário está trabalhando na seção "${chaveSecao}". Responda perguntas relacionadas a essa seção com foco no contexto do trabalho em elaboração.`
    : `${baseSystem}\n\nResponda perguntas gerais sobre o trabalho e a escrita científica.`

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await aiClient.chat.completions.create({
          model: currentModel.fast,
          stream: true,
          messages: [
            { role: 'system', content: contextSystem },
            ...mensagens.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 1024,
        })

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(new TextEncoder().encode(delta))
          }
        }
      } catch (err) {
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
