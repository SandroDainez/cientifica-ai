'use client'

import { useState, useCallback, useRef } from 'react'
import {
  validateAllReferences,
  validateReference,
  type ValidationReport,
  type ReferenceValidationResult,
  type ValidatorConfig,
} from '@/lib/referencias/referenceValidator'
import type { Referencia, FormatoCitacao } from '@/types'

interface UseReferenceValidatorOptions {
  strictMode?: boolean
  useExternalValidation?: boolean
}

interface UseReferenceValidatorReturn {
  report: ValidationReport | null
  results: ReferenceValidationResult[]
  isValidating: boolean
  error: string | null
  validate: (references: Referencia[], text: string, format: FormatoCitacao) => Promise<ValidationReport>
  validateSingle: (ref: Referencia) => Promise<ReferenceValidationResult>
  reset: () => void
  canExport: (references: Referencia[]) => boolean
}

export function useReferenceValidator(options: UseReferenceValidatorOptions = {}): UseReferenceValidatorReturn {
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [results, setResults] = useState<ReferenceValidationResult[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const config: Partial<ValidatorConfig> = {
    strictMode: options.strictMode ?? false,
    useExternalValidation: options.useExternalValidation ?? true,
  }

  const validate = useCallback(async (references: Referencia[], text: string, format: FormatoCitacao): Promise<ValidationReport> => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setIsValidating(true)
    setError(null)
    try {
      const newReport = await validateAllReferences(references, text, format, config)
      setReport(newReport)
      const individualResults: ReferenceValidationResult[] = references.map(ref => {
        const critical = newReport.criticalErrors.find(e => e.referenceId === ref.id)
        const warning = newReport.warnings.filter(w => w.referenceId === ref.id)
        if (critical) return { referenceId: ref.id, status: 'REJECTED' as const, errors: [critical.error], warnings: [], message: critical.message, checkedAt: newReport.generatedAt }
        if (warning.length > 0) return { referenceId: ref.id, status: 'PARTIALLY_VALIDATED' as const, errors: [], warnings: warning.map(w => w.error), message: 'Verificado com avisos.', checkedAt: newReport.generatedAt }
        return { referenceId: ref.id, status: 'VALIDATED' as const, errors: [], warnings: [], message: 'Validado.', checkedAt: newReport.generatedAt }
      })
      setResults(individualResults)
      return newReport
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na validação'
      setError(msg)
      throw err
    } finally {
      setIsValidating(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.strictMode, options.useExternalValidation])

  const validateSingle = useCallback(async (ref: Referencia): Promise<ReferenceValidationResult> => {
    return validateReference(ref, config)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.strictMode, options.useExternalValidation])

  const reset = useCallback(() => { setReport(null); setResults([]); setError(null) }, [])

  const canExport = useCallback((references: Referencia[]): boolean => {
    if (!report) return true
    if (!options.strictMode) return true
    return report.criticalErrors.length === 0 && report.citationErrors.length === 0
  }, [report, options.strictMode])

  return { report, results, isValidating, error, validate, validateSingle, reset, canExport }
}
