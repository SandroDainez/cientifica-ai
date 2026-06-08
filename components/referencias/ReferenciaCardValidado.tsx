'use client'

import { CheckCircle, AlertTriangle, XCircle, HelpCircle, ExternalLink } from 'lucide-react'
import type { Referencia } from '@/types'

type ValidationStatus = 'VALIDATED' | 'PARTIALLY_VALIDATED' | 'UNVERIFIED' | 'REJECTED' | undefined

interface ReferenciaCardValidadoProps {
  referencia: Referencia
  onRemover?: (id: string) => void
  formatoCitacao?: 'abnt' | 'vancouver' | 'apa'
  showValidationBadge?: boolean
}

function getValidationStatus(ref: Referencia): ValidationStatus {
  return (ref.dados_extras as Record<string, unknown>)?.validation_status as ValidationStatus
}

function ValidationBadge({ status }: { status: ValidationStatus }) {
  if (!status) return null
  const config = {
    VALIDATED: { label: 'Validada', className: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
    PARTIALLY_VALIDATED: { label: 'Parcial', className: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <AlertTriangle className="w-3 h-3" /> },
    UNVERIFIED: { label: 'Não verificada', className: 'bg-gray-50 text-gray-600 border-gray-200', icon: <HelpCircle className="w-3 h-3" /> },
    REJECTED: { label: 'Rejeitada', className: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  }
  const cfg = config[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

export function ReferenciaCardValidado({ referencia, onRemover, formatoCitacao = 'abnt', showValidationBadge = true }: ReferenciaCardValidadoProps) {
  const status = getValidationStatus(referencia)
  const isRejected = status === 'REJECTED'

  const textoFormatado =
    formatoCitacao === 'abnt' ? referencia.referencia_formatada_abnt :
    formatoCitacao === 'vancouver' ? referencia.referencia_formatada_vancouver :
    referencia.referencia_formatada_apa

  const autoresCurto = referencia.autores?.slice(0, 3).map(a => a.sobrenome).join('; ') +
    (referencia.autores && referencia.autores.length > 3 ? ' et al.' : '')

  return (
    <div className={`rounded-lg border p-4 transition-colors ${isRejected ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {showValidationBadge && <ValidationBadge status={status} />}
            <span className="text-xs text-gray-400 uppercase font-medium">{referencia.tipo.replace('_', ' ')}</span>
            {referencia.fonte_tipo && referencia.fonte_tipo !== 'manual' && (
              <span className="text-xs text-indigo-500 font-medium">{referencia.fonte_tipo.toUpperCase()}</span>
            )}
          </div>
          <p className={`text-sm font-medium leading-snug ${isRejected ? 'text-red-800' : 'text-gray-800'}`}>
            {referencia.titulo}
          </p>
          {autoresCurto && (
            <p className="text-xs text-gray-500 mt-0.5">
              {autoresCurto}
              {referencia.ano && ` · ${referencia.ano}`}
              {referencia.journal && ` · ${referencia.journal}`}
            </p>
          )}
        </div>
        {onRemover && (
          <button onClick={() => onRemover(referencia.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none shrink-0" title="Remover">×</button>
        )}
      </div>

      {textoFormatado && (
        <p className="mt-2 text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-2">{textoFormatado}</p>
      )}

      <div className="flex items-center gap-3 mt-2">
        {referencia.doi && (
          <a href={`https://doi.org/${referencia.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
            <ExternalLink className="w-3 h-3" />DOI
          </a>
        )}
        {referencia.pmid && (
          <a href={`https://pubmed.ncbi.nlm.nih.gov/${referencia.pmid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <ExternalLink className="w-3 h-3" />PubMed
          </a>
        )}
        {referencia.url && !referencia.doi && !referencia.pmid && (
          <a href={referencia.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <ExternalLink className="w-3 h-3" />Link
          </a>
        )}
      </div>

      {isRejected && (
        <div className="mt-2 flex items-start gap-1.5 rounded bg-red-100 px-2.5 py-1.5">
          <XCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">
            {(referencia.dados_extras as Record<string, unknown>)?.validation_errors
              ? `Erro: ${((referencia.dados_extras as Record<string, unknown>).validation_errors as string[]).join(', ')}`
              : 'Referência não verificada. Revise manualmente antes de usar.'}
          </p>
        </div>
      )}
    </div>
  )
}
