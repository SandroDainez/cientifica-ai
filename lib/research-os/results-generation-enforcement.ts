import type { ExecutionAnalysisRecord } from './execution-analysis-lock'
import {
  validateGeneratedResults,
  type GeneratedResultsValidation,
  type ResultFactRegistry,
} from './result-fact-lock'

export interface ResultsGenerationEnforcement {
  applies: boolean
  allowed: boolean
  validation: GeneratedResultsValidation | null
}

export function isResultsSection(sectionKey: string): boolean {
  return sectionKey === 'resultados'
}

function stateBridge(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined
  return (value as Record<string, unknown>)[key]
}

function asExecutionRecord(value: unknown): ExecutionAnalysisRecord | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ExecutionAnalysisRecord>
  return v.status === 'congelado'
    && typeof v.fingerprint === 'string'
    && typeof v.protocolVersion === 'number'
    ? value as ExecutionAnalysisRecord
    : null
}

function asResultFactRegistry(value: unknown): ResultFactRegistry | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ResultFactRegistry>
  return v.status === 'congelado'
    && typeof v.fingerprint === 'string'
    && Array.isArray(v.facts)
    ? value as ResultFactRegistry
    : null
}

export function enforceGeneratedResults(params: {
  sectionKey: string
  text: string
  researchProjectState: unknown
  executionAnalysis?: unknown
  resultFactRegistry?: unknown
}): ResultsGenerationEnforcement {
  if (!isResultsSection(params.sectionKey)) {
    return { applies: false, allowed: true, validation: null }
  }

  const executionRecord = asExecutionRecord(
    params.executionAnalysis ?? stateBridge(params.researchProjectState, '_execution_analysis'),
  )
  const registry = asResultFactRegistry(
    params.resultFactRegistry ?? stateBridge(params.researchProjectState, '_result_fact_registry'),
  )

  const validation = validateGeneratedResults({
    text: params.text,
    registry,
    executionRecord,
  })

  return {
    applies: true,
    allowed: validation.allowed,
    validation,
  }
}

export function resultsEnforcementMetadata(result: ResultsGenerationEnforcement) {
  if (!result.applies) return undefined
  return {
    applied: true,
    allowed: result.allowed,
    added_numeric_tokens: result.validation?.addedNumericTokens ?? [],
    allowed_numeric_tokens: result.validation?.allowedNumericTokens ?? [],
    reasons: result.validation?.reasons ?? [],
  }
}
