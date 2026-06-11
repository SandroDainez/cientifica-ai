// Verificador de Diretriz de Relato (EQUATOR) — confere o trabalho item a item da
// diretriz CERTA pela natureza (PRISMA/STROBE/CONSORT/CARE/...) e GUIA o autor no que
// falta, com modelo do que escrever (sem deixá-lo perdido). SERVER-ONLY.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { callAI } from '@/lib/ai/stream'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { naturezaTrabalho } from '@/lib/trabalho/pontos-autor'
import { diretrizPara, buildDiretrizPrompt, DIRETRIZ_SYS } from '@/lib/trabalho/diretrizes-relato'
import type { Trabalho, SecaoTrabalho, DadosProjeto } from '@/types'

export const maxDuration = 300

interface ItemAvaliado { id: string; status: string; nota: string; como_resolver: string; quem_resolve: string }

function parseItens(texto: string): ItemAvaliado[] {
  const i = texto.indexOf('{'); const j = texto.lastIndexOf('}')
  if (i < 0 || j <= i) return []
  try {
    const o = JSON.parse(texto.slice(i, j + 1)) as { itens?: unknown }
    if (!Array.isArray(o.itens)) return []
    return o.itens
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map(p => ({
        id: typeof p.id === 'string' ? p.id : '',
        status: typeof p.status === 'string' ? p.status : 'ausente',
        nota: typeof p.nota === 'string' ? p.nota : '',
        como_resolver: typeof p.como_resolver === 'string' ? p.como_resolver : '',
        quem_resolve: p.quem_resolve === 'ia' ? 'ia' : 'autor',
      }))
      .filter(p => p.id)
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
  const corpo = ((secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo'>[])
    .filter(s => s.chave_secao !== 'referencias' && (s.conteudo ?? '').trim())
    .map(s => `${s.nome_secao}\n${extrairTextoSecao(s.conteudo ?? '')}`)
    .join('\n\n')
  if (corpo.trim().length < 400) {
    return NextResponse.json({ error: 'Gere o trabalho antes de conferir a diretriz — ainda não há conteúdo suficiente.' }, { status: 400 })
  }

  const dados = (trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as Partial<DadosProjeto> | undefined
  const natureza = naturezaTrabalho(trabalho.tipo_trabalho, dados)
  const diretriz = diretrizPara(natureza, trabalho.tipo_trabalho, dados)

  const userPrompt = buildDiretrizPrompt(diretriz, trabalho.titulo ?? trabalho.area_conhecimento ?? '', corpo.slice(0, 24000))
  let bruto: string
  try { bruto = await callAI(DIRETRIZ_SYS, userPrompt, false, 4000) }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao conferir a diretriz.' }, { status: 502 }) }

  const avaliados = parseItens(bruto)
  // Junta a avaliação da IA com os rótulos do checklist (mantém a ordem da diretriz).
  const itens = diretriz.itens.map(it => {
    const a = avaliados.find(x => x.id === it.id)
    return {
      id: it.id, rotulo: it.rotulo, exige: it.exige,
      status: a?.status ?? 'ausente', nota: a?.nota ?? '', como_resolver: a?.como_resolver ?? '', quem_resolve: a?.quem_resolve ?? 'autor',
    }
  })

  return NextResponse.json({ ok: true, sigla: diretriz.sigla, nome: diretriz.nome, itens })
}
