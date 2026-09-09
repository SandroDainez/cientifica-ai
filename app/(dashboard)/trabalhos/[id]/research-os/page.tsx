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
import type { RegulatoryEvidenceRegistry } from '@/lib/research-os/regulatory-evidence'
import { verifiedRegulatoryRoutes } from '@/lib/research-os/regulatory-evidence'
import { buildClaimLedger } from '@/lib/research-os/claim-ledger'
import { evaluateSubmissionReadiness } from '@/lib/research-os/submission-readiness'
import { ResearchOsIntakeClient } from './ResearchOsIntakeClient'
import { EvidencePanel } from './EvidencePanel'
import { MethodologyPanel } from './MethodologyPanel'
import { SampleSizePanel } from './SampleSizePanel'
import { ProtocolLockPanel } from './ProtocolLockPanel'
import { ExecutionAnalysisPanel } from './ExecutionAnalysisPanel'
import { ResultFactsPanel } from './ResultFactsPanel'
import { ClaimLedgerPanel } from './ClaimLedgerPanel'
import { RegulatoryEvidencePanel } from './RegulatoryEvidencePanel'
import { SubmissionReadinessPanel } from './SubmissionReadinessPanel'

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
  const initialRegulatoryEvidence = (researchOs.regulatory_evidence as RegulatoryEvidenceRegistry | undefined) ?? null
  const ethicsVerifiedRoutes = initialState
    ? verifiedRegulatoryRoutes(initialRegulatoryEvidence, initialState)
    : []

  const [{ data: manuscriptSections }, { count: referenceCount }] = await Promise.all([
    supabase
      .from('secoes_trabalho')
      .select('chave_secao, nome_secao, conteudo, status')
      .eq('trabalho_id', trabalho.id)
      .in('chave_secao', ['discussao', 'discussao_grade', 'conclusao', 'consideracoes_finais'])
      .in('status', ['gerado', 'editado', 'aprovado'])
      .order('ordem'),
    supabase
      .from('referencias')
      .select('*', { count: 'exact', head: true })
      .eq('trabalho_id', trabalho.id),
  ])

  const ledger = buildClaimLedger({
    sections: (manuscriptSections ?? []).map(section => ({
      sectionKey: section.chave_secao,
      sectionName: section.nome_secao,
      text: section.conteudo ?? '',
    })),
    researchProjectState: initialState,
    evidenceMap: initialEvidenceMap,
  })

  const submissionReadiness = evaluateSubmissionReadiness({
    state: initialState,
    protocolLock: initialProtocolLock,
    executionAnalysis: initialExecutionAnalysis,
    resultFactRegistry: initialResultFactRegistry,
    evidenceMap: initialEvidenceMap,
    claimLedger: ledger,
    referenceCount: referenceCount ?? 0,
    manuscriptSectionsPresent: (manuscriptSections ?? []).map(section => section.chave_secao),
    ethicsVerifiedRoutes,
  })

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
        <ClaimLedgerPanel ledger={ledger} />
        <RegulatoryEvidencePanel
          trabalhoId={trabalho.id}
          state={initialState}
          initialRegistry={initialRegulatoryEvidence}
        />
        <SubmissionReadinessPanel result={submissionReadiness} />
      </div>
    </div>
  )
}
