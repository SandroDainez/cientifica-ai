'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, BookOpen, ArrowLeft, Loader2, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReferenciaCard } from '@/components/referencias/ReferenciaCard'
import { FormAdicionarReferencia } from '@/components/referencias/FormAdicionarReferencia'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import type { Trabalho, Referencia, TipoReferencia } from '@/types'

interface Props {
  trabalho: Trabalho
  referenciasIniciais: Referencia[]
}

const FILTROS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'artigo', label: 'Artigos' },
  { value: 'livro', label: 'Livros' },
  { value: 'site', label: 'Sites' },
  { value: 'tese', label: 'Teses' },
  { value: 'dissertacao', label: 'Dissertações' },
]

interface ReferenciaIA {
  tipo: TipoReferencia
  titulo: string
  autores?: Array<{ nome: string; sobrenome: string }>
  ano?: number
  journal?: string
  doi?: string
  editora?: string
  cidade?: string
}

export function ReferenciasClient({ trabalho, referenciasIniciais }: Props) {
  const [referencias, setReferencias] = useState<Referencia[]>(referenciasIniciais)
  const [filtro, setFiltro] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [gerandoIA, setGerandoIA] = useState(false)
  const [sugestoesIA, setSugestoesIA] = useState<ReferenciaIA[]>([])
  const [erroIA, setErroIA] = useState('')

  const referenciasExibidas = filtro
    ? referencias.filter(r => r.tipo === filtro)
    : referencias

  // ── Adicionar referência manualmente ───────────────────────────
  async function handleAdicionarReferencia(dados: Record<string, unknown>) {
    setSalvando(true)
    try {
      const res = await fetch('/api/referencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId: trabalho.id, ...dados }),
      })
      const json = await res.json()
      if (res.ok && json.referencia) {
        setReferencias(prev => [...prev, json.referencia])
        setFormAberto(false)
      }
    } catch (err) {
      console.error('Erro ao adicionar referência:', err)
    } finally {
      setSalvando(false)
    }
  }

  // ── Deletar referência ─────────────────────────────────────────
  async function handleDeletar(id: string) {
    if (!confirm('Remover esta referência?')) return
    try {
      await fetch(`/api/referencias/${id}`, { method: 'DELETE' })
      setReferencias(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Erro ao deletar:', err)
    }
  }

  // ── Gerar sugestões por IA ─────────────────────────────────────
  async function handleGerarIA() {
    setGerandoIA(true)
    setErroIA('')
    setSugestoesIA([])
    try {
      const res = await fetch('/api/ia/gerar-referencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId: trabalho.id }),
      })
      const json = await res.json()
      if (res.ok) {
        setSugestoesIA(json.referencias ?? [])
      } else {
        setErroIA(json.error ?? 'Erro ao gerar sugestões')
      }
    } catch {
      setErroIA('Erro de conexão')
    } finally {
      setGerandoIA(false)
    }
  }

  // ── Importar sugestão da IA ─────────────────────────────────────
  async function handleImportarSugestao(s: ReferenciaIA) {
    await handleAdicionarReferencia(s as unknown as Record<string, unknown>)
    setSugestoesIA(prev => prev.filter(x => x !== s))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referências bibliográficas"
        description={`${referencias.length} referência${referencias.length !== 1 ? 's' : ''} · ${getTipoLabel(trabalho.tipo_trabalho)}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo || 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'Referências' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/trabalhos/${trabalho.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              <ArrowLeft className="h-4 w-4" /> Editor
            </Link>
            <button
              onClick={handleGerarIA}
              disabled={gerandoIA}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
            >
              {gerandoIA
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>
                : <><Sparkles className="h-4 w-4" /> Sugerir com IA</>
              }
            </button>
            <button onClick={() => setFormAberto(true)} className={cn(buttonVariants(), 'gap-2')}>
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        }
      />

      {/* Formato em uso */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Formato padrão deste trabalho:</span>
        <span className="font-semibold text-gray-900 uppercase">{trabalho.formato_citacao}</span>
      </div>

      {/* Filtros de tipo */}
      <div className="flex gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground self-center" />
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
              filtro === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-white text-gray-700 border-border hover:border-primary/40'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sugestões da IA */}
      {sugestoesIA.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-gray-900">Sugestões da IA</p>
            <span className="text-xs text-muted-foreground">(revise antes de importar)</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {sugestoesIA.map((s, i) => (
              <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{s.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {s.autores?.[0]?.sobrenome ?? 'Anônimo'}{s.ano ? `, ${s.ano}` : ''} · {s.tipo}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleImportarSugestao(s)}
                    disabled={salvando}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Importar
                  </button>
                  <button
                    onClick={() => setSugestoesIA(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {erroIA && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{erroIA}</p>
      )}

      {/* Lista de referências */}
      {referenciasExibidas.length === 0 ? (
        <div className="bg-white border rounded-xl p-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">
            {filtro ? 'Nenhuma referência deste tipo' : 'Nenhuma referência ainda'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {filtro
              ? 'Tente outro filtro ou adicione uma referência deste tipo.'
              : 'Adicione manualmente ou use a IA para sugerir referências relevantes.'}
          </p>
          <button onClick={() => setFormAberto(true)} className={cn(buttonVariants(), 'gap-2')}>
            <Plus className="h-4 w-4" /> Adicionar referência
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {referenciasExibidas.map(ref => (
            <ReferenciaCard
              key={ref.id}
              referencia={ref}
              formato={trabalho.formato_citacao}
              onDeletar={handleDeletar}
            />
          ))}
        </div>
      )}

      {/* Modal de adicionar */}
      {formAberto && (
        <FormAdicionarReferencia
          onAdicionada={handleAdicionarReferencia}
          onCancelar={() => setFormAberto(false)}
          salvando={salvando}
        />
      )}
    </div>
  )
}
