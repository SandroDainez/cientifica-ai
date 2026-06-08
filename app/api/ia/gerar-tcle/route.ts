import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTransversalPrompt } from '@/lib/ai/prompts-secoes'
import { streamText, callAI, streamStringComEfeito } from '@/lib/ai/stream'
import { removerTravessoes } from '@/lib/ai/validar-citacoes'
import { checkRateLimit } from '@/lib/auth/rate-limit'

export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-tcle')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { titulo, objetivo, metodologia, riscos, beneficios, pesquisador, instituicao } =
    await request.json() as {
      titulo?: string; objetivo?: string; metodologia?: string
      riscos?: string; beneficios?: string; pesquisador?: string; instituicao?: string
    }

  const systemPrompt = getTransversalPrompt('T5')
    ?? `Você é um especialista em bioética e regulamentação de pesquisa com seres humanos no Brasil.
Você conhece profundamente a Resolução CNS 466/2012 e suas complementares.
Escreva documentos em português brasileiro formal e acessível.`

  const userPrompt = `Gere um modelo completo de Termo de Consentimento Livre e Esclarecido (TCLE) para a seguinte pesquisa:

**Título:** ${titulo ?? '[TÍTULO DO PROJETO]'}
**Pesquisador Responsável:** ${pesquisador ?? '[NOME DO PESQUISADOR]'}
**Instituição:** ${instituicao ?? '[NOME DA INSTITUIÇÃO]'}
**Objetivo:** ${objetivo ?? '[OBJETIVO DA PESQUISA]'}
**Metodologia:** ${metodologia ?? '[DESCREVER PROCEDIMENTOS]'}
**Riscos:** ${riscos ?? '[RISCOS IDENTIFICADOS]'}
**Benefícios:** ${beneficios ?? '[BENEFÍCIOS ESPERADOS]'}

O TCLE deve seguir obrigatoriamente a Resolução CNS 466/2012 e incluir:
1. Identificação do pesquisador e instituição
2. Explicação clara do que é a pesquisa e seus objetivos (linguagem acessível)
3. Descrição dos procedimentos de forma compreensível
4. Riscos e desconfortos possíveis
5. Benefícios esperados
6. Garantia de confidencialidade dos dados
7. Direito de retirada sem penalidade
8. Informações de contato do pesquisador e do CEP
9. Espaço para assinatura do participante e do pesquisador
10. Duas vias (uma para o participante, uma para o pesquisador)

Use linguagem clara e acessível (não técnica) para o participante.
Formate como documento formal com título, seções numeradas e campos de assinatura.`

  // Pós-processamento mínimo padronizado (remove travessões/protege decimais);
  // cai no streaming cru se a geração não-streaming falhar.
  try {
    const texto = await callAI(systemPrompt, userPrompt, false, 6000)
    if (texto && texto.trim().length > 20) return streamStringComEfeito(removerTravessoes(texto))
  } catch { /* fallback abaixo */ }
  return streamText(systemPrompt, userPrompt, false)
}
