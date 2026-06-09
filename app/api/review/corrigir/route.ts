// Corrige o trabalho na fase de Revisão Avançada: para CADA seção, gera edições
// cirúrgicas (Claude) que resolvem os problemas apontados e aplica com trava
// anti-piora. Server-only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { reviewService } from '@/lib/ai/reviewService'
import { aplicarEdicoes, edicaoSeguraCirurgica } from '@/lib/ai/aplicar-edicoes'
import { extrairTextoSecao } from '@/lib/ai/utils'
import type { SecaoTrabalho } from '@/types'

export const maxDuration = 300

const Schema = z.object({
  trabalhoId: z.string(),
  problemas: z.array(z.string()).min(1, 'nenhum problema enviado'),
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
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos', detalhes: parsed.error.issues.map(i => i.message) }, { status: 400 })

  const { trabalhoId, problemas } = parsed.data

  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, ordem')
    .eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo'>[]

  let totalAplicadas = 0
  const mapaAtualizado = new Map<string, string>()
  let erroConfig: string | null = null
  // Diagnóstico: explica POR QUE nada foi aplicado, em vez de "não consegui".
  const diag = { geradas: 0, inseguras: 0, naoCasaram: 0 }
  const contaPalavras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

  // Para cada seção de prosa, gera edições focadas e aplica uma a uma, com a
  // trava anti-fabricação por edição (remover citação ruim é permitido).
  for (const secao of secoes) {
    const conteudo = secao.conteudo ?? ''
    if (!conteudo.trim()) continue
    if (secao.chave_secao === 'resumo' || conteudo.trim().startsWith('{')) continue // não mexe em JSON

    const edOut = await reviewService.corrigirSecao(extrairTextoSecao(conteudo), problemas)
    if (!edOut.ok) { erroConfig = edOut.codigo === 'CONFIG_ERROR' ? edOut.error : erroConfig; continue }
    if (edOut.data.length === 0) continue
    diag.geradas += edOut.data.length

    let conteudoAtual = conteudo
    let aplicadasNaSecao = 0
    for (const e of edOut.data) {
      const seg = edicaoSeguraCirurgica(e.buscar, e.substituir)
      if (!seg.ok) { diag.inseguras++; continue }
      const { texto, aplicadas } = aplicarEdicoes(conteudoAtual, [{ buscar: e.buscar, substituir: e.substituir }])
      if (aplicadas === 0) { diag.naoCasaram++; continue }
      conteudoAtual = texto
      aplicadasNaSecao++
    }

    // Sanidade final da seção: bloqueia inchaço global (invenção de conteúdo).
    // Só conta as edições da seção quando a seção é efetivamente salva.
    if (aplicadasNaSecao > 0 && contaPalavras(conteudoAtual) <= contaPalavras(conteudo) * 1.5) {
      mapaAtualizado.set(secao.chave_secao, conteudoAtual)
      totalAplicadas += aplicadasNaSecao
    }
  }

  if (totalAplicadas === 0 && erroConfig) {
    return NextResponse.json({ error: erroConfig, codigo: 'CONFIG_ERROR' }, { status: 503 })
  }

  // Salva as seções alteradas
  for (const [chave, conteudo] of mapaAtualizado) {
    await supabase.from('secoes_trabalho').update({ conteudo }).eq('trabalho_id', trabalhoId).eq('chave_secao', chave)
  }

  const corpoAtualizado = secoes
    .filter(s => (mapaAtualizado.get(s.chave_secao) ?? s.conteudo)?.trim())
    .map(s => `${s.nome_secao}\n\n${extrairTextoSecao(mapaAtualizado.get(s.chave_secao) ?? s.conteudo ?? '')}`)
    .join('\n\n')

  console.log(`[review/corrigir] geradas=${diag.geradas} aplicadas=${totalAplicadas} inseguras=${diag.inseguras} naoCasaram=${diag.naoCasaram} secoes=${mapaAtualizado.size}`)
  return NextResponse.json({ ok: true, totalAplicadas, secoesAfetadas: mapaAtualizado.size, corpoAtualizado, diagnostico: diag })
}
