// SANEAMENTO DETERMINÍSTICO: remove as referências marcadas "remover" (off-topic)
// — apaga as citações delas do corpo (inclusive em grupo) e exclui a referência
// da lista. Sem depender do modelo. Backup das seções alteradas. Server-only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { acharRefPorCitacao, extrairSobrenomeAno, removerEntradaDeCitacoes } from '@/lib/revisao/sanear-refs'
import { extrairTextoSecao } from '@/lib/ai/utils'
import type { SecaoTrabalho, Referencia, FormatoCitacao, Trabalho } from '@/types'

export const maxDuration = 120

const Schema = z.object({
  trabalhoId: z.string(),
  remover: z.array(z.string()).min(1, 'nenhuma referência para remover'),
})

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
  const { trabalhoId, remover } = parsed.data

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('id, formato_citacao').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const formato: FormatoCitacao = (trabalhoData as Trabalho).formato_citacao ?? 'abnt'
  if (formato === 'vancouver') {
    // Vancouver é numérico [N]; remover do meio renumeraria tudo → não saneamos aqui.
    return NextResponse.json({ ok: true, refsRemovidas: 0, mensagem: 'Saneamento automático não se aplica ao formato Vancouver.' })
  }

  const { data: refsData } = await supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at')
  const referencias = (refsData ?? []) as Referencia[]

  // Casa cada citação marcada "remover" com a referência real (sobrenome + ano).
  // As que NÃO têm referência no banco (citações órfãs) também são removidas do
  // texto por sobrenome+ano — uma citação sem referência é um defeito.
  const alvos = new Map<string, Referencia>()
  const orfas: { sobrenome: string; ano: number }[] = []
  for (const cit of remover) {
    const ref = acharRefPorCitacao(referencias, cit)
    if (ref) { alvos.set(ref.id, ref); continue }
    const sa = extrairSobrenomeAno(cit)
    if (sa) orfas.push(sa)
  }
  if (alvos.size === 0 && orfas.length === 0) {
    return NextResponse.json({ ok: true, refsRemovidas: 0, mensagem: 'Nada a remover (referências não localizadas).' })
  }

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, status, ordem')
    .eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo' | 'status'>[]

  // Apaga as citações das refs-alvo de cada seção (pula resumo/JSON).
  const novoPorChave = new Map<string, string>()
  let citacoesRemovidas = 0
  for (const secao of secoes) {
    const conteudo = secao.conteudo ?? ''
    if (!conteudo.trim() || secao.chave_secao === 'resumo' || conteudo.trim().startsWith('{')) continue
    let texto = conteudo
    let mexeu = false
    for (const ref of alvos.values()) {
      const sob = ref.autores?.[0]?.sobrenome
      if (!sob || !ref.ano) continue
      const r = removerEntradaDeCitacoes(texto, sob, ref.ano)
      if (r.removidas > 0) { texto = r.texto; citacoesRemovidas += r.removidas; mexeu = true }
    }
    for (const o of orfas) {
      const r = removerEntradaDeCitacoes(texto, o.sobrenome, o.ano)
      if (r.removidas > 0) { texto = r.texto; citacoesRemovidas += r.removidas; mexeu = true }
    }
    if (mexeu && texto !== conteudo) novoPorChave.set(secao.chave_secao, texto)
  }

  // Backup + grava as seções alteradas.
  for (const [chave, texto] of novoPorChave) {
    const secao = secoes.find(s => s.chave_secao === chave)
    await supabase.from('secao_versoes').insert({ trabalho_id: trabalhoId, chave_secao: chave, conteudo: secao?.conteudo ?? '', status: secao?.status ?? 'editado' })
    await supabase.from('secoes_trabalho').update({ conteudo: texto, status: 'editado' }).eq('trabalho_id', trabalhoId).eq('chave_secao', chave)
  }

  // Exclui as referências off-topic da lista (as órfãs não têm linha no banco).
  const ids = [...alvos.keys()]
  if (ids.length > 0) await supabase.from('referencias').delete().in('id', ids).eq('trabalho_id', trabalhoId)

  const corpoAtualizado = secoes
    .filter(s => (novoPorChave.get(s.chave_secao) ?? s.conteudo)?.trim())
    .map(s => `${s.nome_secao}\n\n${extrairTextoSecao(novoPorChave.get(s.chave_secao) ?? s.conteudo ?? '')}`)
    .join('\n\n')

  console.log(`[review/limpar-suspeitas] refs removidas=${alvos.size} órfãs=${orfas.length} citações apagadas=${citacoesRemovidas} seções=${novoPorChave.size}`)
  return NextResponse.json({ ok: true, refsRemovidas: alvos.size, orfasRemovidas: orfas.length, itensRemovidos: alvos.size + orfas.length, citacoesRemovidas, secoesAfetadas: novoPorChave.size, corpoAtualizado })
}
