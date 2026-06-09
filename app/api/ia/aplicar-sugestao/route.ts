import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI, streamStringComEfeito } from '@/lib/ai/stream'
import { removerTravessoes } from '@/lib/ai/validar-citacoes'
import { parseEdicoes, aplicarEdicoes, reescritaSegura } from '@/lib/ai/aplicar-edicoes'
import { checkRateLimit } from '@/lib/auth/rate-limit'

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

  const nPalavras = conteudo.split(/\s+/).filter(Boolean).length
  const maxTokens = Math.max(4000, nPalavras * 3)
  let ultimoErro = ''

  // ── ESTRATÉGIA 1 (preferida): EDIÇÕES PONTUAIS ─────────────────────────────
  // O modelo devolve só os trechos a trocar (buscar→substituir); o código aplica
  // a substituição. Assim o resto do texto fica IDÊNTICO — sem reescrita, sem
  // truncamento, sem paráfrase. Muito mais confiável que pedir o texto inteiro.
  const sysDiff = `Você é um editor cirúrgico de textos acadêmicos. Recebe um texto e UMA instrução de melhoria. Responda APENAS com JSON no formato:
{"edicoes":[{"buscar":"<trecho EXATO copiado do texto>","substituir":"<novo trecho>"}]}

Regras:
- "buscar" deve ser copiado LETRA POR LETRA do texto (mesma pontuação, acentos e maiúsculas), com tamanho suficiente para ser único (use uma frase inteira quando possível).
- Faça SOMENTE o que a instrução pede; cada edição muda o mínimo necessário. Não toque em nada que a instrução não menciona.
- NUNCA invente referência, autor, ano, dado ou número. Para apagar um trecho, use "substituir":"".
- NÃO altere tabelas (linhas que começam com "|").
- No máximo 12 edições. Se nada precisa mudar, responda {"edicoes":[]}.`
  const userDiff = `INSTRUÇÃO: ${sugestaoTitulo} — ${sugestaoDescricao}

TEXTO:
${conteudo}`

  try {
    const raw = await callAI(sysDiff, userDiff, false, Math.min(maxTokens, 6000))
    const edicoes = parseEdicoes(raw)
    if (edicoes.length > 0) {
      const { texto, aplicadas } = aplicarEdicoes(conteudo, edicoes)
      if (aplicadas > 0 && texto.trim() && texto !== conteudo) {
        // Normaliza travessões/decimais introduzidos na edição (mesma regra do app).
        return streamStringComEfeito(removerTravessoes(texto))
      }
    }
  } catch (err) {
    ultimoErro = err instanceof Error ? err.message : String(err)
    console.error('[aplicar-sugestao] edições pontuais falharam:', ultimoErro)
  }

  // ── ESTRATÉGIA 2 (fallback): REESCRITA CIRÚRGICA do texto inteiro ──────────
  const sysReescrita = `Você é um EDITOR de textos acadêmicos especializado em correções CIRÚRGICAS. Aplique a instrução mudando o MÍNIMO necessário.
- Faça SOMENTE o que a instrução pede; não reescreva o que ela não menciona.
- NUNCA invente referência/dado/autor/ano. Não remova dados/citações existentes.
- Preserve estilo, formatação markdown e TABELAS (linhas com "|").
- Não encha linguiça. O texto deve ficar MELHOR, nunca pior.
- Responda SOMENTE com o texto completo corrigido, sem comentários.`
  const userReescrita = `INSTRUÇÃO: ${sugestaoTitulo} — ${sugestaoDescricao}

TEXTO:
${conteudo}

TEXTO CORRIGIDO (completo):`

  let corrigido = ''
  for (const fast of [false, true]) {
    if (corrigido) break
    try {
      const out = await callAI(sysReescrita, userReescrita, fast, maxTokens)
      if (out?.trim() && out.split(/\s+/).filter(Boolean).length >= nPalavras * 0.45) {
        corrigido = out.trim()
      }
    } catch (err) {
      ultimoErro = err instanceof Error ? err.message : String(err)
      console.error('[aplicar-sugestao] reescrita falhou:', ultimoErro)
    }
  }

  if (!corrigido) {
    return NextResponse.json(
      { error: `Não foi possível aplicar a sugestão agora${ultimoErro ? ` (${ultimoErro})` : ''}. Tente novamente.` },
      { status: 502 }
    )
  }

  // TRAVA DE SEGURANÇA: só aplica a reescrita se ela NÃO piorar o texto
  // (não perdeu citações, não inventou conteúdo, mudou de fato). Caso contrário,
  // erro honesto — melhor não aplicar do que piorar.
  const seg = reescritaSegura(conteudo, corrigido)
  if (!seg.ok) {
    return NextResponse.json(
      { error: `Não apliquei para não piorar o texto (${seg.motivo}). Esta sugestão é melhor resolvida manualmente.` },
      { status: 422 }
    )
  }

  return streamStringComEfeito(removerTravessoes(corrigido))
}
