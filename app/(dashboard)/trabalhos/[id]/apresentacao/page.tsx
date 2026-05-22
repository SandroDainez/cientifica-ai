import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ApresentacaoClient } from './ApresentacaoClient'
import type { Trabalho } from '@/types'

export default async function ApresentacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single()
  if (!trabalhoData) redirect('/trabalhos')

  return <ApresentacaoClient trabalho={trabalhoData as Trabalho} />
}
