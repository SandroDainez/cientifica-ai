'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, BookOpen, ArrowLeft, Filter, Search, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReferenciaCard } from '@/components/referencias/ReferenciaCard'
import { FormAdicionarReferencia } from '@/components/referencias/FormAdicionarReferencia'
import { BuscarReferencias } from '@/components/referencias/BuscarReferencias'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import type { Trabalho, Referencia } from '@/types'

interface Props {
  trabalho: Trabalho
  referenciasIniciais: Referencia[]
}

const FILTROS: { value: string; label: string }[] = [
  { value: '',            label: 'Todos' },
  { value: 'artigo',      label: 'Artigos' },
  { value: 'livro',       label: 'Livros' },
  { value: 'site',        label: 'Sites' },
  { value: 'tese',        label: 'Teses' },
  { value: 'dissertacao', label: 'Dissertações' },
  { value: 'anais',       label: 'Anais' },
]

type Aba = 'buscar' | 'lista'

export function ReferenciasClient({ trabalho, referenciasIniciais }: Props) {
  const [referencias, setReferencias] = useState<Referencia[]>(referenciasIniciais)
  const [filtro, setFiltro] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  // Abre diretamente na busca se ainda não tem referências
  const [aba, setAba] = useState<Aba>(referenciasIniciais.length === 0 ? 'buscar' : 'lista')

  const doisExistentes = referencias.map(r => r.doi).filter(Boolean) as string[]
  const referenciasExibidas = filtro
    ? referencias.filter(r => r.tipo === filtro)
    : referencias

  // ── Adicionar (manual ou importada da busca) ───────────────────────
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
        setReferencias(prev => [...prev, json.referencia as Referencia])
        setFormAberto(false)
      }
    } catch (err) {
      console.error('Erro ao adicionar referência:', err)
    } finally {
      setSalvando(false)
    }
  }

  // ── Deletar ────────────────────────────────────────────────────────
  async function handleDeletar(id: string) {
    if (!confirm('Remover esta referência?')) return
    try {
      await fetch(`/api/referencias/${id}`, { method: 'DELETE' })
      setReferencias(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Erro ao deletar:', err)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referências bibliográficas"
        description={`${referencias.length} referência${referencias.length !== 1 ? 's' : ''} · ${getTipoLabel(trabalho.tipo_trabalho)} · ${trabalho.formato_citacao.toUpperCase()}`}
        breadcrumbs={[
          { label: 'Dashboard',      href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo || 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'Referências' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/trabalhos/${trabalho.id}/editar`}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              <ArrowLeft className="h-4 w-4" /> Editor
            </Link>
            <button
              onClick={() => setFormAberto(true)}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
            >
              <Plus className="h-4 w-4" /> Adicionar manualmente
            </button>
          </div>
        }
      />

      {/* ── Abas ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setAba('buscar')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            aba === 'buscar'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Search className="h-4 w-4" />
          Buscar referências
        </button>
        <button
          onClick={() => setAba('lista')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            aba === 'lista'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <ListTree className="h-4 w-4" />
          Minhas referências
          {referencias.length > 0 && (
            <span className={cn(
              'px-1.5 py-0.5 rounded-full text-xs font-bold',
              aba === 'lista' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {referencias.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Aba: Buscar ─────────────────────────────────────────── */}
      {aba === 'buscar' && (
        <BuscarReferencias
          querySugerida={trabalho.titulo || trabalho.area_conhecimento || ''}
          formato={trabalho.formato_citacao}
          autoSearch={referenciasIniciais.length === 0}
          doisExistentes={doisExistentes}
          onAdicionar={handleAdicionarReferencia}
          onAdicionarManualmente={() => setFormAberto(true)}
        />
      )}

      {/* ── Aba: Minhas referências ──────────────────────────────── */}
      {aba === 'lista' && (
        <div className="space-y-4">

          {/* Filtros */}
          {referencias.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {FILTROS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFiltro(f.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                    filtro === f.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                  )}
                >
                  {f.label}
                  {f.value === '' && (
                    <span className="ml-1.5 opacity-70">{referencias.length}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Lista vazia */}
          {referenciasExibidas.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center space-y-4">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  {filtro ? 'Nenhuma referência deste tipo' : 'Nenhuma referência ainda'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {filtro
                    ? 'Tente outro filtro ou adicione uma referência deste tipo.'
                    : 'Use a busca para encontrar referências reais em bases acadêmicas (CrossRef, PubMed, OpenAlex), ou adicione manualmente.'}
                </p>
              </div>
              <div className="flex justify-center gap-2 flex-wrap">
                <button
                  onClick={() => setAba('buscar')}
                  className={cn(buttonVariants(), 'gap-2')}
                >
                  <Search className="h-4 w-4" /> Buscar referências
                </button>
                <button
                  onClick={() => setFormAberto(true)}
                  className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
                >
                  <Plus className="h-4 w-4" /> Adicionar manualmente
                </button>
              </div>
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
        </div>
      )}

      {/* ── Modal: adicionar manualmente ────────────────────────── */}
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
