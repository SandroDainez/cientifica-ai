'use client'

import { useState } from 'react'
import { Sparkles, X, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  texto: string
  area: string
  selecionados: string[]
  onAdicionar: (termo: string) => void
  onRemover: (termo: string) => void
  placeholder?: string
  /** Idioma dos descritores: 'pt' (DeCS) ou 'en' (MeSH). Padrão: 'pt'. */
  idioma?: 'pt' | 'en'
}

export function SugestorPalavrasChave({ texto, area, selecionados, onAdicionar, onRemover, placeholder, idioma = 'pt' }: Props) {
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [carregando, setCarregando] = useState(false)
  const [inputCustom, setInputCustom] = useState('')

  async function sugerir() {
    if (!texto.trim()) return
    setCarregando(true)
    try {
      const res = await fetch('/api/ia/sugerir-palavras-chave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, area, idioma }),
      })
      if (res.ok) {
        const data = await res.json() as { palavras: string[] }
        setSugestoes(data.palavras.filter(p => !selecionados.includes(p)))
      }
    } finally {
      setCarregando(false)
    }
  }

  function adicionarCustom() {
    const termo = inputCustom.trim()
    if (termo && !selecionados.includes(termo)) {
      onAdicionar(termo)
      setInputCustom('')
    }
  }

  return (
    <div className="space-y-3">
      {/* Selecionados */}
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selecionados.map(termo => (
            <span
              key={termo}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {termo}
              <button onClick={() => onRemover(termo)} className="hover:text-red-600 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input manual */}
      <div className="flex gap-2">
        <input
          value={inputCustom}
          onChange={e => setInputCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarCustom() } }}
          placeholder={placeholder ?? 'Adicionar palavra-chave…'}
          className="flex-1 h-8 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <button
          type="button"
          onClick={adicionarCustom}
          disabled={!inputCustom.trim()}
          className="h-8 px-3 rounded-lg border border-input text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={sugerir}
          disabled={carregando || !texto.trim()}
          className="h-8 px-3 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-1.5"
        >
          {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Sugerir
        </button>
      </div>

      {/* Sugestões da IA */}
      {sugestoes.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Sugestões — clique para adicionar:</p>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map(termo => (
              <button
                key={termo}
                type="button"
                onClick={() => { onAdicionar(termo); setSugestoes(s => s.filter(x => x !== termo)) }}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                  selecionados.includes(termo)
                    ? 'bg-primary/10 border-primary text-primary cursor-default'
                    : 'border-dashed border-gray-300 text-gray-600 hover:border-primary hover:text-primary'
                )}
              >
                <Plus className="h-3 w-3" />
                {termo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
