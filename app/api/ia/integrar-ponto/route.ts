// Integra a NOTA REAL do autor (Pontos do Autor) na seção-alvo: salva o dado em
// dados_projeto (que alimenta a geração) E tece a nota na prosa da seção existente,
// SEM inventar nada além do que o autor escreveu. Backup antes de sobrescrever.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, Referencia, SecaoTrabalho, DadosProjeto } from '@/types'

export const maxDuration = 300

const SYS = `Você é um editor acadêmico. Recebe uma SEÇÃO já redigida e uma NOTA REAL do autor (um dado, contexto ou detalhe de método que SÓ ele tem). INCORPORE a nota à seção de forma natural, acadêmica e coerente — SEM inventar nada além do que a nota traz; PRESERVE o que já está correto. Mantenha a norma, a impessoalidade e as citações reais existentes. Devolva a SEÇÃO COMPLETA revisada — apenas o texto, sem comentários.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-secao')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  const { trabalhoId, campo, secaoAlvo, texto } = await request.json() as {
    trabalhoId: string; campo: string; secaoAlvo: string[]; texto: string
  }
  if (!trabalhoId || !campo || !texto?.trim()) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  // 1) Salva a nota no campo de dados_projeto (alimenta a geração futura também).
  const dpAtual = ((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as Partial<DadosProjeto> | undefined) ?? {}
  const dpAtualizado = { ...dpAtual, [campo]: texto.trim(), confirmado: dpAtual.confirmado ?? false, criado_em: dpAtual.criado_em ?? new Date().toISOString() }
  await supabase.from('trabalhos')
    .update({ dados_trabalho: { ...(trabalho.dados_trabalho as Record<string, unknown> ?? {}), dados_projeto: dpAtualizado } })
    .eq('id', trabalhoId).eq('usuario_id', user.id)

  // 2) Acha a 1ª seção-alvo que EXISTE e tem conteúdo, e tece a nota nela.
  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, status').eq('trabalho_id', trabalhoId)
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo' | 'status'>[]
  const alvo = (secaoAlvo ?? []).map(c => secoes.find(s => s.chave_secao === c && (s.conteudo ?? '').trim())).find(Boolean)

  if (!alvo) {
    // Seção ainda não gerada → o dado fica salvo e será usado quando você gerar a seção.
    return NextResponse.json({ ok: true, integradoNaSecao: null, mensagem: 'Nota salva. Ela será usada quando você gerar a seção correspondente.' })
  }

  const { data: refsData } = await supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId)
  const referencias = (refsData ?? []) as Referencia[]

  const conteudoAtual = extrairTextoSecao(alvo.conteudo ?? '')
  const userPrompt = `SEÇÃO ATUAL (${alvo.nome_secao}):\n${conteudoAtual}\n\nNOTA REAL DO AUTOR (incorpore com fidelidade, SEM inventar além disto):\n${texto.trim()}\n\nDevolva a seção completa já com a nota incorporada.`

  let revisado: string
  try {
    revisado = (await callAI(SYS, userPrompt, false, Math.max(6000, conteudoAtual.length))).trim()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao integrar.' }, { status: 502 })
  }

  // Anti-fabricação + anti-colapso: descarta resultado vazio ou muito menor que o original.
  const limpo = posProcessarTextoGerado(revisado, referencias, trabalho.formato_citacao ?? 'abnt')
  if (!limpo.trim() || limpo.length < conteudoAtual.length * 0.6) {
    return NextResponse.json({ ok: false, mensagem: 'Não consegui integrar com segurança — sua nota foi salva e será usada na geração.' })
  }

  // Backup antes de sobrescrever, e salva.
  await supabase.from('secao_versoes').insert({ trabalho_id: trabalhoId, chave_secao: alvo.chave_secao, conteudo: alvo.conteudo ?? '', status: alvo.status ?? 'editado' })
  await supabase.from('secoes_trabalho').update({ conteudo: limpo, status: 'editado' }).eq('trabalho_id', trabalhoId).eq('chave_secao', alvo.chave_secao)

  return NextResponse.json({ ok: true, integradoNaSecao: alvo.nome_secao })
}
