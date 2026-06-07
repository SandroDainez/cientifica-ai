import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { callAI, streamStringComEfeito } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho } from '@/types'

export const maxDuration = 120

/**
 * Aplica uma sugestão específica ao texto de uma seção usando IA.
 * Recebe o texto atual + a descrição da sugestão e retorna o texto corrigido.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'sugerir-melhorias')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId, chaveSecao, conteudo, sugestaoTitulo, sugestaoDescricao } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    conteudo: string
    sugestaoTitulo: string
    sugestaoDescricao: string
  }

  if (!conteudo?.trim() || !sugestaoDescricao?.trim()) {
    return NextResponse.json({ error: 'Conteúdo e sugestão são obrigatórios' }, { status: 400 })
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const systemPrompt = buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao,
    trabalho.area_conhecimento ?? undefined,
  )

  const userPrompt = `Você recebeu um texto acadêmico e uma sugestão de melhoria específica. Sua tarefa é aplicar EXATAMENTE essa sugestão ao texto e devolver o texto completo corrigido.

SUGESTÃO A APLICAR:
Título: "${sugestaoTitulo}"
Descrição: "${sugestaoDescricao}"

REGRAS ABSOLUTAS:
1. Aplique APENAS a mudança descrita na sugestão — não altere o restante do texto
2. Preserve 100% do conteúdo, dados, citações e estrutura que não se relacionam à sugestão
3. Mantenha a formatação markdown (**, ##, listas, etc.)
4. Preserve todas as citações bibliográficas intactas — (SOBRENOME, ANO), [1], etc.
5. TABELAS são INTOCÁVEIS: copie cada linha de tabela markdown (que começa com "|") EXATAMENTE como está — mesmos valores, mesmas colunas, mesma ordem. NUNCA reformate, recalcule ou altere uma tabela. Modifique apenas o TEXTO em prosa.
6. Entregue SOMENTE o texto corrigido — sem comentários, sem explicações, sem títulos extras

TEXTO ORIGINAL A CORRIGIR:
${conteudo}

Texto corrigido (completo, com a sugestão aplicada):`

  // Correção CIRÚRGICA: callAI com temperatura baixa (0.3) — preciso, não
  // criativo. streamText (temp 0.9) reescrevia o texto e às vezes piorava.
  // Retry com fallback de modelo; valida o resultado antes de aplicar.
  const nPalavras = conteudo.split(/\s+/).filter(Boolean).length
  const maxTokens = Math.max(6000, nPalavras * 3)
  let corrigido = ''
  let ultimoErro = ''
  for (const fast of [false, false, true]) {
    if (corrigido) break
    try {
      const out = await callAI(systemPrompt, userPrompt, fast, maxTokens)
      // Aceita só se vier conteúdo plausível (não vazio e sem truncar demais).
      // Permite encurtar (ex.: "reduzir extensão"), mas rejeita perda > 55%.
      if (out?.trim() && out.split(/\s+/).filter(Boolean).length >= nPalavras * 0.45) {
        corrigido = out.trim()
      }
    } catch (err) {
      ultimoErro = err instanceof Error ? err.message : String(err)
      console.error('[aplicar-sugestao] tentativa falhou:', ultimoErro)
    }
  }

  if (!corrigido) {
    // NÃO devolve texto ruim/erro como conteúdo — retorna erro para o cliente
    // manter o texto original intacto.
    return NextResponse.json(
      { error: `Não foi possível aplicar a sugestão agora${ultimoErro ? ` (${ultimoErro})` : ''}. Tente novamente.` },
      { status: 502 }
    )
  }

  return streamStringComEfeito(corrigido)
}
