// Monta a LISTA DE REFERÊNCIAS real do trabalho (do banco), na norma, para
// inserir na seção "Referências" — em vez de texto/placeholder escrito à mão.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { montarListaReferencias } from '@/lib/referencias/lista-referencias'
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'
import { extrairTextoSecao } from '@/lib/ai/utils'
import type { Referencia, FormatoCitacao, SecaoTrabalho } from '@/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const [{ data: tData }, { data: rData }, { data: sData }] = await Promise.all([
    supabase.from('trabalhos').select('id, formato_citacao').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('referencias').select('*').eq('trabalho_id', id).order('created_at'),
    supabase.from('secoes_trabalho').select('chave_secao, conteudo').eq('trabalho_id', id),
  ])
  if (!tData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const formato: FormatoCitacao = (tData as { formato_citacao?: FormatoCitacao }).formato_citacao ?? 'abnt'
  const referencias = (rData ?? []) as Referencia[]

  if (referencias.length === 0) {
    return NextResponse.json({ lista: '', total: 0, totalBruto: 0, semReferencias: true })
  }

  // Corpo do trabalho (sem a própria seção de referências) para incluir só as CITADAS.
  const corpo = ((sData ?? []) as Pick<SecaoTrabalho, 'chave_secao' | 'conteudo'>[])
    .filter(s => s.chave_secao !== 'referencias' && s.conteudo?.trim())
    .map(s => extrairTextoSecao(s.conteudo ?? ''))
    .join('\n\n')

  const { citadas } = separarReferenciasCitadas(referencias, corpo, formato)
  // Se a detecção não achar nenhuma citada (corpo vazio/curto), usa todas.
  const usar = citadas.length > 0 ? citadas : referencias
  const lista = montarListaReferencias(usar, formato)

  return NextResponse.json({ lista, total: usar.length, totalBruto: referencias.length })
}
