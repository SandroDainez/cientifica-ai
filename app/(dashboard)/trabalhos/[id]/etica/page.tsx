import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EticaClient } from './EticaClient'
import type { Trabalho } from '@/types'

export default async function EticaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) redirect('/trabalhos')

  const { data: etica } = await supabase
    .from('comite_etica')
    .select('*')
    .eq('trabalho_id', id)
    .single()

  return <EticaClient trabalho={trabalhoData as Trabalho} eticaInicial={etica} />
}
