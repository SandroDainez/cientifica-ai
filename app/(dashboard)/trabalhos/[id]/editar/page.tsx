import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { fasesEfetivas, getDadosProjeto } from '@/lib/tipos/fases-efetivas'
import { EditorClient } from './EditorClient'
import type { Trabalho, SecaoTrabalho } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: trabalhoData }, { data: secoesData }, { count: refsCount }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('*').eq('trabalho_id', id).order('ordem'),
    supabase.from('referencias').select('id', { count: 'exact', head: true }).eq('trabalho_id', id),
  ])

  if (!trabalhoData) redirect('/trabalhos')

  const trabalho = trabalhoData as Trabalho
  const secoes = (secoesData ?? []) as SecaoTrabalho[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  if (!fluxo) redirect('/trabalhos')

  // ORDEM DE ELABORAÇÃO (não a do documento). O editor segue a ordem do FLUXO — onde o
  // Resumo é a penúltima etapa (escrito DEPOIS do corpo). Aplicar a ordem do documento
  // aqui (resumo logo após o título) criava um DEADLOCK: o Resumo aparecia antes da
  // Introdução, mas não pode ser gerado sem o corpo → travava o autor. A ordem do
  // documento (resumo no topo) é aplicada SÓ na exportação/visualização.
  const fases = fasesEfetivas(fluxo.fases, getDadosProjeto(trabalho), trabalho.tipo_trabalho)

  return (
    <EditorClient
      trabalho={trabalho}
      fases={fases}
      secoesIniciais={secoes}
      refsCount={refsCount ?? 0}
    />
  )
}
