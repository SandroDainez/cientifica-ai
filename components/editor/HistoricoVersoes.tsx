'use client'

import { useState, useEffect } from 'react'
import { History, RotateCcw, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Versao {
  id: string
  status: string
  palavras: number | null
  created_at: string
  conteudo: string
}

interface HistoricoVersoesProps {
  trabalhoId: string
  chaveSecao: string
  onRestaurar: (conteudo: string) => void
}

const statusLabel: Record<string, string> = {
  gerado: 'Gerado pela IA',
  editado: 'Editado',
  aprovado: 'Aprovado',
}

export function HistoricoVersoes({ trabalhoId, chaveSecao, onRestaurar }: HistoricoVersoesProps) {
  const [aberto, setAberto] = useState(false)
  const [versoes, setVersoes] = useState<Versao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setCarregando(true)
    fetch(`/api/trabalhos/${trabalhoId}/versoes?chave=${chaveSecao}`)
      .then(r => r.json())
      .then(d => setVersoes(d.versoes ?? []))
      .catch(() => setVersoes([]))
      .finally(() => setCarregando(false))
  }, [aberto, trabalhoId, chaveSecao])

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <History className="w-4 h-4" />
          Histórico de versões
        </span>
        {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {aberto && (
        <div className="border-t border-gray-100">
          {carregando && (
            <p className="px-4 py-3 text-xs text-gray-400">Carregando...</p>
          )}

          {!carregando && versoes.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400">
              Nenhuma versão anterior salva.
            </p>
          )}

          {!carregando && versoes.map((v, i) => (
            <div key={v.id} className="border-b border-gray-50 last:border-0">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700">
                      {i === 0 ? 'Versão atual' : formatDistanceToNow(
                        new Date(v.created_at),
                        { addSuffix: true, locale: ptBR }
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {statusLabel[v.status] ?? v.status}
                      {v.palavras ? ` · ${v.palavras} palavras` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setPreviewId(previewId === v.id ? null : v.id)}
                    className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {previewId === v.id ? 'Fechar' : 'Ver'}
                  </button>
                  {i > 0 && (
                    <button
                      onClick={() => {
                        onRestaurar(v.conteudo)
                        setAberto(false)
                      }}
                      className="text-xs px-2 py-1 rounded text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurar
                    </button>
                  )}
                </div>
              </div>

              {previewId === v.id && (
                <div className="mx-4 mb-3 rounded bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600 max-h-32 overflow-y-auto leading-relaxed">
                  {v.conteudo.slice(0, 500)}
                  {v.conteudo.length > 500 && '…'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
