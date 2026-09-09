import type { ExecutionAnalysisRecord } from './execution-analysis-lock'
import type { FindingProvenance } from './discussion-provenance'

export type ResultFactKind =
  | 'primario'
  | 'secundario'
  | 'descritivo'
  | 'baseline'
  | 'evento_adverso'
  | 'sensibilidade'
  | 'fluxo'
  | 'outro'

export interface ResultFactInput {
  id?: string
  kind: ResultFactKind
  text: string
  sourceNote?: string
  provenance?: FindingProvenance
}

export interface ApprovedResultFact {
  id: string
  kind: ResultFactKind
  text: string
  sourceNote?: string
  provenance?: FindingProvenance
  numericTokens: string[]
}

export interface ResultFactRegistry {
  status: 'rascunho' | 'congelado'
  executionFingerprint: string
  executionProtocolVersion: number
  recordedAt: string
  frozenAt?: string
  fingerprint: string
  facts: ApprovedResultFact[]
}

export interface ResultFactReadiness {
  status: 'bloqueado' | 'parcial' | 'pronto_para_congelar' | 'congelado'
  canFreeze: boolean
  blockers: string[]
  warnings: string[]
}

export interface GeneratedResultsValidation {
  allowed: boolean
  reasons: string[]
  addedNumericTokens: string[]
  allowedNumericTokens: string[]
}

