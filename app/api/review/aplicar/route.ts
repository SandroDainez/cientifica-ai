// Aplica as correções da Revisão Avançada (trecho→correcao) DIRETAMENTE nas
// seções do trabalho — determinístico, seguro (anti-piora), server-only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { correcoesParaEdicoes, aplicarCorrecoesNasSecoes } from '@/lib/revisao/aplicar-correcoes'
import { extrairTextoSecao } from '@/lib/ai/utils'
import type { SecaoTrabalho } from '@/types'

export const maxDuration = 120

const Schema = z.object({
  correcoes: z.array(z.object({
    trecho: z.string(),
    correcao: z.string(),
  })).min(1, 'nenhuma correção enviada'),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // A rota fica em /api/review/aplicar (sem [id]); o trabalho vem no corpo.
  const rl = await checkRateLimit(supabase, user.id, 'review-iterate')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = z.object({ trabalhoId: z.string(), ...Schema.shape }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', detalhes: parsed.error.issues.map(i => i.message) }, { status: 400 })
  }

  const { trabalhoId, correcoes } = parsed.data

  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, ordem')
    .eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo'>[]

  const edicoes = correcoesParaEdicoes(correcoes)
  const { atualizacoes, totalAplicadas, secoesAfetadas } = aplicarCorrecoesNasSecoes(secoes, edicoes)

  // Salva cada seção alterada
  const mapaAtualizado = new Map(atualizacoes.map(a => [a.chave_secao, a.conteudo]))
  for (const a of atualizacoes) {
    await supabase.from('secoes_trabalho')
      .update({ conteudo: a.conteudo })
      .eq('trabalho_id', trabalhoId)
      .eq('chave_secao', a.chave_secao)
  }

  // Reconstrói o corpo (com as correções) para a re-avaliação imediata.
  const corpoAtualizado = secoes
    .filter(s => (mapaAtualizado.get(s.chave_secao) ?? s.conteudo)?.trim())
    .map(s => `${s.nome_secao}\n\n${extrairTextoSecao(mapaAtualizado.get(s.chave_secao) ?? s.conteudo ?? '')}`)
    .join('\n\n')

  return NextResponse.json({ ok: true, totalAplicadas, secoesAfetadas, corpoAtualizado })
}
