// Corrige o trabalho na fase de Revisão Avançada: para CADA seção, gera edições
// cirúrgicas (Claude) que resolvem os problemas apontados e aplica com trava
// anti-piora. Server-only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { reviewService } from '@/lib/ai/reviewService'
import { correcoesParaEdicoes } from '@/lib/revisao/aplicar-correcoes'
import { aplicarEdicoes, reescritaSegura } from '@/lib/ai/aplicar-edicoes'
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

  // Para cada seção de prosa, gera edições focadas e aplica com segurança.
  for (const secao of secoes) {
    const conteudo = secao.conteudo ?? ''
    if (!conteudo.trim()) continue
    if (secao.chave_secao === 'resumo' || conteudo.trim().startsWith('{')) continue // não mexe em JSON

    const edOut = await reviewService.corrigirSecao(extrairTextoSecao(conteudo), problemas)
    if (!edOut.ok) { erroConfig = edOut.codigo === 'CONFIG_ERROR' ? edOut.error : erroConfig; continue }
    if (edOut.data.length === 0) continue

    const edicoes = correcoesParaEdicoes(edOut.data.map(e => ({ trecho: e.buscar, correcao: e.substituir })))
    const { texto, aplicadas } = aplicarEdicoes(conteudo, edicoes)
    if (aplicadas > 0 && texto !== conteudo && reescritaSegura(conteudo, texto).ok) {
      mapaAtualizado.set(secao.chave_secao, texto)
      totalAplicadas += aplicadas
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

  return NextResponse.json({ ok: true, totalAplicadas, secoesAfetadas: mapaAtualizado.size, corpoAtualizado })
}
