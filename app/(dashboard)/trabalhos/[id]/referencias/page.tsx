import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReferenciasClient } from './ReferenciasClient'
import type { Trabalho, Referencia } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReferenciasPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tData }, { data: rData }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('referencias').select('*').eq('trabalho_id', id).order('created_at'),
  ])

  if (!tData) redirect('/trabalhos')

  return (
    <ReferenciasClient
      trabalho={tData as Trabalho}
      referenciasIniciais={(rData ?? []) as Referencia[]}
    />
  )
}
