// SANEAMENTO DETERMINÍSTICO: remove as referências marcadas "remover" (off-topic)
// — apaga as citações delas do corpo (inclusive em grupo) e exclui a referência
// da lista. Sem depender do modelo. Backup das seções alteradas. Server-only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { acharRefPorCitacao, extrairSobrenomeAno, removerEntradaDeCitacoes, renumerarVancouverRemovendo } from '@/lib/revisao/sanear-refs'
import { compilarSecaoReferencias } from '@/lib/referencias/compilar-secao'
import { ordenarReferencias } from '@/lib/referencias/formatar'
import { filtrarRefsCitaveis } from '@/lib/referencias/auto-import'
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
  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, status, ordem')
    .eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo' | 'status'>[]

  // Vancouver: posição [N] de cada ref-alvo na lista citável ordenada (p/ renumerar).
  const posicoesVancouver: number[] = []
  if (formato === 'vancouver' && alvos.size > 0) {
    const ordenadas = ordenarReferencias(filtrarRefsCitaveis(referencias), 'vancouver')
    for (const id of alvos.keys()) {
      const idx = ordenadas.findIndex(r => r.id === id)
      if (idx >= 0) posicoesVancouver.push(idx + 1)
    }
  }

  // 1) Exclui as referências off-topic da TABELA (as órfãs não têm linha no banco).
  const ids = [...alvos.keys()]
  if (ids.length > 0) await supabase.from('referencias').delete().in('id', ids).eq('trabalho_id', trabalhoId)
  const refsRestantes = referencias.filter(r => !alvos.has(r.id))

  // 2) Apaga as citações no corpo (pula resumo/JSON e a própria seção Referências).
  const novoPorChave = new Map<string, string>()
  let citacoesRemovidas = 0
  for (const secao of secoes) {
    const conteudo = secao.conteudo ?? ''
    if (!conteudo.trim() || secao.chave_secao === 'resumo' || secao.chave_secao === 'referencias' || conteudo.trim().startsWith('{')) continue
    let texto = conteudo
    let mexeu = false
    if (formato === 'vancouver') {
      // Numérico: remove [N] das refs-alvo e RENUMERA o resto (consistente c/ a lista).
      const r = renumerarVancouverRemovendo(texto, posicoesVancouver)
      if (r.removidas > 0) { texto = r.texto; citacoesRemovidas += r.removidas; mexeu = true }
    } else {
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
    }
    if (mexeu && texto !== conteudo) novoPorChave.set(secao.chave_secao, texto)
  }

  // 3) RECOMPILA a seção "Referências" a partir da TABELA, listando SÓ as refs
  // CITADAS no corpo (já com as citações removidas aplicadas). Assim, citação que
  // saiu do texto → a referência some da lista (sem órfã "não citada no texto").
  const secaoRefs = secoes.find(s => s.chave_secao === 'referencias')
  const corpoCitado = secoes
    .filter(s => s.chave_secao !== 'resumo' && s.chave_secao !== 'referencias' && (s.conteudo ?? '').trim())
    .map(s => extrairTextoSecao(novoPorChave.get(s.chave_secao) ?? s.conteudo ?? ''))
    .join('\n\n')
  const bibliografiaNova = compilarSecaoReferencias(refsRestantes, formato, corpoCitado)
  if (secaoRefs && bibliografiaNova && bibliografiaNova !== (secaoRefs.conteudo ?? '')) {
    novoPorChave.set('referencias', bibliografiaNova)
  }

  // Backup + grava as seções alteradas.
  for (const [chave, texto] of novoPorChave) {
    const secao = secoes.find(s => s.chave_secao === chave)
    await supabase.from('secao_versoes').insert({ trabalho_id: trabalhoId, chave_secao: chave, conteudo: secao?.conteudo ?? '', status: secao?.status ?? 'editado' })
    await supabase.from('secoes_trabalho').update({ conteudo: texto, status: 'editado' }).eq('trabalho_id', trabalhoId).eq('chave_secao', chave)
  }

  const corpoAtualizado = secoes
    .filter(s => (novoPorChave.get(s.chave_secao) ?? s.conteudo)?.trim())
    .map(s => `${s.nome_secao}\n\n${extrairTextoSecao(novoPorChave.get(s.chave_secao) ?? s.conteudo ?? '')}`)
    .join('\n\n')

  console.log(`[review/limpar-suspeitas] refs removidas=${alvos.size} órfãs=${orfas.length} citações apagadas=${citacoesRemovidas} seções=${novoPorChave.size}`)
  return NextResponse.json({ ok: true, refsRemovidas: alvos.size, orfasRemovidas: orfas.length, itensRemovidos: alvos.size + orfas.length, citacoesRemovidas, secoesAfetadas: novoPorChave.size, corpoAtualizado })
}
