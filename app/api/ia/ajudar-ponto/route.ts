// "Me ajude a escrever" — gera um rascunho de partida para o ponto do autor, ancorado
// no trabalho, sem inventar dado real (usa [preencha: ...]). SERVER-ONLY.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { callAI } from '@/lib/ai/stream'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { AJUDAR_PONTO_SYS, buildAjudarPontoPrompt } from '@/lib/ai/ajudar-ponto'
import type { Trabalho, SecaoTrabalho } from '@/types'

export const maxDuration = 120

function extrair(texto: string): { rascunho: string; exemplo: string } | null {
  const i = texto.indexOf('{'); const j = texto.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try {
    const o = JSON.parse(texto.slice(i, j + 1)) as { rascunho?: unknown; exemplo?: unknown }
    const rascunho = typeof o.rascunho === 'string' ? o.rascunho.trim() : ''
    if (!rascunho) return null
    return { rascunho, exemplo: typeof o.exemplo === 'string' ? o.exemplo.trim() : '' }
  } catch { return null }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-secao')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  const { trabalhoId, titulo, oQueEscrever, porQue, campo } = await request.json() as {
    trabalhoId?: string; titulo?: string; oQueEscrever?: string; porQue?: string; campo?: string
  }
  if (!trabalhoId || !titulo || !oQueEscrever) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const { data: trabData } = await supabase
    .from('trabalhos').select('id, titulo, area_conhecimento').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabData as Trabalho

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo').eq('trabalho_id', trabalhoId).order('ordem')
  const corpo = ((secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo'>[])
    .filter(s => s.chave_secao !== 'referencias' && (s.conteudo ?? '').trim())
    .map(s => `${s.nome_secao}\n${extrairTextoSecao(s.conteudo ?? '')}`)
    .join('\n\n')

  const userPrompt = buildAjudarPontoPrompt({
    titulo, oQueEscrever, porQue: porQue ?? '', campo: campo ?? '',
    tema: trabalho.titulo ?? trabalho.area_conhecimento ?? '',
    corpo: corpo || '(o trabalho ainda não tem seções escritas — gere um rascunho genérico mas útil)',
  })

  let bruto: string
  try { bruto = await callAI(AJUDAR_PONTO_SYS, userPrompt, false, 1200) }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar o rascunho.' }, { status: 502 }) }

  const out = extrair(bruto)
  if (!out) return NextResponse.json({ error: 'Não consegui montar o rascunho agora. Tente de novo.' }, { status: 502 })
  return NextResponse.json({ ok: true, ...out })
}
