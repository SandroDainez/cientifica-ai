import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PerfilClient } from './PerfilClient'
import type { Profile } from '@/types'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!data) redirect('/dashboard')

  return <PerfilClient perfil={data as Profile} email={user.email ?? ''} />
}
