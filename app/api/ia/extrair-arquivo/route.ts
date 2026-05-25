import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aiClient, currentModel } from '@/lib/ai/client'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'

// Tamanho máximo: 10 MB
const MAX_SIZE_BYTES = 10 * 1024 * 1024

// Tipos de imagem aceitos para extração via visão de IA
const MIME_IMAGEM = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

// System prompt para extração de dados científicos
const SYSTEM_EXTRACAO = `Você é um assistente especializado em extração de dados científicos de imagens.
Sua tarefa é analisar a imagem e extrair TODOS os dados visíveis de forma organizada.

Regras obrigatórias:
- Extraia todos os valores numéricos, percentuais, médias, desvios-padrão, p-valores
- Se for tabela: reproduza em formato texto (colunas separadas por | e linhas por quebra de linha)
- Se for gráfico: liste todos os valores dos eixos X e Y, título e legendas
- Se for texto/planilha impressa: transcreva os dados exatamente como aparecem
- Mantenha números EXATOS — não arredonde
- Responda SOMENTE com os dados extraídos, sem introdução ou explicação
- Use português`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'extrair-arquivo')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({
      error: `Arquivo muito grande. Máximo: 10 MB (arquivo: ${(file.size / 1024 / 1024).toFixed(1)} MB)`
    }, { status: 400 })
  }

  const mimeType = file.type

  if (!MIME_IMAGEM.has(mimeType)) {
    return NextResponse.json({
      error: `Este endpoint processa apenas imagens (PNG, JPG, WEBP). Para CSV e TXT, o arquivo é lido diretamente no navegador.`
    }, { status: 400 })
  }

  try {
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Usa o modelo com suporte a visão
    const completion = await aiClient.chat.completions.create({
      model: currentModel.smart,
      messages: [
        { role: 'system', content: SYSTEM_EXTRACAO },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Extraia todos os dados científicos desta imagem de forma organizada.',
            },
          ] as ChatCompletionContentPart[],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    })

    const textoExtraido = completion.choices[0]?.message?.content?.trim() ?? ''

    if (!textoExtraido || textoExtraido.length < 10) {
      return NextResponse.json({
        error: 'Não foi possível extrair dados desta imagem. Certifique-se de que a imagem contém dados legíveis.'
      }, { status: 422 })
    }

    return NextResponse.json({
      conteudo: textoExtraido,
      nomeArquivo: file.name,
      tipoArquivo: mimeType,
    })
  } catch (err) {
    console.error('[extrair-arquivo] Erro:', err)
    return NextResponse.json({
      error: 'Erro ao processar a imagem. Tente novamente ou copie os dados manualmente.'
    }, { status: 500 })
  }
}
