import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  // Prompt FOCADO de editor cirúrgico (não o de geração, que faz reescrever tudo).
  const systemPrompt = `Você é um EDITOR de textos acadêmicos especializado em correções CIRÚRGICAS. Você recebe um texto pronto e UMA instrução de melhoria específica. Sua única função é APLICAR essa instrução, mudando o MÍNIMO necessário no texto.

Princípios inegociáveis:
- Faça SOMENTE o que a instrução pede. NÃO reescreva frases ou parágrafos que a instrução não menciona.
- NÃO adicione conteúdo, ideias ou citações novas. NÃO remova dados, números ou citações existentes (a menos que a instrução peça explicitamente).
- Preserve o estilo, o tom, a formatação markdown e as TABELAS (linhas que começam com "|") exatamente como estão.
- NUNCA INVENTE: se a instrução pedir para completar/adicionar uma referência, dado, número, autor, ano, título ou periódico que você NÃO tem com certeza, NÃO fabrique nada — mantenha a citação/marcador como está. É melhor deixar como está do que inventar.
- NÃO "encha linguiça": se a instrução for expandir/aprofundar, agregue apenas conteúdo com substância real e ancorado em citações já presentes; jamais adicione frases vazias só para aumentar o tamanho.
- O texto resultante deve ser claramente MELHOR após a correção — nunca pior, mais confuso ou mais raso. Se a única forma de cumprir a instrução for piorar o texto ou inventar, prefira fazer uma melhora mínima e segura.
- Responda SOMENTE com o texto completo já corrigido, sem comentários, sem aspas, sem títulos extras.`

  const userPrompt = `INSTRUÇÃO DE MELHORIA (aplique exatamente isto, e nada além):
• ${sugestaoTitulo}
• ${sugestaoDescricao}

Aplique a instrução acima ao TEXTO abaixo, alterando apenas o que for necessário para cumpri-la. Devolva o texto inteiro já corrigido (as partes não afetadas devem permanecer idênticas).

TEXTO:
${conteudo}

TEXTO CORRIGIDO (completo):`

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
