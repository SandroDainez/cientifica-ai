import { aiClient, currentModel } from './client'

// Retorna uma Response com streaming de texto via SSE
export function streamText(
  systemPrompt: string,
  userPrompt: string,
  fast = false
): Response {
  const model = fast ? currentModel.fast : currentModel.smart

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await aiClient.chat.completions.create({
          model,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
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
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}

// Chamada não-streaming — retorna string completa
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  fast = true
): Promise<string> {
  const model = fast ? currentModel.fast : currentModel.smart

  const completion = await aiClient.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  })

  return completion.choices[0]?.message?.content ?? ''
}
