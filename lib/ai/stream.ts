import { aiClient, currentModel } from './client'

// Retorna uma Response com streaming de texto via SSE
export function streamText(
  systemPrompt: string,
  userPrompt: string,
  fast = false,
  maxTokens = 8192
): Response {
  const model = fast ? currentModel.fast : currentModel.smart

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        const completion = await aiClient.chat.completions.create({
          model,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: maxTokens,
        })

        let recebeu = false
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            recebeu = true
            controller.enqueue(enc.encode(delta))
          }
        }
        if (!recebeu) {
          controller.enqueue(enc.encode('⚠️ A IA não retornou conteúdo desta vez. Clique para tentar novamente.'))
        }
      } catch (err) {
        // IMPORTANTE: os headers 200 já foram enviados quando o stream começa,
        // então controller.error() chegaria ao cliente como falha de rede
        // ("Failed to fetch"), escondendo o motivo. Em vez disso, transmitimos a
        // mensagem de erro como texto para o usuário ver o que aconteceu.
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[streamText] erro:', msg)
        try { controller.enqueue(enc.encode(`⚠️ Erro ao gerar: ${msg}. Tente novamente.`)) } catch { /* já fechado */ }
      } finally {
        try { controller.close() } catch { /* já fechado/errored */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}

/** Transmite uma string já pronta com efeito de digitação (sem chamar a IA). */
export function streamStringComEfeito(texto: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      for (let i = 0; i < texto.length; i += 24) controller.enqueue(enc.encode(texto.slice(i, i + 24)))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}

// Chamada não-streaming — retorna string completa
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  fast = true,
  maxTokens = 4096
): Promise<string> {
  const model = fast ? currentModel.fast : currentModel.smart

  const completion = await aiClient.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  })

  return completion.choices[0]?.message?.content ?? ''
}
