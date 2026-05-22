'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X, CheckCircle2, AlertTriangle, XCircle, TrendingUp, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RelatorioQualidade as TRelatorio } from '@/app/api/ia/relatorio-qualidade/route'

interface Props {
  trabalhoId: string
  onClose: () => void
}

function ScoreCircle({ score }: { score: number }) {
  const cor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
  const bgCor = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
  return (
    <div className={cn('flex flex-col items-center justify-center h-28 w-28 rounded-full border-4 mx-auto', bgCor)}>
      <span className={cn('text-4xl font-bold', cor)}>{score}</span>
      <span className="text-xs text-muted-foreground">/ 100</span>
    </div>
  )
}

export function RelatorioQualidade({ trabalhoId, onClose }: Props) {
  const [relatorio, setRelatorio] = useState<TRelatorio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(false)

  async function gerar() {
    setCarregando(true)
    setErro(false)
    try {
      const res = await fetch('/api/ia/relatorio-qualidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json() as TRelatorio
      setRelatorio(data)
    } catch {
      setErro(true)
    } finally {
      setCarregando(false)
    }
  }

  const statusIcon = {
    aprovado: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
    atencao: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
    critico: <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
  }

  const statusCor = {
    aprovado: 'bg-green-50 border-green-200',
    atencao: 'bg-yellow-50 border-yellow-200',
    critico: 'bg-red-50 border-red-200',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <p className="font-semibold text-gray-900">Relatório de Qualidade</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {!relatorio && !carregando && !erro && (
            <div className="text-center space-y-4 py-8">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Análise completa do trabalho</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA avalia completude, coerência entre seções, qualidade e pontos a melhorar antes de exportar.
                </p>
              </div>
              <button onClick={gerar}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
                <Sparkles className="h-4 w-4" /> Analisar trabalho
              </button>
            </div>
          )}

          {carregando && (
            <div className="text-center space-y-3 py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Analisando todas as seções do trabalho…</p>
            </div>
          )}

          {erro && (
            <div className="text-center space-y-3 py-8">
              <XCircle className="h-10 w-10 text-red-400 mx-auto" />
              <p className="text-sm text-red-600">Erro ao gerar o relatório. Verifique se o trabalho possui seções escritas.</p>
              <button onClick={gerar} className="text-sm text-primary hover:underline">Tentar novamente</button>
            </div>
          )}

          {relatorio && (
            <div className="space-y-6">
              {/* Score geral */}
              <div className="text-center space-y-3">
                <ScoreCircle score={relatorio.score_geral} />
                <div>
                  <p className="font-semibold text-gray-900">
                    {relatorio.score_geral >= 80 ? 'Excelente!' : relatorio.score_geral >= 60 ? 'Bom progresso' : 'Precisa de atenção'}
                  </p>
                  <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className={cn('flex items-center gap-1', relatorio.coerencia_objetivos_conclusao ? 'text-green-600' : 'text-red-600')}>
                      {relatorio.coerencia_objetivos_conclusao ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      Coerência obj.→conclusão
                    </span>
                    <span className={cn('flex items-center gap-1', relatorio.referencias_suficientes ? 'text-green-600' : 'text-yellow-600')}>
                      {relatorio.referencias_suficientes ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      Referências
                    </span>
                  </div>
                </div>
              </div>

              {/* Score por seção */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Por seção</p>
                {relatorio.secoes.map(secao => (
                  <div key={secao.chave} className={cn('flex items-start gap-3 p-3 rounded-lg border', statusCor[secao.status])}>
                    {statusIcon[secao.status]}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{secao.nome}</p>
                        <span className="text-sm font-bold text-gray-700 shrink-0">{secao.score}/100</span>
                      </div>
                      {secao.observacao && (
                        <p className="text-xs text-gray-600 mt-0.5">{secao.observacao}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pontos fortes */}
              {relatorio.pontos_fortes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Pontos fortes
                  </p>
                  <ul className="space-y-1">
                    {relatorio.pontos_fortes.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-500 shrink-0 mt-0.5">✓</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pontos críticos */}
              {relatorio.pontos_criticos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" /> Pontos críticos — revisar antes de exportar
                  </p>
                  <ul className="space-y-1">
                    {relatorio.pontos_criticos.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-red-500 shrink-0 mt-0.5">✗</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pontos a melhorar */}
              {relatorio.pontos_melhoria.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-yellow-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Pontos a melhorar
                  </p>
                  <ul className="space-y-1">
                    {relatorio.pontos_melhoria.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-yellow-500 shrink-0 mt-0.5">⚠</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recomendação de exportação */}
              <div className={cn(
                'rounded-xl p-4 text-sm font-medium',
                relatorio.recomendacao_export
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              )}>
                {relatorio.recomendacao_export
                  ? '✓ O trabalho está pronto para exportação.'
                  : '⚠ Revise os pontos críticos antes de exportar para obter o melhor resultado.'}
              </div>

              <button onClick={gerar}
                className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
                <Sparkles className="h-3 w-3" /> Analisar novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
