import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ColetaDadosClient } from './ColetaDadosClient'
import type { Trabalho } from '@/types'

export default async function ColetaDadosPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: instrumentos } = await supabase
    .from('coleta_dados')
    .select('*')
    .eq('trabalho_id', id)
    .order('created_at')

  return <ColetaDadosClient trabalho={trabalhoData as Trabalho} instrumentosIniciais={instrumentos ?? []} />
}
