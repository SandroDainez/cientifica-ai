'use client'

import { useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, RefreshCw, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ValidationReport, ValidationStatus } from '@/lib/referencias/referenceValidator'

interface PainelVerificacaoReferenciaProps {
  report: ValidationReport | null
  isValidating: boolean
  strictMode: boolean
  onRevalidate: () => void
  onToggleStrictMode?: (value: boolean) => void
  canExport: boolean
}

const statusConfig: Record<ValidationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  VALIDATED: { label: 'Validadas', color: 'text-green-600', icon: <CheckCircle className="w-4 h-4 text-green-600" /> },
  PARTIALLY_VALIDATED: { label: 'Parcialmente validadas', color: 'text-yellow-600', icon: <AlertTriangle className="w-4 h-4 text-yellow-600" /> },
  UNVERIFIED: { label: 'Não verificadas', color: 'text-gray-500', icon: <HelpCircle className="w-4 h-4 text-gray-500" /> },
  REJECTED: { label: 'Rejeitadas', color: 'text-red-600', icon: <XCircle className="w-4 h-4 text-red-600" /> },
}

const errorMessages: Record<string, string> = {
  DOI_INVALID_FORMAT: 'Formato de DOI inválido',
  DOI_NOT_FOUND: 'DOI não encontrado no Crossref',
  TITLE_MISMATCH: 'Título divergente do Crossref',
  AUTHOR_MISMATCH: 'Autor divergente do Crossref',
  YEAR_MISMATCH: 'Ano divergente do Crossref',
  MISSING_REQUIRED_FIELDS: 'Campos obrigatórios ausentes',
  CITATION_WITHOUT_REFERENCE: 'Citação sem referência na biblioteca',
  REFERENCE_NOT_CITED: 'Referência não citada no texto',
  EXTERNAL_VALIDATION_FAILED: 'Falha na validação externa',
}

export function PainelVerificacaoReferencias({ report, isValidating, strictMode, onRevalidate, onToggleStrictMode, canExport }: PainelVerificacaoReferenciaProps) {
  const [showCritical, setShowCritical] = useState(false)
  const [showWarnings, setShowWarnings] = useState(false)
  const [showCitationErrors, setShowCitationErrors] = useState(false)

  const hasCritical = (report?.criticalErrors.length ?? 0) > 0
  const hasCitationErrors = (report?.citationErrors.length ?? 0) > 0
  const hasWarnings = (report?.warnings.length ?? 0) > 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-gray-800">Verificação de Referências</span>
          {report && (
            <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">
              {new Date(report.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleStrictMode && (
            <button onClick={() => onToggleStrictMode(!strictMode)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${strictMode ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
              {strictMode ? 'Modo Estrito: ON' : 'Modo Estrito: OFF'}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={onRevalidate} disabled={isValidating} className="gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
            {isValidating ? 'Verificando...' : 'Revalidar referências'}
          </Button>
        </div>
      </div>

      {!report && !isValidating && (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">
          Clique em &quot;Revalidar referências&quot; para verificar a biblioteca.
        </div>
      )}

      {isValidating && (
        <div className="px-5 py-8 text-center text-gray-500 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          Verificando referências via Crossref…
        </div>
      )}

      {report && !isValidating && (
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['VALIDATED', 'PARTIALLY_VALIDATED', 'UNVERIFIED', 'REJECTED'] as ValidationStatus[]).map(status => {
              const count = status === 'VALIDATED' ? report.validated : status === 'PARTIALLY_VALIDATED' ? report.partiallyValidated : status === 'UNVERIFIED' ? report.unverified : report.rejected
              const cfg = statusConfig[status]
              return (
                <div key={status} className="flex flex-col items-center justify-center rounded-lg border border-gray-100 bg-gray-50 py-3">
                  <div className="flex items-center gap-1 mb-1">{cfg.icon}</div>
                  <span className={`text-2xl font-bold ${cfg.color}`}>{count}</span>
                  <span className="text-xs text-gray-500 text-center leading-tight mt-0.5">{cfg.label}</span>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-500">Total: <strong>{report.totalReferences}</strong></p>

          {!canExport && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700"><strong>Exportação bloqueada.</strong> Corrija os erros críticos antes de exportar (Modo Estrito ativo).</p>
            </div>
          )}

          {hasCritical && (
            <div className="rounded-lg border border-red-200 overflow-hidden">
              <button onClick={() => setShowCritical(!showCritical)} className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50 text-sm text-red-700 font-medium">
                <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" />{report.criticalErrors.length} erro(s) crítico(s)</span>
                {showCritical ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showCritical && (
                <ul className="divide-y divide-red-100">
                  {report.criticalErrors.map((e, i) => (
                    <li key={i} className="px-4 py-2.5 text-xs">
                      <span className="font-mono text-gray-500 mr-2">{e.referenceId}</span>
                      <span className="text-red-700">{errorMessages[e.error] ?? e.error}</span>
                      {e.message && <p className="text-gray-400 mt-0.5">{e.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {hasCitationErrors && (
            <div className="rounded-lg border border-orange-200 overflow-hidden">
              <button onClick={() => setShowCitationErrors(!showCitationErrors)} className="w-full flex items-center justify-between px-4 py-2.5 bg-orange-50 text-sm text-orange-700 font-medium">
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{report.citationErrors.length} citação(ões) sem fonte</span>
                {showCitationErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showCitationErrors && (
                <ul className="divide-y divide-orange-100">
                  {report.citationErrors.map((e, i) => (
                    <li key={i} className="px-4 py-2.5 text-xs">
                      <code className="bg-orange-100 px-1 py-0.5 rounded text-orange-800">{e.citation}</code>
                      <span className="text-orange-700 ml-2">{e.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {hasWarnings && (
            <div className="rounded-lg border border-yellow-200 overflow-hidden">
              <button onClick={() => setShowWarnings(!showWarnings)} className="w-full flex items-center justify-between px-4 py-2.5 bg-yellow-50 text-sm text-yellow-700 font-medium">
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{report.warnings.length} aviso(s)</span>
                {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showWarnings && (
                <ul className="divide-y divide-yellow-100">
                  {report.warnings.map((w, i) => (
                    <li key={i} className="px-4 py-2.5 text-xs">
                      <span className="font-mono text-gray-500 mr-2">{w.referenceId}</span>
                      <span className="text-yellow-700">{errorMessages[w.error] ?? w.error}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!hasCritical && !hasCitationErrors && !hasWarnings && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-700">Todas as referências verificadas sem erros.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
