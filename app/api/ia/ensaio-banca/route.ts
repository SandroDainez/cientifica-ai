// Ensaio para a Banca — gera as perguntas que a banca faria + o que ela quer + um
// esboço de resposta ancorado no trabalho (a IA guia o autor, não o deixa sozinho).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { callAI } from '@/lib/ai/stream'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'
import { ENSAIO_BANCA_SYS, buildEnsaioBancaPrompt } from '@/lib/ai/ensaio-banca'
import type { Trabalho, SecaoTrabalho, Referencia, FormatoCitacao } from '@/types'

export const maxDuration = 300

interface PerguntaBanca { pergunta: string; o_que_a_banca_quer: string; esboco_resposta: string; lacuna: string }

function extrairPerguntas(texto: string): PerguntaBanca[] {
  const i = texto.indexOf('{'); const j = texto.lastIndexOf('}')
  if (i < 0 || j <= i) return []
  try {
    const o = JSON.parse(texto.slice(i, j + 1)) as { perguntas?: unknown }
    if (!Array.isArray(o.perguntas)) return []
    return o.perguntas
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map(p => ({
        pergunta: typeof p.pergunta === 'string' ? p.pergunta : '',
        o_que_a_banca_quer: typeof p.o_que_a_banca_quer === 'string' ? p.o_que_a_banca_quer : '',
        esboco_resposta: typeof p.esboco_resposta === 'string' ? p.esboco_resposta : '',
        lacuna: typeof p.lacuna === 'string' ? p.lacuna : '',
      }))
      .filter(p => p.pergunta.trim())
  } catch { return [] }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'review-iterate')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  const { trabalhoId } = await request.json() as { trabalhoId?: string }
  if (!trabalhoId) return NextResponse.json({ error: 'trabalhoId é obrigatório' }, { status: 400 })

  const { data: trabData } = await supabase
    .from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabData as Trabalho

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo').eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo'>[]
  const corpo = secoes
    .filter(s => s.chave_secao !== 'referencias' && (s.conteudo ?? '').trim())
    .map(s => `${s.nome_secao}\n${extrairTextoSecao(s.conteudo ?? '')}`)
    .join('\n\n')
  if (corpo.trim().length < 400) {
    return NextResponse.json({ error: 'Gere o trabalho antes de ensaiar a banca — ainda não há conteúdo suficiente.' }, { status: 400 })
  }

  const { data: refsData } = await supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId)
  const referencias = (refsData ?? []) as Referencia[]
  const fmt = (trabalho.formato_citacao ?? 'abnt') as FormatoCitacao
  const { citadas } = separarReferenciasCitadas(referencias, corpo, fmt)
  const refsTexto = citadas.slice(0, 20).map(r => `${(r.autores?.[0]?.sobrenome ?? '').toUpperCase()}, ${r.ano} — ${r.titulo}`).join('\n')

  const userPrompt = buildEnsaioBancaPrompt({
    tipo: (trabalho.tipo_trabalho ?? 'trabalho').replace(/_/g, ' '),
    tema: trabalho.titulo ?? trabalho.area_conhecimento ?? '',
    corpo: corpo.slice(0, 24000),
    referencias: refsTexto || undefined,
  })

  let bruto: string
  try { bruto = await callAI(ENSAIO_BANCA_SYS, userPrompt, false, 4000) }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar o ensaio.' }, { status: 502 }) }

  const perguntas = extrairPerguntas(bruto)
  if (perguntas.length === 0) return NextResponse.json({ error: 'Não consegui montar o ensaio agora. Tente de novo.' }, { status: 502 })
  return NextResponse.json({ ok: true, perguntas })
}
