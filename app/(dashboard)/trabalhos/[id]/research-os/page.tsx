import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Trabalho } from '@/types'
import type { ResearchProjectState } from '@/lib/research-os/types'
import { ResearchOsIntakeClient } from './ResearchOsIntakeClient'

export default async function ResearchOsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!data) redirect('/trabalhos')

  const trabalho = data as Trabalho
  const dadosTrabalho = (trabalho.dados_trabalho as Record<string, unknown>) ?? {}
  const researchOs = (dadosTrabalho.research_os as Record<string, unknown>) ?? {}
  const initialState = (researchOs.project_state as ResearchProjectState | undefined) ?? null

  return <ResearchOsIntakeClient trabalho={trabalho} initialState={initialState} />
}
