import type { ExecutionAnalysisRecord } from './execution-analysis-lock'
import type { ResultFactRegistry } from './result-fact-lock'

export type FindingProvenance = 'pre_especificado' | 'desvio_documentado' | 'exploratorio'

export interface DiscussionProvenanceDecision {
  allowed: boolean
  reasons: string[]
  warnings: string[]
  promptGuardrail: string
}

export function evaluateDiscussionProvenance(params: {
  executionRecord: ExecutionAnalysisRecord | null | undefined
  resultRegistry: ResultFactRegistry | null | undefined
}): DiscussionProvenanceDecision {
  const reasons: string[] = []
  const warnings: string[] = []
  const execution = params.executionRecord
  const registry = params.resultRegistry

  if (!execution || execution.status !== 'congelado') {
    reasons.push('Congele o Execution / Analysis Lock antes de gerar a Discussão.')
  }
  if (!registry || registry.status !== 'congelado') {
    reasons.push('Congele o Result Fact Lock antes de gerar a Discussão.')
  }
  if (execution && registry && registry.executionFingerprint !== execution.fingerprint) {
    reasons.push('O Result Fact Lock pertence a outra versão da execução/análise.')
  }

  const facts = registry?.facts ?? []
  if (facts.length === 0) reasons.push('Não há fatos de resultado aprovados para discutir.')

  const missing = facts.filter(fact => !fact.provenance)
  if (missing.length) {
    reasons.push(`Classifique a proveniência de todos os achados antes da Discussão: ${missing.map(f => f.id).join(', ')}.`)
  }

  const hasDocumentedDeviation = Boolean(execution?.deviations?.length)
  const deviationFacts = facts.filter(fact => fact.provenance === 'desvio_documentado')
  if (deviationFacts.length && !hasDocumentedDeviation) {
    reasons.push('Há achados marcados como desvio documentado, mas o Execution / Analysis Lock não contém desvios registrados.')
  }

  const exploratory = facts.filter(fact => fact.provenance === 'exploratorio')
  if (exploratory.length) {
    warnings.push('Achados exploratórios devem ser apresentados como geradores de hipótese, nunca como confirmação pré-especificada.')
  }

  const preSpecified = facts.filter(fact => fact.provenance === 'pre_especificado')
  if (!preSpecified.length) warnings.push('Nenhum achado foi marcado como pré-especificado.')

  const promptGuardrail = reasons.length ? '' : [
    '## RESEARCH OS — DISCUSSION PROVENANCE',
    'A Discussão deve preservar a proveniência de cada achado. Não reclassifique análise exploratória como confirmatória e não apague desvios do protocolo.',
    'Regras obrigatórias:',
    '1. Achado pré-especificado pode ser discutido como análise planejada, sem extrapolar além do desenho do estudo.',
    '2. Achado de desvio documentado deve mencionar que deriva de mudança/desvio registrado e sua justificativa/impacto quando relevante.',
    '3. Achado exploratório deve ser rotulado como exploratório/gerador de hipótese e não pode sustentar conclusão confirmatória.',
    '4. Estudos observacionais não autorizam linguagem causal apenas por associação estatística.',
    '5. Não crie resultado, magnitude, p-valor, IC ou direção de efeito que não esteja no Result Fact Lock.',
    '',
    'ACHADOS APROVADOS E PROVENIÊNCIA:',
    ...facts.map(fact => `- [${fact.id}] provenance=${fact.provenance} | ${fact.text}`),
    '',
    'DESVIOS DOCUMENTADOS:',
    ...(execution?.deviations?.length
      ? execution.deviations.map(d => `- ${d.category}: planejado=${d.planned} | executado=${d.actual} | motivo=${d.reason}${d.impact ? ` | impacto=${d.impact}` : ''}`)
      : ['- Nenhum desvio documentado.']),
  ].join('\n')

  return { allowed: reasons.length === 0, reasons, warnings, promptGuardrail }
}
