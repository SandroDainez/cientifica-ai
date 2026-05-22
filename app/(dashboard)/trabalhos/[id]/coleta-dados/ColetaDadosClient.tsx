'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, Download, Trash2,
  ClipboardList, BarChart3, FileSpreadsheet, Plus, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Trabalho } from '@/types'

interface Instrumento {
  id: string
  nome: string
  tipo: string
  descricao: string
  campos: Campo[]
}

interface Campo {
  id: string
  rotulo: string
  tipo: 'texto' | 'numero' | 'data' | 'selecao' | 'likert' | 'multipla_escolha'
  opcoes?: string[]
  obrigatorio: boolean
}

interface Props {
  trabalho: Trabalho
  instrumentosIniciais: Instrumento[]
}

const INSTRUMENTOS_VALIDADOS = [
  { nome: 'SF-36', area: 'Qualidade de vida geral', como_citar: 'Ciconelli et al., 1999 (versão brasileira)' },
  { nome: 'WHOQOL-BREF', area: 'Qualidade de vida (OMS)', como_citar: 'Fleck et al., 2000 (versão brasileira)' },
  { nome: 'PHQ-9', area: 'Rastreamento de depressão', como_citar: 'Kroenke & Spitzer, 2002' },
  { nome: 'GAD-7', area: 'Rastreamento de ansiedade', como_citar: 'Spitzer et al., 2006' },
  { nome: 'Mini-Mental (MEEM)', area: 'Avaliação cognitiva', como_citar: 'Folstein et al., 1975' },
  { nome: 'Escala de Berg', area: 'Equilíbrio funcional', como_citar: 'Berg et al., 1992' },
  { nome: 'VAS (Escala Visual Analógica)', area: 'Dor', como_citar: 'Huskisson, 1974' },
  { nome: 'Escala de Barthel', area: 'Atividades da vida diária', como_citar: 'Mahoney & Barthel, 1965' },
]

const TIPOS_CAMPO = [
  { value: 'texto', label: 'Texto livre' },
  { value: 'numero', label: 'Número' },
  { value: 'data', label: 'Data' },
  { value: 'selecao', label: 'Seleção única' },
  { value: 'multipla_escolha', label: 'Múltipla escolha' },
  { value: 'likert', label: 'Escala Likert (1-5)' },
]

let campoId = 0

