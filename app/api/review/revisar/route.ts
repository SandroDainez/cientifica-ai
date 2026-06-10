// REVISÃO PROFUNDA: o revisor final reescreve seção a seção para deixar o
// trabalho de alto nível — remove, reescreve, ajusta e aprofunda usando as
// fontes REAIS (com resumo). Trava anti-fabricação via posProcessarTextoGerado.
// Faz backup da versão anterior (secao_versoes) antes de sobrescrever.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { reviewService } from '@/lib/ai/reviewService'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { revisaoProfundaSegura } from '@/lib/ai/aplicar-edicoes'
import { enriquecerAbstractsFaltantes } from '@/lib/referencias/buscar-externo'
import { selecionarFontesRelevantes } from '@/lib/referencias/dossie'
import { formatarRefsParaPrompt } from '@/lib/ai/prompts'
import { extrairTextoSecao } from '@/lib/ai/utils'
import type { SecaoTrabalho, Referencia, FormatoCitacao, Trabalho } from '@/types'

export const maxDuration = 300

const Schema = z.object({
  trabalhoId: z.string(),
  problemas: z.array(z.string()).default([]),
  remover: z.array(z.string()).default([]),   // refs que NÃO pertencem ao trabalho
})

// Não reescreve seções estruturadas / curtas demais (título, resumo JSON, refs,
// objetivos/PICO). A revisão profunda é para prosa.
function ehSecaoReescrevivel(chave: string, conteudo: string): boolean {
  const c = chave.toLowerCase()
  if (c === 'resumo' || c === 'referencias') return false
  if (c.startsWith('titulo') || c.includes('objetivo') || c === 'pico' || c.includes('palavras_chave')) return false
  if (conteudo.trim().startsWith('{')) return false
  return conteudo.trim().split(/\s+/).length >= 40 // só vale a pena em prosa com corpo
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'review-iterate')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const { trabalhoId, problemas, remover } = parsed.data

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho
  const formato: FormatoCitacao = trabalho.formato_citacao ?? 'abnt'
  const tipo = (trabalho.tipo_trabalho ?? 'trabalho').replace(/_/g, ' ')
  const tema = trabalho.titulo ?? trabalho.area_conhecimento ?? ''

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, status, ordem')
    .eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo' | 'status'>[]

  // Referências reais + backfill de abstracts (a revisão aprofunda usando o que
  // as fontes dizem — sem isso ela não tem como acrescentar com fonte).
  const { data: refsData } = await supabase
    .from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at')
  let referencias = (refsData ?? []) as Referencia[]

  // Modo correção mínima: NÃO faz gap-filling (não adiciona refs — isso encheria a
  // bibliografia de fontes não citadas). Só completa abstracts das refs existentes,
  // p/ o revisor julgar se uma citação está no contexto certo.
  try {
    const novos = await enriquecerAbstractsFaltantes(referencias.map(r => ({ id: r.id, doi: r.doi, pmid: r.pmid, abstract: r.abstract })))
    if (novos.size > 0) {
      await Promise.allSettled([...novos].map(([id, abstract]) => supabase.from('referencias').update({ abstract }).eq('id', id)))
      referencias = referencias.map(r => novos.has(r.id) ? { ...r, abstract: novos.get(r.id) } : r)
    }
  } catch { /* segue sem o backfill */ }

  const alvo = secoes.filter(s => (s.conteudo ?? '').trim() && ehSecaoReescrevivel(s.chave_secao, s.conteudo ?? ''))

  // Conta citações (anos 19xx/20xx + marcadores [N]) para impedir que a reescrita
  // COLAPSE as referências — a lista de Referências mostra só o que é citado.
  const contarCitacoes = (t: string) => (t.match(/(?:19|20)\d{2}/g) ?? []).length + (t.match(/\[\s*\d+/g) ?? []).length

  let erroConfig: string | null = null
  // Processa as seções em PARALELO (cada uma é uma chamada independente ao revisor).
  const resultados = await Promise.all(alvo.map(async (secao) => {
    const conteudo = secao.conteudo ?? ''
    const termos = `${secao.nome_secao} ${tema} ${conteudo.slice(0, 400)}`
    // Lista COMPLETA de referências (com resumo nas mais relevantes) — para a
    // reescrita poder citar AMPLAMENTE as fontes reais, não só as poucas com resumo.
    const idsComResumo = new Set(selecionarFontesRelevantes(referencias, termos, 18).map(r => r.id))
    const fontesResumo = formatarRefsParaPrompt(referencias, formato, idsComResumo)

    const out = await reviewService.revisarSecaoProfunda({
      nomeSecao: secao.nome_secao, secaoTexto: conteudo, problemas, fontesResumo, tipo, tema, remover,
    })
    if (!out.ok) {
      if (out.codigo === 'CONFIG_ERROR') erroConfig = out.error
      return null
    }
    // Trava anti-fabricação (fonte única de verdade) + segurança da reescrita.
    const limpo = posProcessarTextoGerado(out.data, referencias, formato)
    if (!revisaoProfundaSegura(conteudo, limpo).ok) return null
    // Anti-colapso de citações: a reescrita não pode perder mais de 40% das citações.
    const citAntes = contarCitacoes(conteudo)
    if (citAntes >= 5 && contarCitacoes(limpo) < citAntes * 0.6) return null
    return { chave: secao.chave_secao, nome: secao.nome_secao, status: secao.status, antigo: conteudo, novo: limpo }
  }))

  const aplicar = resultados.filter((r): r is NonNullable<typeof r> => r !== null)

  if (aplicar.length === 0) {
    if (erroConfig) return NextResponse.json({ error: erroConfig, codigo: 'CONFIG_ERROR' }, { status: 503 })
    return NextResponse.json({ ok: true, secoesRevisadas: 0, corpoAtualizado: '', mensagem: 'Nada para reescrever com segurança.' })
  }

  // Backup da versão anterior + grava a nova (NÃO usamos salvar-secao para não
  // tocar no resumo; só prosa entra aqui).
  for (const r of aplicar) {
    await supabase.from('secao_versoes').insert({ trabalho_id: trabalhoId, chave_secao: r.chave, conteudo: r.antigo, status: r.status ?? 'editado' })
    await supabase.from('secoes_trabalho').update({ conteudo: r.novo, status: 'editado' }).eq('trabalho_id', trabalhoId).eq('chave_secao', r.chave)
  }

  const mapaNovo = new Map(aplicar.map(r => [r.chave, r.novo]))
  const corpoAtualizado = secoes
    .filter(s => (mapaNovo.get(s.chave_secao) ?? s.conteudo)?.trim())
    .map(s => `${s.nome_secao}\n\n${extrairTextoSecao(mapaNovo.get(s.chave_secao) ?? s.conteudo ?? '')}`)
    .join('\n\n')

  console.log(`[review/revisar] seções reescritas=${aplicar.length}/${alvo.length}`)
  return NextResponse.json({ ok: true, secoesRevisadas: aplicar.length, secoesAvaliadas: alvo.length, corpoAtualizado })
}
