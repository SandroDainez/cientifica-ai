import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText, callAI, streamStringComEfeito } from '@/lib/ai/stream'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Referencia, FormatoCitacao } from '@/types'

// Documentos acadêmicos são longos — aumentar timeout da função Vercel
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'refinar-documento')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429 }
    )
  }

  const body = await request.json() as {
    trabalhoId: string
    tipoDocumento: string
    conteudo_atual: string
    instrucoes: string
  }

  const { trabalhoId, tipoDocumento, conteudo_atual, instrucoes } = body

  if (!trabalhoId || !tipoDocumento) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  if (!conteudo_atual || typeof conteudo_atual !== 'string' || conteudo_atual.trim() === '') {
    return NextResponse.json({ error: 'O conteúdo atual do documento é obrigatório.' }, { status: 400 })
  }

  if (!instrucoes || typeof instrucoes !== 'string' || instrucoes.trim() === '') {
    return NextResponse.json({ error: 'As instruções de refinamento são obrigatórias.' }, { status: 400 })
  }

  const system = `Você é um especialista em documentos científicos acadêmicos brasileiros. \
Domina todos os tipos de documentos utilizados em pesquisa científica no Brasil, incluindo: \
TCLE (Termo de Consentimento Livre e Esclarecido), protocolo CEP, carta de anuência, \
instrumento de coleta de dados, revisão de literatura, cálculo amostral, guia de coleta, \
guia de análise, sugestões de periódicos, carta de submissão, checklist de submissão, \
entre outros. Você conhece profundamente as normas da ABNT, as resoluções do CNS/CONEP \
e os padrões exigidos pelos comitês de ética em pesquisa no Brasil.`

  const userPrompt = `Refine o documento abaixo seguindo exatamente as instruções do pesquisador. \
Mantenha toda a estrutura, formatação (markdown, seções numeradas, campos de assinatura etc.) \
e conteúdo não mencionado nas instruções. Aplique SOMENTE as alterações pedidas.

**Instruções do pesquisador:**
${instrucoes}

**Documento atual:**
${conteudo_atual}`

  // Carrega referências e formato do trabalho para o pós-processamento padronizado
  // (resolução de citações, travessões, código R, placeholders) — igual à geração.
  const [{ data: refsData }, { data: trab }] = await Promise.all([
    supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at'),
    supabase.from('trabalhos').select('formato_citacao').eq('id', trabalhoId).single(),
  ])
  const referencias = (refsData ?? []) as Referencia[]
  const formato = (trab?.formato_citacao ?? 'abnt') as FormatoCitacao

  try {
    const texto = await callAI(system, userPrompt, false, 8000)
    if (texto && texto.trim().length > 30) {
      return streamStringComEfeito(posProcessarTextoGerado(texto, referencias, formato))
    }
  } catch { /* fallback streaming abaixo */ }
  return streamText(system, userPrompt, false)
}
