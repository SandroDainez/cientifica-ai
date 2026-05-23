'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, Plus, ExternalLink, CheckCircle, Info, BookOpen, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { formatarReferencia } from '@/lib/referencias/formatar'
import type { Referencia, FormatoCitacao } from '@/types'
import type { ResultadoBusca } from '@/app/api/referencias/buscar/route'

interface BuscarReferenciasProps {
  querySugerida: string          // título do trabalho (pré-preenche a busca)
  formato: FormatoCitacao
  autoSearch?: boolean           // se true, busca automaticamente ao montar
  doisExistentes?: string[]      // DOIs já adicionados (para marcar como existente)
  onAdicionar: (ref: Record<string, unknown>) => Promise<void>
  onAdicionarManualmente?: () => void
}

type Fonte = 'todos' | 'crossref' | 'pubmed' | 'openalex'

const FONTES: { value: Fonte; label: string; desc: string }[] = [
  { value: 'todos',     label: 'Todas as fontes',  desc: 'CrossRef + PubMed' },
  { value: 'crossref',  label: 'CrossRef',          desc: '130M+ artigos' },
  { value: 'pubmed',    label: 'PubMed / NCBI',     desc: 'Saúde & biomedicina' },
  { value: 'openalex',  label: 'OpenAlex',           desc: 'Acesso aberto' },
]

