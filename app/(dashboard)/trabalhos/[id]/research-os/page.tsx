import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Trabalho } from '@/types'
import type { ResearchProjectState } from '@/lib/research-os/types'
import type { EvidenceMapResult } from '@/lib/research-os/evidence-engine'
import type { MethodologyInput, MethodologyPlan } from '@/lib/research-os/methodology-engine'
import { ResearchOsIntakeClient } from './ResearchOsIntakeClient'
import { EvidencePanel } from './EvidencePanel'
import { MethodologyPanel } from './MethodologyPanel'

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
  const initialEvidenceMap = (researchOs.evidence_map as EvidenceMapResult | undefined) ?? null
  const initialMethodologyPlan = (researchOs.methodology_plan as MethodologyPlan | undefined) ?? null
  const initialMethodologyInput = (researchOs.methodology_input as MethodologyInput | undefined) ?? null

  return (
    <div>
      <ResearchOsIntakeClient trabalho={trabalho} initialState={initialState} />
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
        <MethodologyPanel
          trabalhoId={trabalho.id}
          initialState={initialState}
          initialPlan={initialMethodologyPlan}
          initialInput={initialMethodologyInput}
        />
        <EvidencePanel trabalhoId={trabalho.id} initialMap={initialEvidenceMap} />
      </div>
    </div>
  )
}
