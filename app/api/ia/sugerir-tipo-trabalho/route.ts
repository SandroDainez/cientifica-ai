import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'sugerir-tipo-trabalho')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429 }
    )
  }

  const { descricao } = await request.json() as { descricao?: string }

  if (!descricao?.trim() || descricao.trim().length < 10) {
    return NextResponse.json({ error: 'Descreva sua ideia com pelo menos 10 caracteres.' }, { status: 400 })
  }

  const system = `Você é um orientador acadêmico brasileiro experiente.
Dado o que o pesquisador descreve, identifique qual tipo de trabalho acadêmico é mais adequado.
Responda APENAS com JSON válido, sem markdown, sem texto extra.`

  const user_prompt = `O pesquisador descreveu sua ideia assim:
"${descricao.trim()}"

Tipos disponíveis:
- tcc: TCC — Trabalho de Conclusão de Curso de graduação, exigido para colação de grau
- artigo_original: Artigo Original — pesquisa inédita com hipótese, método e resultados, para publicação em periódico
- artigo_revisao: Artigo de Revisão — revisão narrativa da literatura sobre um tema, sem coleta primária
- relato_caso: Relato de Caso — descrição detalhada de um caso clínico incomum ou instrutivo
- monografia: Monografia — trabalho de especialização lato sensu ou pós-graduação
- dissertacao_mestrado: Dissertação de Mestrado — pesquisa aprofundada para grau de Mestre
- tese_doutorado: Tese de Doutorado — contribuição original e inédita para obtenção do título de Doutor
- revisao_sistematica: Revisão Sistemática — revisão com protocolo PRISMA, critérios de inclusão/exclusão rigorosos e análise estruturada
- projeto_pesquisa: Projeto de Pesquisa — proposta detalhada de pesquisa futura, geralmente para financiamento ou CEP
- relatorio_ic: Relatório de IC — relatório de Iniciação Científica para agência de fomento (CNPq, FAPESP, etc.)

Retorne JSON neste formato exato:
{
  "tipo": "<um dos tipos acima>",
  "explicacao": "<2-3 frases em português explicando por que este tipo é o mais adequado para a ideia descrita, mencionando características específicas da descrição>",
  "alternativa": "<tipo alternativo caso o pesquisador prefira algo diferente, ou null>",
  "explicacao_alternativa": "<1 frase sobre quando escolher a alternativa, ou null>"
}`

  try {
    const raw = await callAI(system, user_prompt, true, 512)

    // Extrai o JSON da resposta (ignora texto antes/depois)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Resposta inválida da IA')

    const parsed = JSON.parse(match[0]) as {
      tipo: string
      explicacao: string
      alternativa?: string | null
      explicacao_alternativa?: string | null
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Erro ao analisar. Tente novamente.' }, { status: 500 })
  }
}
