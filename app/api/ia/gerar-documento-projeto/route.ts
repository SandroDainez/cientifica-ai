import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildDocumentoPrompt } from '@/lib/ai/prompts/documentos-projeto'
import type { Trabalho, DadosProjeto, TipoDocumento } from '@/types'

// Documentos acadêmicos são longos — aumentar timeout da função Vercel
export const maxDuration = 300

// Tokens por tipo de documento — documentos estruturados longos precisam de mais
const MAX_TOKENS_POR_TIPO: Partial<Record<TipoDocumento, number>> = {
  revisao_literatura:  6000,
  protocolo_cep:       6000,
  tcle:                4000,
  carta_anuencia:      2000,
  instrumento_coleta:  4000,
  calculo_amostral:    3000,
  guia_coleta:         4000,
  guia_analise:        5000,
  sugestoes_periodicos: 3000,
  carta_submissao:     2000,
  checklist_submissao: 4000,
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-documento')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429 }
    )
  }

  const body = await request.json() as {
    trabalhoId: string
    tipoDocumento: TipoDocumento
  }

  const { trabalhoId, tipoDocumento } = body

  if (!trabalhoId || !tipoDocumento) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  // Validate ownership and load dados_projeto
  const { data: trabalhoRow } = await supabase
    .from('trabalhos')
    .select('id, titulo, dados_trabalho')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoRow) {
    return NextResponse.json({ error: 'Trabalho não encontrado.' }, { status: 404 })
  }

  const trabalho = trabalhoRow as Pick<Trabalho, 'id' | 'titulo' | 'dados_trabalho'>
  const dadosTrabalho = (trabalho.dados_trabalho as Record<string, unknown>) ?? {}
  const dadosProjeto = dadosTrabalho['dados_projeto'] as DadosProjeto | undefined

  if (!dadosProjeto) {
    return NextResponse.json(
      { error: 'Projeto não encontrado. Gere o plano do projeto primeiro.' },
      { status: 400 }
    )
  }

  const { system, user: userPrompt } = buildDocumentoPrompt(
    tipoDocumento,
    dadosProjeto,
    trabalho.titulo ?? undefined
  )

  const maxTokens = MAX_TOKENS_POR_TIPO[tipoDocumento] ?? 4000

  return streamText(system, userPrompt, false, maxTokens)
}
