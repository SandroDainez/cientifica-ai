// "Escrever com a IA" para um item da Diretriz de Relato (EQUATOR). A IA (modelo
// DEDICADO da revisão — Sonnet) redige um rascunho pronto que ATENDE o item ausente,
// ancorado no trabalho, sem inventar dado real (usa [preencha: ...]). SERVER-ONLY.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { reviewService } from '@/lib/ai/reviewService'
import type { Trabalho, SecaoTrabalho } from '@/types'

export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'review-iterate')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  const { trabalhoId, sigla, rotulo, exige, comoResolver } = await request.json() as {
    trabalhoId?: string; sigla?: string; rotulo?: string; exige?: string; comoResolver?: string
  }
  if (!trabalhoId || !rotulo || !exige) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const { data: trabData } = await supabase
    .from('trabalhos').select('id, titulo, area_conhecimento').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabData as Trabalho

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo').eq('trabalho_id', trabalhoId).order('ordem')
  const secoesAll = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo'>[]

  // Seções candidatas a receber o texto (exclui referências, que é compilada).
  const secoes = secoesAll
    .filter(s => s.chave_secao !== 'referencias')
    .map(s => ({ chave: s.chave_secao, nome: s.nome_secao }))

  const corpo = secoesAll
    .filter(s => s.chave_secao !== 'referencias' && (s.conteudo ?? '').trim())
    .map(s => `${s.nome_secao}\n${extrairTextoSecao(s.conteudo ?? '')}`)
    .join('\n\n')

  const out = await reviewService.redigirItemDiretriz({
    sigla: sigla ?? '', rotulo, exige, comoResolver: comoResolver ?? '',
    tema: trabalho.titulo ?? trabalho.area_conhecimento ?? '',
    corpo: corpo || '(o trabalho ainda não tem seções escritas)',
    secoes,
  })
  if (!out.ok) {
    const status = out.codigo === 'CONFIG_ERROR' ? 503 : 502
    return NextResponse.json({ error: out.error, codigo: out.codigo }, { status })
  }

  // Resolve a seção-alvo escolhida pela IA para um rótulo amigável.
  const alvo = secoesAll.find(s => s.chave_secao === out.data.secaoChave)
  return NextResponse.json({
    ok: true,
    rascunho: out.data.rascunho,
    exemplo: out.data.exemplo,
    secaoChave: alvo?.chave_secao ?? out.data.secaoChave ?? '',
    secaoNome: alvo?.nome_secao ?? '',
  })
}
