'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, RefreshCw, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { RelatorioCoerencia, InconsistenciaEncontrada } from '@/app/api/ia/verificar-coerencia/route'

interface VerificadorCoerenciaProps {
  trabalhoId: string
}

export function VerificadorCoerencia({ trabalhoId }: VerificadorCoerenciaProps) {
  const [relatorio, setRelatorio] = useState<RelatorioCoerencia | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [expandido, setExpandido] = useState(true)

  async function verificar() {
    setVerificando(true)
    try {
      const res = await fetch('/api/ia/verificar-coerencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId }),
      })
      const json = await res.json()
      setRelatorio(json.relatorio)
      setExpandido(true)
    } catch {
      // silencioso
    } finally {
      setVerificando(false)
    }
  }

  const criticos = relatorio?.inconsistencias.filter(i => i.tipo === 'critico') ?? []
  const atencao = relatorio?.inconsistencias.filter(i => i.tipo === 'atencao') ?? []

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {relatorio ? (
            relatorio.consistente
              ? <CheckCircle className="w-4 h-4 text-green-600" />
              : criticos.length > 0
              ? <XCircle className="w-4 h-4 text-red-600" />
              : <AlertTriangle className="w-4 h-4 text-yellow-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-sm font-semibold text-gray-800">
            Coerência entre seções
          </span>
        </div>
        <div className="flex items-center gap-2">
          {relatorio && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="text-gray-400 hover:text-gray-600"
            >
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={verificar}
            disabled={verificando}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verificando ? 'animate-spin' : ''}`} />
            {verificando ? 'Verificando…' : relatorio ? 'Reverificar' : 'Verificar agora'}
          </button>
        </div>
      </div>

      {!relatorio && !verificando && (
        <p className="px-4 py-4 text-xs text-gray-400 text-center">
          Clique em &quot;Verificar agora&quot; para detectar inconsistências entre as seções.
        </p>
      )}

      {verificando && (
        <p className="px-4 py-4 text-xs text-gray-400 text-center">
          Analisando coerência entre as seções…
        </p>
      )}

      {relatorio && expandido && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-gray-600">{relatorio.resumo}</p>

          {relatorio.consistente && relatorio.inconsistencias.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-700">Nenhuma inconsistência detectada.</p>
            </div>
          )}

          {criticos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-red-700">
                {criticos.length} inconsistência(s) crítica(s)
              </p>
              {criticos.map((inc, i) => (
                <InconsistenciaCard key={i} inc={inc} />
              ))}
            </div>
          )}

          {atencao.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-yellow-700">
                {atencao.length} ponto(s) de atenção
              </p>
              {atencao.map((inc, i) => (
                <InconsistenciaCard key={i} inc={inc} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InconsistenciaCard({ inc }: { inc: InconsistenciaEncontrada }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 space-y-1 ${
      inc.tipo === 'critico'
        ? 'border-red-200 bg-red-50'
        : 'border-yellow-200 bg-yellow-50'
    }`}>
      <div className="flex items-start gap-1.5">
        {inc.tipo === 'critico'
          ? <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
          : <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
        }
        <p className={`text-xs font-medium ${inc.tipo === 'critico' ? 'text-red-800' : 'text-yellow-800'}`}>
          {inc.secoes_envolvidas.join(' × ')}
        </p>
      </div>
      <p className={`text-xs ${inc.tipo === 'critico' ? 'text-red-700' : 'text-yellow-700'}`}>
        {inc.descricao}
      </p>
      <p className={`text-xs ${inc.tipo === 'critico' ? 'text-red-600' : 'text-yellow-600'}`}>
        💡 {inc.sugestao}
      </p>
    </div>
  )
}
