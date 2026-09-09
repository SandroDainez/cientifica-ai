import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Trabalho } from '@/types'
import type { ResearchProjectState } from '@/lib/research-os/types'
import type { EvidenceMapResult } from '@/lib/research-os/evidence-engine'
import type { MethodologyInput, MethodologyPlan } from '@/lib/research-os/methodology-engine'
import type { SampleSizeInput, SampleSizePlan } from '@/lib/research-os/sample-size-engine'
import type { ProtocolLockRecord } from '@/lib/research-os/protocol-lock'
import type { ExecutionAnalysisRecord } from '@/lib/research-os/execution-analysis-lock'
import type { ResultFactRegistry } from '@/lib/research-os/result-fact-lock'
import { ResearchOsIntakeClient } from './ResearchOsIntakeClient'
import { EvidencePanel } from './EvidencePanel'
import { MethodologyPanel } from './MethodologyPanel'
import { SampleSizePanel } from './SampleSizePanel'
import { ProtocolLockPanel } from './ProtocolLockPanel'
import { ExecutionAnalysisPanel } from './ExecutionAnalysisPanel'
import { ResultFactsPanel } from './ResultFactsPanel'

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
  const initialSampleSizeInput = (researchOs.sample_size_input as SampleSizeInput | undefined) ?? null
  const initialSampleSizePlan = (researchOs.sample_size_plan as SampleSizePlan | undefined) ?? null
  const initialProtocolLock = (researchOs.protocol_lock as ProtocolLockRecord | undefined) ?? null
  const initialExecutionAnalysis = (researchOs.execution_analysis as ExecutionAnalysisRecord | undefined) ?? null
  const initialResultFactRegistry = (researchOs.result_fact_registry as ResultFactRegistry | undefined) ?? null

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
        <SampleSizePanel
          trabalhoId={trabalho.id}
          initialState={initialState}
          methodologyInput={initialMethodologyInput}
          initialInput={initialSampleSizeInput}
          initialPlan={initialSampleSizePlan}
        />
        <ProtocolLockPanel trabalhoId={trabalho.id} initialLock={initialProtocolLock} />
        <ExecutionAnalysisPanel
          trabalhoId={trabalho.id}
          protocolLock={initialProtocolLock}
          initialRecord={initialExecutionAnalysis}
        />
        <ResultFactsPanel
          trabalhoId={trabalho.id}
          executionRecord={initialExecutionAnalysis}
          initialRegistry={initialResultFactRegistry}
        />
        <EvidencePanel trabalhoId={trabalho.id} initialMap={initialEvidenceMap} />
      </div>
    </div>
  )
}
