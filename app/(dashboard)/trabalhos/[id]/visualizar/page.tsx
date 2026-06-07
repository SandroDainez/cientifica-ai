import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { tituloEfetivo } from '@/lib/trabalho/titulo'
import { ordenarSecoesParaDocumento } from '@/lib/tipos/ordem-documento'
import { VisualizarClient } from './VisualizarClient'
import type { Trabalho, SecaoTrabalho, Referencia } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VisualizarPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tData }, { data: sData }, { data: rData }, { data: pData }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('*').eq('trabalho_id', id).order('ordem'),
    supabase.from('referencias').select('*').eq('trabalho_id', id).order('created_at'),
    supabase.from('profiles').select('nome, instituicao').eq('id', user.id).single(),
  ])

  if (!tData) redirect('/trabalhos')

  const trabalho = tData as Trabalho
  const secoes = (sData ?? []) as SecaoTrabalho[]
  const referencias = (rData ?? []) as Referencia[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  // Título da capa: coluna do trabalho ou, se vazia, extraído da seção "titulo"
  const titulo = tituloEfetivo(trabalho.titulo, secoes)

  // Resumo/Abstract: pré-textual (vai ANTES da introdução, sem numeração)
  const secaoResumo = secoes.find(s => s.chave_secao === 'resumo' && !!s.conteudo?.trim()) ?? null

  // Corpo numerado na ordem do fluxo, SEM as seções tratadas à parte:
  //  - 'titulo'      → já está na capa
  //  - 'resumo'      → renderizado antes da introdução, sem número
  //  - 'referencias' → renderizado no bloco dedicado (lista formatada)
  const ehForaDoCorpo = (chave: string) => ['titulo', 'resumo', 'referencias'].includes(chave)
  const corpo = (fluxo
    ? fluxo.fases
        .map(f => secoes.find(s => s.chave_secao === f.chave_secao || s.chave_secao === f.id))
        .filter((s): s is SecaoTrabalho => !!s && !!s.conteudo)
    : secoes.filter(s => !!s.conteudo)
  ).filter(s => !ehForaDoCorpo(s.chave_secao))
  // Reordena para a ordem ABNT do documento final (Introdução → Objetivos → … →
  // Conclusão), independente da ordem de elaboração no editor.
  const secoesOrdenadas = ordenarSecoesParaDocumento(corpo)

  return (
    <VisualizarClient
      trabalho={trabalho}
      tituloTrabalho={titulo}
      secaoResumo={secaoResumo}
      secoes={secoesOrdenadas}
      referencias={referencias}
      autorNome={pData?.nome}
      autorInstituicao={pData?.instituicao ?? trabalho.instituicao_destino}
    />
  )
}
