import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { removerCitacoesDaRef } from '@/lib/revisao/auditar-referencias'
import type { Referencia, FormatoCitacao, SecaoTrabalho } from '@/types'

/**
 * Remove uma referência do trabalho COM SEGURANÇA:
 *  - apaga as citações parentéticas solo dessa referência do corpo das seções
 *    (sem quebrar a frase) e salva as seções alteradas;
 *  - exclui a referência da lista.
 * Retorna se restaram citações narrativas/em grupo que precisam de revisão manual.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { referenciaId } = (await request.json()) as { referenciaId?: string }
  if (!referenciaId) return NextResponse.json({ error: 'referenciaId obrigatório' }, { status: 400 })

  // Ownership + formato
  const { data: trabalho } = await supabase
    .from('trabalhos').select('id, formato_citacao')
    .eq('id', id).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const formato: FormatoCitacao = (trabalho as { formato_citacao?: FormatoCitacao }).formato_citacao ?? 'abnt'

  // Carrega a referência
  const { data: refData } = await supabase
    .from('referencias').select('*').eq('id', referenciaId).eq('trabalho_id', id).single()
  if (!refData) return NextResponse.json({ error: 'Referência não encontrada' }, { status: 404 })
  const ref = refData as Referencia

  // Remove as citações solo dessa referência do corpo de cada seção
  const { data: secoes } = await supabase
    .from('secoes_trabalho').select('id, conteudo').eq('trabalho_id', id)

  let restaramManuais = false
  let secoesAtualizadas = 0
  for (const s of (secoes ?? []) as Pick<SecaoTrabalho, 'id' | 'conteudo'>[]) {
    if (!s.conteudo?.trim()) continue
    const { texto, restaramManuais: restou } = removerCitacoesDaRef(s.conteudo, ref, formato)
    if (restou) restaramManuais = true
    if (texto !== s.conteudo) {
      const { error } = await supabase.from('secoes_trabalho').update({ conteudo: texto }).eq('id', s.id)
      if (!error) secoesAtualizadas++
    }
  }

  // Exclui a referência da lista
  const { error: delErr } = await supabase.from('referencias').delete().eq('id', referenciaId).eq('trabalho_id', id)
  if (delErr) return NextResponse.json({ error: 'Erro ao remover a referência' }, { status: 500 })

  return NextResponse.json({ ok: true, secoesAtualizadas, restaramManuais })
}