const RESULT_FACT_KINDS = new Set<ResultFactKind>([
  'primario', 'secundario', 'descritivo', 'baseline', 'evento_adverso', 'sensibilidade', 'fluxo', 'outro',
])
const FINDING_PROVENANCE = new Set<FindingProvenance>(['pre_especificado', 'desvio_documentado', 'exploratorio'])

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map(key => `${JSON.stringify(key)}:${stable(obj[key])}`).join(',')}}`
}

function fingerprint(value: unknown): string {
  const text = stable(value)
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code + i
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

export function extractResultNumericTokens(text: string): string[] {
  const normalizedText = text.replace(/\b(IC|CI)\s*(\d+(?:[.,]\d+)?)\s*%/giu, '$1$2')
  const matches = normalizedText.match(/(?<!\d)(?:\d+(?:[.,]\d+)?)(?:\s*%|\b)/gu) ?? []
  return [...new Set(matches.map(token => token.replace(/\s+/g, '').replace(',', '.').toLowerCase()))]
}

export function sanitizeResultFacts(inputs: ResultFactInput[]): ApprovedResultFact[] {
  const seen = new Set<string>()
  const out: ApprovedResultFact[] = []
  for (const raw of inputs.slice(0, 80)) {
    const text = raw.text?.trim().replace(/\s+/g, ' ')
    if (!text || text.length < 8) continue
    const kind = RESULT_FACT_KINDS.has(raw.kind) ? raw.kind : 'outro'
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: raw.id?.trim() || `R${out.length + 1}`,
      kind,
      text,
      sourceNote: raw.sourceNote?.trim() || undefined,
      provenance: raw.provenance && FINDING_PROVENANCE.has(raw.provenance) ? raw.provenance : undefined,
      numericTokens: extractResultNumericTokens(text),
    })
  }
  return out
}

export function evaluateResultFactReadiness(params: {
  executionRecord: ExecutionAnalysisRecord | null | undefined
  facts: ResultFactInput[] | ApprovedResultFact[]
  existingRegistry?: ResultFactRegistry | null
}): ResultFactReadiness {
  const blockers: string[] = []
  const warnings: string[] = []

  if (!params.executionRecord || params.executionRecord.status !== 'congelado') {
    blockers.push('Congele primeiro o Execution / Analysis Lock antes de aprovar resultados para redação.')
  }

  if (params.existingRegistry?.status === 'congelado') {
    return { status: 'congelado', canFreeze: false, blockers: [], warnings: ['O registro de fatos de resultado já está congelado.'] }
  }

  const facts = sanitizeResultFacts(params.facts as ResultFactInput[])
  if (facts.length === 0) blockers.push('Registre ao menos um fato de resultado aprovado antes de gerar a seção Resultados.')
  if (!facts.some(fact => fact.kind === 'primario')) warnings.push('Nenhum fato foi marcado como resultado primário; confirme se isso é intencional.')
  if (facts.some(fact => fact.numericTokens.length === 0)) warnings.push('Há fatos sem valores numéricos; eles podem ser válidos, mas devem permanecer puramente descritivos.')
  if (facts.some(fact => !fact.provenance)) warnings.push('Há achados sem proveniência; Resultados ainda pode ser congelado, mas a Discussão ficará bloqueada até classificá-los como pré-especificados, desvios documentados ou exploratórios.')

  return {
    status: blockers.length ? 'parcial' : 'pronto_para_congelar',
    canFreeze: blockers.length === 0,
    blockers,
    warnings,
  }
}

export function buildResultFactRegistry(params: {
  executionRecord: ExecutionAnalysisRecord
  facts: ResultFactInput[]
  freeze?: boolean
  now?: string
}): ResultFactRegistry {
  const facts = sanitizeResultFacts(params.facts)
  const readiness = evaluateResultFactReadiness({ executionRecord: params.executionRecord, facts })
  if (params.freeze && !readiness.canFreeze) throw new Error(readiness.blockers.join(' '))
  const now = params.now ?? new Date().toISOString()
  const payload = {
    executionFingerprint: params.executionRecord.fingerprint,
    executionProtocolVersion: params.executionRecord.protocolVersion,
    facts,
  }
  return {
    status: params.freeze ? 'congelado' : 'rascunho',
    recordedAt: now,
    frozenAt: params.freeze ? now : undefined,
    fingerprint: fingerprint(payload),
    ...payload,
  }
}

export function allowedResultNumericTokens(
  registry: ResultFactRegistry,
  executionRecord?: ExecutionAnalysisRecord | null,
): string[] {
  const allowed = new Set<string>()
  for (const fact of registry.facts) for (const token of fact.numericTokens) allowed.add(token)
  if (executionRecord?.actualSampleSize) allowed.add(String(executionRecord.actualSampleSize))
  return [...allowed]
}

export function validateGeneratedResults(params: {
  text: string
  registry: ResultFactRegistry | null | undefined
  executionRecord?: ExecutionAnalysisRecord | null
}): GeneratedResultsValidation {
  if (!params.registry || params.registry.status !== 'congelado') {
    return {
      allowed: false,
      reasons: ['Não existe Result Fact Lock congelado para validar a seção Resultados.'],
      addedNumericTokens: [],
      allowedNumericTokens: [],
    }
  }

  if (params.executionRecord && params.registry.executionFingerprint !== params.executionRecord.fingerprint) {
    return {
      allowed: false,
      reasons: ['O Result Fact Lock foi aprovado sobre outra versão do Execution / Analysis Lock. Reconcilie e congele novamente os fatos.'],
      addedNumericTokens: [],
      allowedNumericTokens: allowedResultNumericTokens(params.registry, params.executionRecord),
    }
  }

  const allowedNumericTokens = allowedResultNumericTokens(params.registry, params.executionRecord)
  const allowed = new Set(allowedNumericTokens)
  const generated = extractResultNumericTokens(params.text)
  const addedNumericTokens = generated.filter(token => !allowed.has(token))
  const reasons: string[] = []
  if (addedNumericTokens.length) {
    reasons.push(`A seção Resultados introduziu valores numéricos não aprovados: ${addedNumericTokens.join(', ')}.`)
  }

  return { allowed: reasons.length === 0, reasons, addedNumericTokens, allowedNumericTokens }
}

export function buildResultsGroundingPrompt(params: {
  registry: ResultFactRegistry
  executionRecord: ExecutionAnalysisRecord
}): string {
  const facts = params.registry.facts.map(fact => `- [${fact.id}/${fact.kind}] ${fact.text}`).join('\n')
  const deviations = params.executionRecord.deviations.length
    ? params.executionRecord.deviations.map(d => `- ${d.category}: ${d.actual} | motivo=${d.reason}`).join('\n')
    : '- Nenhum desvio documentado.'
  return [
    '## RESEARCH OS — RESULT FACT LOCK',
    `Execution fingerprint: ${params.executionRecord.fingerprint}.`,
    `Result Fact Lock fingerprint: ${params.registry.fingerprint}.`,
    'A seção Resultados deve relatar SOMENTE os fatos aprovados abaixo.',
    'É proibido criar, recalcular, inferir ou completar números, percentuais, p-valores, intervalos de confiança, medidas de efeito ou tamanhos amostrais ausentes.',
    'Não transforme ausência de informação em resultado negativo; omita ou sinalize como não disponível.',
    'Não introduza interpretação causal ou explicação mecanística em Resultados.',
    '',
    'FATOS APROVADOS:',
    facts,
    '',
    'DESVIOS DE EXECUÇÃO DOCUMENTADOS:',
    deviations,
  ].join('\n')
}
