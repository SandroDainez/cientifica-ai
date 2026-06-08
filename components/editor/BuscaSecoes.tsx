'use client'

import { useState, useMemo } from 'react'
import { Search, X, ChevronRight } from 'lucide-react'
import type { FaseConfig } from '@/types'

interface ResultadoBusca {
  chaveSecao: string
  nomeSecao: string
  trecho: string
  posicao: number
}

interface BuscaSecoesProps {
  fases: FaseConfig[]
  conteudos: Record<string, string>
  onIrParaSecao: (chave: string) => void
}

function extrairTrecho(texto: string, termo: string, raio = 80): string {
  const idx = texto.toLowerCase().indexOf(termo.toLowerCase())
  if (idx === -1) return ''
  const inicio = Math.max(0, idx - raio)
  const fim = Math.min(texto.length, idx + termo.length + raio)
  const trecho = texto.slice(inicio, fim)
  return (inicio > 0 ? '…' : '') + trecho + (fim < texto.length ? '…' : '')
}

function destacar(texto: string, termo: string): React.ReactNode {
  if (!termo) return texto
  const partes = texto.split(new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return partes.map((p, i) =>
    p.toLowerCase() === termo.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{p}</mark>
      : p
  )
}

export function BuscaSecoes({ fases, conteudos, onIrParaSecao }: BuscaSecoesProps) {
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)

  const resultados = useMemo<ResultadoBusca[]>(() => {
    if (termo.trim().length < 3) return []
    const encontrados: ResultadoBusca[] = []
    for (const fase of fases) {
      const conteudo = conteudos[fase.chave_secao] ?? ''
      if (!conteudo) continue
      const idx = conteudo.toLowerCase().indexOf(termo.toLowerCase())
      if (idx === -1) continue
      encontrados.push({
        chaveSecao: fase.chave_secao,
        nomeSecao: fase.nome,
        trecho: extrairTrecho(conteudo, termo),
        posicao: idx,
      })
    }
    return encontrados
  }, [termo, fases, conteudos])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-200 transition-all">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input
          value={termo}
          onChange={e => { setTermo(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)}
          placeholder="Buscar no trabalho…"
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-gray-400 min-w-0"
        />
        {termo && (
          <button onClick={() => { setTermo(''); setAberto(false) }}>
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {aberto && termo.trim().length >= 3 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">
              Nenhum resultado para &quot;{termo}&quot;
            </p>
          ) : (
            <>
              <p className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">
                {resultados.length} seção(ões) encontrada(s)
              </p>
              {resultados.map(r => (
                <button
                  key={r.chaveSecao}
                  onClick={() => {
                    onIrParaSecao(r.chaveSecao)
                    setAberto(false)
                    setTermo('')
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{r.nomeSecao}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                    {destacar(r.trecho, termo)}
                  </p>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {aberto && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAberto(false)}
        />
      )}
    </div>
  )
}
