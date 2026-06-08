'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, BookOpen, ArrowLeft, Filter, Search, ListTree, Sparkles, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReferenciaCard } from '@/components/referencias/ReferenciaCard'
import { FormAdicionarReferencia } from '@/components/referencias/FormAdicionarReferencia'
import { BuscarReferencias } from '@/components/referencias/BuscarReferencias'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import { useReferenceValidator } from '@/hooks/useReferenceValidator'
import { PainelVerificacaoReferencias } from '@/components/referencias/PainelVerificacaoReferencias'
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
  const [importandoAuto, setImportandoAuto] = useState(false)
  const [deletandoId, setDeletandoId] = useState<string | null>(null)
  const [confirmandoDeleteId, setConfirmandoDeleteId] = useState<string | null>(null)
  // Abre diretamente na busca se ainda não tem referências
  const [aba, setAba] = useState<Aba>(referenciasIniciais.length === 0 ? 'buscar' : 'lista')

  // ── Validação automática de referências (passo 10 do briefing) ─────────────
  const [strictMode, setStrictMode] = useState(false)
  const { report, isValidating, validate, canExport } = useReferenceValidator({ strictMode })

  const handleRevalidate = async () => {
    if (!referencias || referencias.length === 0) return
    // Este painel não tem o texto completo das seções; valida as referências
    // (DOI/Crossref/campos). A checagem de citações no corpo é feita no editor.
    const textoCompleto = ''
    await validate(referencias, textoCompleto, trabalho.formato_citacao)
  }

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
        toast.success('Referência adicionada!')
      } else {
        toast.error(json.error ?? 'Erro ao adicionar referência')
      }
    } catch (err) {
      console.error('[Referências] Erro ao adicionar:', err)
      toast.error('Erro ao adicionar referência. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Auto-importar via IA (CrossRef + PubMed) ──────────────────────
  async function handleAutoImportar() {
    setImportandoAuto(true)
    try {
      const res = await fetch('/api/ia/gerar-referencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId: trabalho.id }),
      })
      const json = await res.json()
      if (res.ok && Array.isArray(json.referencias) && json.referencias.length > 0) {
        setReferencias(prev => {
          const existIds = new Set(prev.map(r => r.id))
          const novas = (json.referencias as Referencia[]).filter(r => !existIds.has(r.id))
          return [...prev, ...novas]
        })
        setAba('lista')
        toast.success(`${json.referencias.length} referências importadas com sucesso!`)
      } else if (res.ok) {
        toast.info(json.mensagem ?? 'Nenhuma nova referência encontrada.')
      } else {
        toast.error(json.error ?? 'Erro ao importar referências')
      }
    } catch (err) {
      console.error('[Referências] Erro ao importar automático:', err)
      toast.error('Erro ao buscar referências. Verifique sua conexão.')
    } finally {
      setImportandoAuto(false)
    }
  }

  // ── Deletar (com confirmação inline — sem confirm() nativo) ────────
  function solicitarDelete(id: string) {
    setConfirmandoDeleteId(id)
  }

  async function confirmarDelete(id: string) {
    setConfirmandoDeleteId(null)
    setDeletandoId(id)
    try {
      const res = await fetch(`/api/referencias/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReferencias(prev => prev.filter(r => r.id !== id))
        toast.success('Referência removida.')
      } else {
        toast.error('Erro ao remover referência.')
      }
    } catch (err) {
      console.error('[Referências] Erro ao deletar:', err)
      toast.error('Erro ao remover. Tente novamente.')
    } finally {
      setDeletandoId(null)
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
              onClick={handleAutoImportar}
              disabled={importandoAuto}
              className={cn(buttonVariants(), 'gap-2')}
            >
              {importandoAuto
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</>
                : <><Sparkles className="h-4 w-4" /> Importar com IA</>}
            </button>
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

          {/* Painel de verificação automática de referências */}
          {referencias.length > 0 && (
            <PainelVerificacaoReferencias
              report={report}
              isValidating={isValidating}
              strictMode={strictMode}
              onRevalidate={handleRevalidate}
              onToggleStrictMode={setStrictMode}
              canExport={canExport(referencias ?? [])}
            />
          )}

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
                    : 'Deixe a IA buscar referências reais automaticamente, ou pesquise e adicione você mesmo.'}
                </p>
              </div>
              {!filtro && (
                <div className="flex justify-center gap-2 flex-wrap">
                  <button
                    onClick={handleAutoImportar}
                    disabled={importandoAuto}
                    className={cn(buttonVariants(), 'gap-2')}
                  >
                    {importandoAuto
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando referências reais…</>
                      : <><Sparkles className="h-4 w-4" /> Importar automaticamente com IA</>}
                  </button>
                  <button
                    onClick={() => setAba('buscar')}
                    className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
                  >
                    <Search className="h-4 w-4" /> Buscar manualmente
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {referenciasExibidas.map(ref => (
                <div key={ref.id} className="relative">
                  {/* Confirmação inline de exclusão */}
                  {confirmandoDeleteId === ref.id && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-destructive/95 text-white p-4 text-center">
                      <p className="text-sm font-medium">Remover esta referência?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmarDelete(ref.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-destructive text-xs font-semibold hover:bg-white/90"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </button>
                        <button
                          onClick={() => setConfirmandoDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-medium hover:bg-white/30"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  <ReferenciaCard
                    referencia={ref}
                    formato={trabalho.formato_citacao}
                    onDeletar={deletandoId === ref.id ? undefined : solicitarDelete}
                    deletando={deletandoId === ref.id}
                  />
                </div>
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
