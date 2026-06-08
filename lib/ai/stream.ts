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

// Chamada não-streaming — retorna string completa.
// IMPORTANTE: detecta truncamento por limite de tokens (finish_reason === 'length')
// e CONTINUA a geração automaticamente, para o documento nunca ser cortado no meio
// (ex.: uma seção sumir porque o texto bateu no teto de tokens).
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  fast = true,
  maxTokens = 4096
): Promise<string> {
  const model = fast ? currentModel.fast : currentModel.smart

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let completo = ''
  // Até 3 continuações: cobre textos longos sem risco de loop infinito.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const completion = await aiClient.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
    })
    const choice = completion.choices[0]
    const parte = choice?.message?.content ?? ''
    completo += parte

    // Só continua se foi cortado por tamanho (não por parada natural do modelo).
    if (choice?.finish_reason !== 'length' || !parte.trim()) break

    messages.push({ role: 'assistant', content: parte })
    messages.push({
      role: 'user',
      content: 'Continue exatamente de onde você parou, sem repetir nenhuma palavra já escrita e sem reabrir seções anteriores. Apenas prossiga o texto.',
    })
  }

  return completo
}
