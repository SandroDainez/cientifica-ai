import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
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

  // Ordena seções na ordem do fluxo
  const secoesOrdenadas = fluxo
    ? fluxo.fases
        .map(f => secoes.find(s => s.chave_secao === f.chave_secao || s.chave_secao === f.id))
        .filter((s): s is SecaoTrabalho => !!s && !!s.conteudo)
    : secoes.filter(s => !!s.conteudo)

  return (
    <VisualizarClient
      trabalho={trabalho}
      secoes={secoesOrdenadas}
      referencias={referencias}
      autorNome={pData?.nome}
      autorInstituicao={pData?.instituicao ?? trabalho.instituicao_destino}
    />
  )
}