export function ColetaDadosClient({ trabalho, instrumentosIniciais }: Props) {
  const [aba, setAba] = useState<'questionario' | 'planilha' | 'validados'>('questionario')
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>(instrumentosIniciais)
  const [novoNome, setNovoNome] = useState('')
  const [campos, setCampos] = useState<Campo[]>([])
  const [gerandoQuestionario, setGerandoQuestionario] = useState(false)
  const [questionarioGerado, setQuestionarioGerado] = useState('')
  const [salvando, setSalvando] = useState(false)

  function adicionarCampo() {
    setCampos(prev => [...prev, {
      id: `campo_${++campoId}`,
      rotulo: '',
      tipo: 'texto',
      opcoes: [],
      obrigatorio: false,
    }])
  }

  function setCampo(idx: number, key: keyof Campo, val: unknown) {
    setCampos(prev => prev.map((c, i) => i === idx ? { ...c, [key]: val } : c))
  }

  function removerCampo(idx: number) {
    setCampos(prev => prev.filter((_, i) => i !== idx))
  }

  async function gerarComIA() {
    setGerandoQuestionario(true)
    setQuestionarioGerado('')
    try {
      const res = await fetch('/api/ia/gerar-questionario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          tipoInstrumento: 'questionario',
        }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setQuestionarioGerado(acumulado)
      }
    } finally {
      setGerandoQuestionario(false)
    }
  }

  async function salvarInstrumento() {
    if (!novoNome.trim() && campos.length === 0) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/trabalhos/${trabalho.id}/coleta-dados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoNome || 'Questionário sem título',
          tipo: 'questionario',
          descricao: '',
          campos,
        }),
      })
      if (res.ok) {
        const novo = await res.json() as Instrumento
        setInstrumentos(prev => [...prev, novo])
        setNovoNome('')
        setCampos([])
      }
    } finally {
      setSalvando(false)
    }
  }

  async function excluirInstrumento(id: string) {
    await fetch(`/api/trabalhos/${trabalho.id}/coleta-dados/${id}`, { method: 'DELETE' })
    setInstrumentos(prev => prev.filter(i => i.id !== id))
  }

  async function baixarCSV() {
    if (campos.length === 0) return
    const cabecalho = campos.map(c => c.rotulo || c.id).join(',')
    const blob = new Blob([`${cabecalho}\n`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coleta_dados_${trabalho.id.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <PageHeader
        title="Coleta de Dados"
        description="Crie questionários, formulários e planilhas para sua pesquisa"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo ?? 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'Coleta de Dados' },
        ]}
        actions={
          <Link href={`/trabalhos/${trabalho.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
            <ArrowLeft className="h-4 w-4" /> Voltar ao Editor
          </Link>
        }
      />

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'questionario', label: 'Questionário', icon: ClipboardList },
          { id: 'planilha', label: 'Planilha de Coleta', icon: FileSpreadsheet },
          { id: 'validados', label: 'Instrumentos Validados', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setAba(id as typeof aba)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all',
              aba === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}>
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── ABA: QUESTIONÁRIO ─────────────────────────────── */}
      {aba === 'questionario' && (
        <div className="space-y-5">
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Novo questionário</p>
              <button type="button" onClick={gerarComIA} disabled={gerandoQuestionario}
                className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 text-sm')}>
                {gerandoQuestionario ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar com IA
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Nome do instrumento</label>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                className={inputCls} placeholder="Ex: Questionário de qualidade de vida" />
            </div>

            {/* Campos do questionário */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Perguntas/Variáveis</label>
                <button type="button" onClick={adicionarCampo}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Adicionar campo
                </button>
              </div>
              {campos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                  Nenhum campo adicionado. Clique em &quot;Adicionar campo&quot; ou use a IA para gerar automaticamente.
                </p>
              )}
              {campos.map((campo, i) => (
                <div key={campo.id} className="flex gap-2 items-start p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1 grid sm:grid-cols-3 gap-2">
                    <input value={campo.rotulo} onChange={e => setCampo(i, 'rotulo', e.target.value)}
                      className={cn(inputCls, 'sm:col-span-2')} placeholder="Rótulo da pergunta" />
                    <select value={campo.tipo} onChange={e => setCampo(i, 'tipo', e.target.value)}
                      className={selectCls}>
                      {TIPOS_CAMPO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-gray-600 col-span-full">
                      <input type="checkbox" checked={campo.obrigatorio}
                        onChange={e => setCampo(i, 'obrigatorio', e.target.checked)} />
                      Obrigatório
                    </label>
                  </div>
                  <button type="button" onClick={() => removerCampo(i)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* IA gerou */}
            {questionarioGerado && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Questionário gerado pela IA</label>
                <textarea value={questionarioGerado} onChange={e => setQuestionarioGerado(e.target.value)}
                  rows={10} className={textareaCls} />
                <p className="text-xs text-muted-foreground">
                  Revise e edite conforme necessário antes de usar.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              {campos.length > 0 && (
                <button type="button" onClick={baixarCSV}
                  className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 text-sm')}>
                  <Download className="h-4 w-4" /> Baixar planilha CSV
                </button>
              )}
              <button type="button" onClick={salvarInstrumento} disabled={salvando}
                className={cn(buttonVariants(), 'gap-2')}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Salvar instrumento
              </button>
            </div>
          </div>

          {/* Instrumentos salvos */}
          {instrumentos.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-gray-50">
                <p className="text-sm font-semibold text-gray-900">Instrumentos criados ({instrumentos.length})</p>
              </div>
              <div className="divide-y">
                {instrumentos.map(inst => (
                  <div key={inst.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inst.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{inst.tipo} · {inst.campos?.length ?? 0} campos</p>
                    </div>
                    <button onClick={() => excluirInstrumento(inst.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: PLANILHA ─────────────────────────────────── */}
      {aba === 'planilha' && (
        <div className="bg-white border rounded-xl p-5 space-y-5">
          <p className="text-sm text-muted-foreground">
            Defina as variáveis da sua coleta para gerar uma planilha CSV estruturada, pronta para preenchimento e análise estatística.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Variáveis da planilha</label>
              <button type="button" onClick={adicionarCampo}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Adicionar variável
              </button>
            </div>
            {campos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
                Defina as colunas da sua planilha de coleta.
              </p>
            )}
            {campos.map((campo, i) => (
              <div key={campo.id} className="flex gap-2 items-center">
                <input value={campo.rotulo} onChange={e => setCampo(i, 'rotulo', e.target.value)}
                  className={cn(inputCls, 'flex-1')} placeholder="Nome da variável (ex: Idade, Sexo, Glicemia)" />
                <select value={campo.tipo} onChange={e => setCampo(i, 'tipo', e.target.value)} className={cn(selectCls, 'w-40')}>
                  {TIPOS_CAMPO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => removerCampo(i)} className="text-gray-400 hover:text-red-500 p-2">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {campos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Preview das colunas: {campos.filter(c => c.rotulo).map(c => c.rotulo).join(' | ')}
              </p>
              <button type="button" onClick={baixarCSV}
                className={cn(buttonVariants(), 'gap-2')}>
                <Download className="h-4 w-4" /> Baixar planilha CSV
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: INSTRUMENTOS VALIDADOS ───────────────────── */}
      {aba === 'validados' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Instrumentos psicométricos e clínicos validados para uso em pesquisa. Sempre cite o instrumento corretamente.
          </p>
          <div className="grid gap-3">
            {INSTRUMENTOS_VALIDADOS.map(inst => (
              <div key={inst.nome} className="bg-white border rounded-xl p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{inst.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{inst.area}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">Citar: {inst.como_citar}</p>
                </div>
                <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(inst.nome + ' validação brasileira')}`}
                  target="_blank" rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'ghost' }), 'shrink-0 gap-1.5 text-xs')}>
                  <ExternalLink className="h-3.5 w-3.5" /> Buscar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'
const selectCls = 'w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'
const textareaCls = 'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-y'
