import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
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

  const [{ data: trabalhoData }, { data: secoesData }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('*').eq('trabalho_id', id).order('ordem'),
  ])

  if (!trabalhoData) redirect('/trabalhos')

  const trabalho = trabalhoData as Trabalho
  const secoes = (secoesData ?? []) as SecaoTrabalho[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  if (!fluxo) redirect('/trabalhos')

  return (
    <EditorClient
      trabalho={trabalho}
      fases={fluxo.fases}
      secoesIniciais={secoes}
    />
  )
}
