'use client'

import { useState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { TipoReferencia, AutorReferencia } from '@/types'

interface FormAdicionarReferenciaProps {
  onAdicionada: (dados: Record<string, unknown>) => void
  onCancelar: () => void
  salvando: boolean
}

type TipoForm = 'artigo' | 'livro' | 'site' | 'tese'

const TIPOS: { value: TipoForm; label: string }[] = [
  { value: 'artigo', label: 'Artigo científico' },
  { value: 'livro',  label: 'Livro' },
  { value: 'site',   label: 'Site / página web' },
  { value: 'tese',   label: 'Tese ou dissertação' },
]

const TIPO_REF_MAP: Record<TipoForm, TipoReferencia> = {
  artigo: 'artigo',
  livro:  'livro',
  site:   'site',
  tese:   'tese',
}

interface AutorInput { nome: string; sobrenome: string }

export function FormAdicionarReferencia({ onAdicionada, onCancelar, salvando }: FormAdicionarReferenciaProps) {
  const [tipo, setTipo] = useState<TipoForm>('artigo')
  const [titulo, setTitulo] = useState('')
  const [autores, setAutores] = useState<AutorInput[]>([{ nome: '', sobrenome: '' }])
  const [ano, setAno] = useState('')
  const [journal, setJournal] = useState('')
  const [volume, setVolume] = useState('')
  const [numero, setNumero] = useState('')
  const [paginas, setPaginas] = useState('')
  const [doi, setDoi] = useState('')
  const [url, setUrl] = useState('')
  const [editora, setEditora] = useState('')
  const [cidade, setCidade] = useState('')
  const [isbn, setIsbn] = useState('')

  function addAutor() {
    setAutores(prev => [...prev, { nome: '', sobrenome: '' }])
  }
  function removeAutor(i: number) {
    setAutores(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateAutor(i: number, field: keyof AutorInput, value: string) {
    setAutores(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return

    const autoresFiltrados: AutorReferencia[] = autores
      .filter(a => a.nome.trim() || a.sobrenome.trim())
      .map(a => ({ nome: a.nome.trim(), sobrenome: a.sobrenome.trim(), iniciais: a.nome.charAt(0) + '.' }))

    onAdicionada({
      tipo: TIPO_REF_MAP[tipo],
      titulo: titulo.trim(),
      autores: autoresFiltrados.length ? autoresFiltrados : undefined,
      ano: ano ? parseInt(ano) : undefined,
      journal: journal.trim() || undefined,
      volume: volume.trim() || undefined,
      numero: numero.trim() || undefined,
      paginas: paginas.trim() || undefined,
      doi: doi.trim() || undefined,
      url: url.trim() || undefined,
      editora: editora.trim() || undefined,
      cidade: cidade.trim() || undefined,
      isbn: isbn.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">Adicionar referência</h2>
          <button onClick={onCancelar} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => (
                <label key={t.value} className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm cursor-pointer transition-all',
                  tipo === t.value
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border text-gray-700 hover:border-primary/40'
                )}>
                  <input type="radio" name="tipo" value={t.value} checked={tipo === t.value}
                    onChange={() => setTipo(t.value)} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* Título */}
          <Field label="Título *" required>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} required
              placeholder="Título completo da obra" className={inputCls} />
          </Field>

          {/* Autores */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Autores</label>
            {autores.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input value={a.sobrenome} onChange={e => updateAutor(i, 'sobrenome', e.target.value)}
                  placeholder="Sobrenome" className={cn(inputCls, 'flex-1')} />
                <input value={a.nome} onChange={e => updateAutor(i, 'nome', e.target.value)}
                  placeholder="Nome" className={cn(inputCls, 'flex-1')} />
                {i > 0 && (
                  <button type="button" onClick={() => removeAutor(i)}
                    className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addAutor}
              className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Adicionar autor
            </button>
          </div>

          {/* Ano */}
          <Field label="Ano de publicação">
            <input value={ano} onChange={e => setAno(e.target.value)}
              type="number" min="1800" max="2099" placeholder="Ex: 2023" className={cn(inputCls, 'w-32')} />
          </Field>

          {/* Campos específicos por tipo */}
          {tipo === 'artigo' && (
            <>
              <Field label="Periódico / Revista">
                <input value={journal} onChange={e => setJournal(e.target.value)}
                  placeholder="Ex: Revista Brasileira de…" className={inputCls} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Volume">
                  <input value={volume} onChange={e => setVolume(e.target.value)} placeholder="Ex: 12" className={inputCls} />
                </Field>
                <Field label="Número">
                  <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 3" className={inputCls} />
                </Field>
                <Field label="Páginas">
                  <input value={paginas} onChange={e => setPaginas(e.target.value)} placeholder="Ex: 45-60" className={inputCls} />
                </Field>
              </div>
              <Field label="DOI">
                <input value={doi} onChange={e => setDoi(e.target.value)}
                  placeholder="Ex: 10.1000/xyz123" className={inputCls} />
              </Field>
            </>
          )}

          {tipo === 'livro' && (
            <>
              <Field label="Editora">
                <input value={editora} onChange={e => setEditora(e.target.value)} placeholder="Ex: Atlas" className={inputCls} />
              </Field>
              <Field label="Cidade">
                <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: São Paulo" className={inputCls} />
              </Field>
              <Field label="ISBN">
                <input value={isbn} onChange={e => setIsbn(e.target.value)} placeholder="Ex: 978-…" className={inputCls} />
              </Field>
            </>
          )}

          {tipo === 'site' && (
            <Field label="URL">
              <input value={url} onChange={e => setUrl(e.target.value)}
                type="url" placeholder="https://…" className={inputCls} />
            </Field>
          )}

          {tipo === 'tese' && (
            <>
              <Field label="Instituição">
                <input value={editora} onChange={e => setEditora(e.target.value)}
                  placeholder="Ex: Universidade de São Paulo" className={inputCls} />
              </Field>
              <Field label="Cidade">
                <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: São Paulo" className={inputCls} />
              </Field>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancelar} className={cn(buttonVariants({ variant: 'outline' }))}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando || !titulo.trim()} className={cn(buttonVariants(), 'gap-2')}>
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : 'Adicionar referência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'
