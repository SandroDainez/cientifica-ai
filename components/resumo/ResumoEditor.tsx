'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Save, CheckCircle2, Globe, FileText, Tag, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ContadorPalavras } from './ContadorPalavras'
import { SugestorPalavrasChave } from './SugestorPalavrasChave'
import type { Trabalho, FaseConfig } from '@/types'

interface ResumoData {
  resumo: string
  abstract: string
  palavras_chave: string[]
  keywords: string[]
}

interface Props {
  trabalho: Trabalho
  fase: FaseConfig
  conteudoInicial: string
  onSalvar: (conteudo: string, avancar?: boolean) => Promise<void>
  isUltimaFase: boolean
  statusExterno: 'idle' | 'salvando'
}

function parseConteudo(raw: string): ResumoData {
  try {
    return JSON.parse(raw)
  } catch {
    return { resumo: raw, abstract: '', palavras_chave: [], keywords: [] }
  }
}

export function ResumoEditor({ trabalho, fase, conteudoInicial, onSalvar, isUltimaFase, statusExterno }: Props) {
  const [dados, setDados] = useState<ResumoData>(() => parseConteudo(conteudoInicial))
  const [gerandoResumo, setGerandoResumo] = useState(false)
  const [gerandoAbstract, setGerandoAbstract] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const minResumo = fase.min_palavras ?? 150
  const maxResumo = fase.max_palavras ?? 500

  function set(key: keyof ResumoData, val: string | string[]) {
    setSalvo(false)
    setDados(prev => ({ ...prev, [key]: val }))
  }

  function serializar(d: ResumoData) {
    return JSON.stringify(d)
  }

  async function gerarResumo() {
    setGerandoResumo(true)
    try {
      const res = await fetch('/api/ia/gerar-resumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId: trabalho.id, modo: 'resumo_pt' }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setDados(prev => ({ ...prev, resumo: acumulado }))
      }
    } finally {
      setGerandoResumo(false)
    }
  }

  async function gerarAbstract() {
    setGerandoAbstract(true)
    try {
      const res = await fetch('/api/ia/gerar-resumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId: trabalho.id, modo: 'abstract_en', resumo_pt: dados.resumo }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setDados(prev => ({ ...prev, abstract: acumulado }))
      }
    } finally {
      setGerandoAbstract(false)
    }
  }

  async function handleSalvar(avancar = false) {
    const conteudo = serializar(dados)
    await onSalvar(conteudo, avancar)
    if (!avancar) setSalvo(true)
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <p className="text-sm font-semibold text-blue-900">{fase.nome}</p>
        <p className="text-xs text-blue-700 mt-1">{fase.instrucoes}</p>
      </div>

      {/* ── RESUMO PT ─────────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Resumo em Português</p>
          <span className="ml-auto text-xs text-muted-foreground">ABNT NBR 6028 — {minResumo}–{maxResumo} palavras</span>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <textarea
              value={dados.resumo}
              onChange={e => set('resumo', e.target.value)}
              placeholder="O resumo deve apresentar: contextualização, objetivo, metodologia, resultados e conclusão…"
              className="w-full min-h-[200px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
            {gerandoResumo && (
              <div className="absolute inset-0 flex items-start justify-end p-2 pointer-events-none">
                <span className="text-xs text-primary flex items-center gap-1 bg-card/90 px-2 py-1 rounded-full border">
                  <Loader2 className="h-3 w-3 animate-spin" /> Gerando…
                </span>
              </div>
            )}
          </div>
          <ContadorPalavras texto={dados.resumo} min={minResumo} max={maxResumo} />
          <button
            type="button"
            onClick={gerarResumo}
            disabled={gerandoResumo}
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 text-sm')}
          >
            {gerandoResumo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {gerandoResumo ? 'Gerando resumo…' : 'Gerar resumo com IA'}
          </button>
        </div>
      </div>

      {/* ── PALAVRAS-CHAVE ────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Palavras-chave</p>
          <span className="ml-auto text-xs text-muted-foreground">3–6 termos (preferencialmente DeCS/MeSH)</span>
        </div>
        <div className="p-5">
          <SugestorPalavrasChave
            texto={dados.resumo}
            area={trabalho.area_conhecimento ?? ''}
            selecionados={dados.palavras_chave}
            onAdicionar={termo => set('palavras_chave', [...dados.palavras_chave, termo])}
            onRemover={termo => set('palavras_chave', dados.palavras_chave.filter(p => p !== termo))}
            placeholder="Ex: diabetes mellitus tipo 2"
          />
          {dados.palavras_chave.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground font-mono bg-gray-50 rounded p-2">
              <span className="font-semibold">Palavras-chave:</span> {dados.palavras_chave.join('; ')}.
            </p>
          )}
        </div>
      </div>

      {/* ── ABSTRACT EN ──────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Abstract (English)</p>
          <span className="ml-auto text-xs text-muted-foreground">Academic English — not a literal translation</span>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <textarea
              value={dados.abstract}
              onChange={e => set('abstract', e.target.value)}
              placeholder="Abstract should include: background, objective, methods, results, and conclusion…"
              className="w-full min-h-[200px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
            {gerandoAbstract && (
              <div className="absolute inset-0 flex items-start justify-end p-2 pointer-events-none">
                <span className="text-xs text-primary flex items-center gap-1 bg-card/90 px-2 py-1 rounded-full border">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                </span>
              </div>
            )}
          </div>
          <ContadorPalavras texto={dados.abstract} min={150} max={350} label="Abstract" />
          <button
            type="button"
            onClick={gerarAbstract}
            disabled={gerandoAbstract || !dados.resumo.trim()}
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 text-sm')}
          >
            {gerandoAbstract ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {gerandoAbstract ? 'Generating abstract…' : 'Generate abstract with AI'}
          </button>
          {!dados.resumo.trim() && (
            <p className="text-xs text-muted-foreground">Preencha o resumo em português primeiro.</p>
          )}
        </div>
      </div>

      {/* ── KEYWORDS ─────────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Keywords (English)</p>
          <span className="ml-auto text-xs text-muted-foreground">3–6 terms (MeSH preferred)</span>
        </div>
        <div className="p-5">
          <SugestorPalavrasChave
            texto={dados.abstract}
            area={trabalho.area_conhecimento ?? ''}
            selecionados={dados.keywords}
            onAdicionar={termo => set('keywords', [...dados.keywords, termo])}
            onRemover={termo => set('keywords', dados.keywords.filter(k => k !== termo))}
            placeholder="e.g., type 2 diabetes mellitus"
          />
          {dados.keywords.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground font-mono bg-gray-50 rounded p-2">
              <span className="font-semibold">Keywords:</span> {dados.keywords.join('; ')}.
            </p>
          )}
        </div>
      </div>

      {/* ── BOTÕES ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span>
          {salvo && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Rascunho salvo!
            </p>
          )}
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSalvar(false)}
            disabled={statusExterno === 'salvando' || !dados.resumo.trim()}
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          >
            {statusExterno === 'salvando' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={() => handleSalvar(true)}
            disabled={statusExterno === 'salvando' || !dados.resumo.trim()}
            className={cn(buttonVariants(), 'gap-2')}
          >
            {isUltimaFase ? 'Concluir trabalho' : 'Concluir e avançar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
