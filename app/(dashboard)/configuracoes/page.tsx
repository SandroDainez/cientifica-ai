import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfiguracoesClient } from './ConfiguracoesClient'
import type { Profile } from '@/types'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!data) redirect('/dashboard')

  return <ConfiguracoesClient perfil={data as Profile} />
}