export function BuscarReferencias({
  querySugerida,
  formato,
  autoSearch = true,
  doisExistentes = [],
  onAdicionar,
  onAdicionarManualmente,
}: BuscarReferenciasProps) {
  const [query, setQuery] = useState(querySugerida)
  const [fonte, setFonte] = useState<Fonte>('todos')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [adicionados, setAdicionados] = useState<Set<string>>(new Set())
  const [adicionando, setAdicionando] = useState<Set<string>>(new Set())
  const [adicionandoTodos, setAdicionandoTodos] = useState(false)
  const [erro, setErro] = useState('')
  const [jaBuscou, setJaBuscou] = useState(false)

  const handleBuscar = useCallback(async (q = query, f = fonte) => {
    if (!q.trim()) return
    setBuscando(true)
    setErro('')
    setResultados([])
    setJaBuscou(true)
    try {
      const res = await fetch('/api/referencias/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim(), fonte: f, limite: 12 }),
      })
      const json = await res.json()
      if (res.ok) {
        setResultados(json.resultados ?? [])
      } else {
        setErro(json.error ?? 'Erro ao buscar referências')
      }
    } catch (err) {
      console.error('[BuscarReferencias] Erro na busca:', err)
      setErro('Não foi possível conectar às bases acadêmicas. Verifique sua internet.')
    } finally {
      setBuscando(false)
    }
  }, [query, fonte])

  // Auto-busca ao montar se solicitado e houver query
  useEffect(() => {
    if (autoSearch && querySugerida.trim()) {
      handleBuscar(querySugerida, 'todos')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAdicionar(ref: ResultadoBusca) {
    const key = ref.doi ?? ref.titulo
    setAdicionando(prev => new Set([...prev, key]))
    try {
      await onAdicionar(ref as unknown as Record<string, unknown>)
      setAdicionados(prev => new Set([...prev, key]))
    } finally {
      setAdicionando(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  async function handleAdicionarTodas() {
    setAdicionandoTodos(true)
    const pendentes = resultados.filter(r => {
      const key = r.doi ?? r.titulo
      return !adicionados.has(key) && !doisExistentes.includes(r.doi ?? '¬')
    })
    for (const ref of pendentes) {
      await handleAdicionar(ref)
    }
    setAdicionandoTodos(false)
  }

  const pendentesCount = resultados.filter(r => {
    const key = r.doi ?? r.titulo
    return !adicionados.has(key) && !doisExistentes.includes(r.doi ?? '¬')
  }).length

  return (
    <div className="rounded-xl border bg-card overflow-hidden">

      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <div className="px-5 py-4 bg-primary/5 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground">Buscar Referências Reais</p>
            <p className="text-xs text-muted-foreground">CrossRef · PubMed · OpenAlex — bases acadêmicas reais</p>
          </div>
        </div>
        {onAdicionarManualmente && (
          <button
            onClick={onAdicionarManualmente}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0 gap-1.5 text-xs text-muted-foreground')}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar manualmente
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">

        {/* ── Nota informativa ──────────────────────────────────── */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
          <span>
            As referências abaixo são obtidas de bases acadêmicas reais — não são inventadas.
            Revise os dados antes de usar (autores, ano, páginas). Você também pode{' '}
            {onAdicionarManualmente
              ? <button onClick={onAdicionarManualmente} className="underline underline-offset-2 font-medium">adicionar manualmente</button>
              : 'adicionar manualmente'
            } qualquer referência que não apareça aqui.
          </span>
        </div>

        {/* ── Barra de busca ────────────────────────────────────── */}
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              placeholder="Digite o tema, título ou palavras-chave em português ou inglês…"
              className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
            <button
              onClick={() => handleBuscar()}
              disabled={buscando || !query.trim()}
              className={cn(buttonVariants({ size: 'default' }), 'gap-2 shrink-0')}
            >
              {buscando
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />}
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          {/* Seletor de fonte */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Fonte:</span>
            {FONTES.map(f => (
              <button
                key={f.value}
                onClick={() => setFonte(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  fonte === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                )}
              >
                {f.label}
                <span className="ml-1 opacity-60">({f.desc})</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Erro ──────────────────────────────────────────────── */}
        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <span>{erro}</span>
            <button onClick={() => handleBuscar()} className="ml-auto shrink-0 text-xs underline">Tentar novamente</button>
          </div>
        )}

        {/* ── Skeleton de carregamento ───────────────────────────── */}
        {buscando && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[84px] rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Resultados ────────────────────────────────────────── */}
        {!buscando && resultados.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {resultados.length} referências encontradas
                {pendentesCount < resultados.length && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({resultados.length - pendentesCount} já adicionadas)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBuscar()}
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-xs text-muted-foreground')}
                  title="Buscar novamente"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                </button>
                {pendentesCount > 1 && (
                  <button
                    onClick={handleAdicionarTodas}
                    disabled={adicionandoTodos}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 text-xs')}
                  >
                    {adicionandoTodos
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adicionando…</>
                      : <><Plus className="h-3.5 w-3.5" /> Adicionar todas ({pendentesCount})</>
                    }
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-2.5">
              {resultados.map((ref, i) => {
                const key = ref.doi ?? ref.titulo
                const jaAdicionada = adicionados.has(key) || doisExistentes.includes(ref.doi ?? '¬')
                const estaAdicionando = adicionando.has(key)

                // Prévia formatada (sem markdown visual)
                const refObj = {
                  ...ref, id: '', trabalho_id: '', dados_extras: {}, created_at: ''
                } as Referencia
                const preview = formatarReferencia(refObj, formato, i + 1)
                  .replace(/\*\*/g, '')
                  .replace(/\*/g, '')

                const primeiroAutor = ref.autores?.[0]
                const autoresStr = primeiroAutor
                  ? `${primeiroAutor.sobrenome}${(ref.autores?.length ?? 0) > 1 ? ' et al.' : ''}${ref.ano ? ` (${ref.ano})` : ''}`
                  : ref.ano ? `(${ref.ano})` : ''

                const badgeFonte: Record<string, string> = {
                  crossref:  'bg-indigo-100 text-indigo-700',
                  pubmed:    'bg-emerald-100 text-emerald-700',
                  openalex:  'bg-amber-100 text-amber-700',
                }

                return (
                  <div
                    key={`${i}-${key}`}
                    className={cn(
                      'rounded-lg border p-3.5 transition-all',
                      jaAdicionada
                        ? 'bg-green-50/60 border-green-200'
                        : 'bg-background border-border hover:border-primary/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Título */}
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                          {ref.titulo}
                        </p>

                        {/* Metadados */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          {autoresStr && <span className="font-medium">{autoresStr}</span>}
                          {ref.journal && (
                            <><span>·</span><span className="italic truncate max-w-[180px]">{ref.journal}</span></>
                          )}
                          {ref.fonte_tipo && (
                            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase', badgeFonte[ref.fonte_tipo] ?? 'bg-muted text-muted-foreground')}>
                              {ref.fonte_tipo}
                            </span>
                          )}
                          {ref.doi && (
                            <a
                              href={`https://doi.org/${ref.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 hover:text-primary transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              DOI <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {/* Prévia da citação formatada */}
                        <p className="text-[11px] text-muted-foreground/80 line-clamp-1 leading-relaxed">
                          {preview.length > 180 ? preview.substring(0, 180) + '…' : preview}
                        </p>
                      </div>

                      {/* Botão de ação */}
                      <div className="shrink-0 pt-0.5">
                        {jaAdicionada ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 font-medium whitespace-nowrap">
                            <CheckCircle className="h-3.5 w-3.5" /> Adicionada
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAdicionar(ref)}
                            disabled={estaAdicionando}
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 text-xs whitespace-nowrap')}
                          >
                            {estaAdicionando
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Plus className="h-3.5 w-3.5" />}
                            {estaAdicionando ? 'Salvando…' : 'Adicionar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground pt-1">
              Dados obtidos de CrossRef, PubMed (NCBI) e OpenAlex.{' '}
              <button onClick={() => handleBuscar()} className="underline underline-offset-2 hover:text-foreground">
                Buscar mais resultados
              </button>
            </p>
          </div>
        )}

        {/* ── Estado vazio após busca ────────────────────────────── */}
        {!buscando && jaBuscou && resultados.length === 0 && !erro && (
          <div className="text-center py-8 space-y-2">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma referência encontrada.</p>
            <p className="text-xs text-muted-foreground">
              Tente termos mais gerais, em inglês, ou use outra fonte.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              {FONTES.slice(1).map(f => (
                <button
                  key={f.value}
                  onClick={() => { setFonte(f.value); handleBuscar(query, f.value) }}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs gap-1')}
                >
                  Tentar {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Estado inicial (antes da primeira busca) ────────────── */}
        {!buscando && !jaBuscou && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
            <p>Digite um tema e clique em <strong>Buscar</strong> para encontrar referências reais.</p>
          </div>
        )}
      </div>
    </div>
  )
}
