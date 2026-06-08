import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText, callAI, streamStringComEfeito } from '@/lib/ai/stream'
import { removerTravessoes } from '@/lib/ai/validar-citacoes'

export const maxDuration = 300
import { extrairTextoSecao } from '@/lib/ai/utils'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-questionario')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId, tipoInstrumento } = await request.json() as {
    trabalhoId: string; tipoInstrumento?: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  // Busca seções para contexto
  const { data: secoes } = await supabase
    .from('secoes_trabalho').select('nome_secao, conteudo').eq('trabalho_id', trabalhoId)
    .in('status', ['gerado', 'editado', 'aprovado'])

  const contexto = secoes?.map(s => `${s.nome_secao}: ${extrairTextoSecao(s.conteudo ?? '').substring(0, 400)}`).join('\n') ?? ''

  const systemPrompt = `Você é um especialista em metodologia de pesquisa científica e construção de instrumentos de coleta de dados.
Você conhece os padrões metodológicos para questionários, escalas e formulários de coleta em pesquisa científica.
Escreva em português brasileiro formal.`

  const userPrompt = `Com base no trabalho abaixo, crie um ${tipoInstrumento ?? 'questionário'} para coleta de dados.

**Tipo de trabalho:** ${trabalho.tipo_trabalho}
**Área:** ${trabalho.area_conhecimento ?? 'não informada'}

**Contexto das seções:**
${contexto || 'Nenhuma seção ainda disponível. Use o tema do trabalho para criar perguntas relevantes.'}

Crie um questionário com:
1. Seção inicial: Identificação (dados socioeconômicos básicos relevantes para o estudo)
2. Seções temáticas baseadas nos objetivos do trabalho (2-4 seções)
3. Perguntas objetivas quando possível
4. Inclua escalas Likert quando avaliar percepções/opiniões
5. Instrução de preenchimento no início

Para cada pergunta, indique:
- Número
- Pergunta
- Tipo de resposta: [ ] Aberta / [ ] Múltipla escolha (liste opções) / [ ] Escala Likert / [ ] Numérica

Formate como um questionário real, pronto para aplicação.`

  // Pós-processamento mínimo padronizado (remove travessões/protege decimais);
  // cai no streaming cru se a geração não-streaming falhar.
  try {
    const texto = await callAI(systemPrompt, userPrompt, false, 6000)
    if (texto && texto.trim().length > 20) return streamStringComEfeito(removerTravessoes(texto))
  } catch { /* fallback abaixo */ }
  return streamText(systemPrompt, userPrompt, false)
}
