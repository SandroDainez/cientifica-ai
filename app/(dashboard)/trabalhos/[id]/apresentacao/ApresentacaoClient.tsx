'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Presentation, Download, Loader2, Sparkles,
  Clock, Layers, Palette, ChevronRight, BookOpen,
  HelpCircle, BarChart2, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, AlertTriangle, Star,
  MessageSquare, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import { toast } from 'sonner'
import type { Trabalho } from '@/types'

interface Props { trabalho: Trabalho }

// ─── Tipos da análise ──────────────────────────────────────────────────────────

interface Criterio {
  nome: string
  pontuacao: number
  max: number
  peso: number
  observacao: string
}

interface PerguntaBanca {
  pergunta: string
  area: string
  dificuldade: 'facil' | 'media' | 'dificil'
  dica_resposta: string
}

interface Avaliacao {
  nota_geral: number
  conceito: string
  parecer_geral: string
  pontos_fortes: string[]
  pontos_fracos: string[]
  risco_reprovacao: boolean
  criterios: Criterio[]
}

interface Roteiro {
  introducao: string
  desenvolvimento: string
  encerramento: string
  dicas_postura: string[]
}

interface Analise {
  roteiro: Roteiro
  perguntas_banca: PerguntaBanca[]
  avaliacao: Avaliacao
}

// ─── Configs PPTX ─────────────────────────────────────────────────────────────

const TEMPOS = [
  { value: 10, label: '10 min — Apresentação rápida (evento/congresso)' },
  { value: 20, label: '20 min — TCC/Monografia (defesa padrão)' },
  { value: 30, label: '30 min — Qualificação ou artigo longo' },
  { value: 45, label: '45 min — Dissertação de mestrado' },
  { value: 60, label: '60 min — Tese de doutorado' },
]

const TEMAS_COR = [
  { value: 'azul_academico',    label: 'Azul Acadêmico',      preview: 'bg-blue-700' },
  { value: 'verde_ciencia',     label: 'Verde Ciência',        preview: 'bg-emerald-700' },
  { value: 'roxo_premium',      label: 'Roxo Premium',         preview: 'bg-violet-700' },
  { value: 'cinza_profissional',label: 'Cinza Profissional',   preview: 'bg-gray-700' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notaCor(nota: number) {
  if (nota >= 9)    return 'text-emerald-700'
  if (nota >= 7.5)  return 'text-blue-700'
  if (nota >= 6)    return 'text-amber-600'
  if (nota >= 5)    return 'text-orange-600'
  return 'text-red-600'
}

function notaBarCor(nota: number) {
  if (nota >= 9)    return 'bg-emerald-500'
  if (nota >= 7.5)  return 'bg-blue-500'
  if (nota >= 6)    return 'bg-amber-500'
  if (nota >= 5)    return 'bg-orange-500'
  return 'bg-red-500'
}

function dificuldadeBadge(d: PerguntaBanca['dificuldade']) {
  switch (d) {
    case 'facil':  return 'bg-green-100 text-green-700'
    case 'media':  return 'bg-amber-100 text-amber-700'
    case 'dificil':return 'bg-red-100 text-red-700'
  }
}

function dificuldadeLabel(d: PerguntaBanca['dificuldade']) {
  switch (d) {
    case 'facil':  return 'Fácil'
    case 'media':  return 'Média'
    case 'dificil':return 'Difícil'
  }
}

function areaLabel(area: string) {
  const map: Record<string, string> = {
    metodologia:    'Metodologia',
    fundamentacao:  'Fundamentação',
    resultados:     'Resultados',
    etica:          'Ética',
    originalidade:  'Originalidade',
    geral:          'Geral',
  }
  return map[area] ?? area
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ApresentacaoClient({ trabalho }: Props) {

  // ── PPTX state ────────────────────────────────────────────────────────────
  const [tempo, setTempo]             = useState(20)
  const [temaCor, setTemaCor]         = useState('azul_academico')
  const [incluirNotas, setIncluirNotas] = useState(true)
  const [pptxStatus, setPptxStatus]   = useState<'idle'|'gerando'|'pronto'|'erro'>('idle')
  const [pptxProgress, setPptxProgress] = useState('')

  // ── Defesa state ──────────────────────────────────────────────────────────
  const [analise, setAnalise]       = useState<Analise | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [expandedQ, setExpandedQ]   = useState<number | null>(null)

  const numSlides = Math.round(tempo * 0.9)

  // ── Gerar PPTX ────────────────────────────────────────────────────────────

  async function gerarApresentacao() {
    setPptxStatus('gerando')
    setPptxProgress('Analisando o trabalho…')
    try {
      const res = await fetch(`/api/exportar/pptx?id=${trabalho.id}`)
      if (!res.ok) { setPptxStatus('erro'); return }
      setPptxProgress('Gerando slides…')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `apresentacao_${(trabalho.titulo ?? 'trabalho').replace(/\s+/g, '_').slice(0, 40)}.pptx`
      a.click()
      URL.revokeObjectURL(url)
      setPptxStatus('pronto')
      setPptxProgress('')
    } catch (err) {
      console.error('[Apresentacao] PPTX erro:', err)
      setPptxStatus('erro')
      setPptxProgress('')
    }
  }

  // ── Analisar para defesa ──────────────────────────────────────────────────

  async function analisarDefesa() {
    setAnalisando(true)
    setAnalise(null)
    try {
      const res = await fetch('/api/ia/preparar-defesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId: trabalho.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `Erro ${res.status}`)
      }
      const { analise: dados } = await res.json() as { analise: Analise; secoes_analisadas: number }
      setAnalise(dados)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao analisar.'
      toast.error(msg)
    } finally {
      setAnalisando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <PageHeader
        title="Apresentação e Defesa"
        description="Prepare-se para a defesa e gere slides PowerPoint"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo ?? 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'Apresentação' },
        ]}
        actions={
          <Link href={`/trabalhos/${trabalho.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
            <ArrowLeft className="h-4 w-4" /> Voltar ao Editor
          </Link>
        }
      />

      {/* ── Card info ─────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-5 flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Presentation className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{trabalho.titulo || 'Trabalho sem título'}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{getTipoLabel(trabalho.tipo_trabalho)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {trabalho.fases_concluidas.length} seção(ões) concluída(s) · análise baseada no conteúdo real
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 1 — PREPARAÇÃO PARA DEFESA                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/40">
          <Shield className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Preparação para Defesa</p>
          <span className="ml-auto text-xs text-muted-foreground">IA analisa seu trabalho</span>
        </div>

        <div className="p-5">
          {!analise && !analisando && (
            <div className="text-center space-y-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  A IA vai analisar seu trabalho e entregar:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 mt-2 text-left max-w-sm mx-auto">
                  <li className="flex gap-2"><MessageSquare className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /> Roteiro de apresentação — o que falar em cada parte</li>
                  <li className="flex gap-2"><HelpCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> 10 perguntas que a banca provavelmente vai fazer</li>
                  <li className="flex gap-2"><BarChart2 className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" /> Avaliação técnica com nota realista por critério</li>
                </ul>
              </div>
              <button
                onClick={analisarDefesa}
                className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
              >
                <Sparkles className="h-5 w-5" />
                Analisar para a Defesa
              </button>
              <p className="text-xs text-muted-foreground">
                Análise honesta e técnica — sem elogios vazios
              </p>
            </div>
          )}

          {analisando && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Analisando seu trabalho…</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Lendo todas as seções, avaliando critérios acadêmicos e preparando as perguntas da banca. Aguarde 20–40 segundos.
              </p>
            </div>
          )}

          {analise && (
            <div className="space-y-6">

              {/* ── Avaliação técnica ──────────────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-violet-500" />
                  Avaliação Técnica
                </h4>

                {/* Nota geral + conceito */}
                <div className={cn(
                  'rounded-xl border p-4 flex items-center gap-4',
                  analise.avaliacao.risco_reprovacao
                    ? 'border-red-300 bg-red-50'
                    : 'border-border bg-card'
                )}>
                  <div className="text-center shrink-0">
                    <p className={cn('text-4xl font-bold', notaCor(analise.avaliacao.nota_geral))}>
                      {analise.avaliacao.nota_geral.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">de 10,0</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{analise.avaliacao.conceito}</p>
                      {analise.avaliacao.risco_reprovacao && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          RISCO DE REPROVAÇÃO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {analise.avaliacao.parecer_geral}
                    </p>
                  </div>
                </div>

                {/* Critérios */}
                <div className="space-y-2">
                  {analise.avaliacao.criterios.map((c, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium">{c.nome}</span>
                        <span className={cn('font-bold', notaCor(c.pontuacao))}>
                          {c.pontuacao.toFixed(1)}/{c.max.toFixed(0)}
                          <span className="font-normal text-muted-foreground ml-1">({c.peso}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', notaBarCor(c.pontuacao))}
                          style={{ width: `${(c.pontuacao / c.max) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{c.observacao}</p>
                    </div>
                  ))}
                </div>

                {/* Pontos fortes / fracos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-800 mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Pontos Fortes
                    </p>
                    <ul className="space-y-1">
                      {analise.avaliacao.pontos_fortes.map((p, i) => (
                        <li key={i} className="text-xs text-green-800 flex gap-1.5">
                          <span className="shrink-0">•</span><span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-semibold text-red-800 mb-1.5 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Pontos a Melhorar
                    </p>
                    <ul className="space-y-1">
                      {analise.avaliacao.pontos_fracos.map((p, i) => (
                        <li key={i} className="text-xs text-red-800 flex gap-1.5">
                          <span className="shrink-0">•</span><span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* ── Roteiro de apresentação ────────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Roteiro de Apresentação
                </h4>

                <div className="space-y-3">
                  <RoteiroBloco titulo="Abertura" conteudo={analise.roteiro.introducao} cor="blue" />
                  <RoteiroBloco titulo="Desenvolvimento" conteudo={analise.roteiro.desenvolvimento} cor="violet" />
                  <RoteiroBloco titulo="Encerramento" conteudo={analise.roteiro.encerramento} cor="green" />
                </div>

                {analise.roteiro.dicas_postura.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" /> Dicas de postura e comunicação
                    </p>
                    <ul className="space-y-1">
                      {analise.roteiro.dicas_postura.map((d, i) => (
                        <li key={i} className="text-xs text-amber-800 flex gap-1.5">
                          <span className="shrink-0">•</span><span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="border-t" />

              {/* ── Perguntas da banca ────────────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-500" />
                  Perguntas Prováveis da Banca
                </h4>

                <div className="space-y-2">
                  {analise.perguntas_banca.map((pq, i) => (
                    <div key={i} className="rounded-lg border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 mt-0.5">
                          {i + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium leading-snug">
                            {pq.pergunta}
                          </p>
                          <div className="flex gap-1.5 mt-1.5">
                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', dificuldadeBadge(pq.dificuldade))}>
                              {dificuldadeLabel(pq.dificuldade)}
                            </span>
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                              {areaLabel(pq.area)}
                            </span>
                          </div>
                        </div>
                        {expandedQ === i
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        }
                      </button>
                      {expandedQ === i && (
                        <div className="px-4 pb-3 border-t bg-muted/20">
                          <p className="text-xs font-semibold text-muted-foreground mt-2 mb-1">
                            💡 Como responder:
                          </p>
                          <p className="text-xs text-foreground leading-relaxed">{pq.dica_resposta}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Regerar */}
              <div className="pt-1">
                <button
                  onClick={analisarDefesa}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Reanalisar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SEÇÃO 2 — GERAR SLIDES PPTX                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* Configurações */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/40">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Gerar Slides PowerPoint</p>
        </div>
        <div className="p-5 space-y-5">
          {/* Tempo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Tempo de apresentação — aprox. {numSlides} slides
            </label>
            <div className="space-y-2">
              {TEMPOS.map(t => (
                <label key={t.value} className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all',
                  tempo === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}>
                  <input type="radio" name="tempo" value={t.value}
                    checked={tempo === t.value} onChange={() => setTempo(t.value)} className="sr-only" />
                  <div className={cn(
                    'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                    tempo === t.value ? 'border-primary' : 'border-gray-300'
                  )}>
                    {tempo === t.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tema */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              Tema de cores
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TEMAS_COR.map(tema => (
                <label key={tema.value} className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all',
                  temaCor === tema.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}>
                  <input type="radio" name="tema" value={tema.value}
                    checked={temaCor === tema.value} onChange={() => setTemaCor(tema.value)} className="sr-only" />
                  <div className={cn('h-4 w-4 rounded-full shrink-0', tema.preview)} />
                  <span className="text-sm">{tema.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notas */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={incluirNotas}
              onChange={e => setIncluirNotas(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary" />
            <div>
              <span className="text-sm font-medium text-foreground">Incluir notas do apresentador</span>
              <p className="text-xs text-muted-foreground">Texto de apoio em cada slide para guiar a fala</p>
            </div>
          </label>
        </div>
      </div>

      {/* Estrutura dos slides */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/40">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Estrutura gerada pela IA</p>
          <span className="ml-auto text-xs text-muted-foreground">~{numSlides} slides</span>
        </div>
        <div className="p-5">
          <div className="space-y-2">
            {[
              `Slide 1 — Capa (título, autor, orientador, instituição)`,
              `Slide 2 — Agenda / Sumário`,
              `Slides 3-${Math.floor(numSlides * 0.2) + 2} — Introdução e contextualização`,
              `Slides ${Math.floor(numSlides * 0.2) + 3}-${Math.floor(numSlides * 0.4) + 2} — Objetivos e metodologia`,
              `Slides ${Math.floor(numSlides * 0.4) + 3}-${Math.floor(numSlides * 0.7) + 2} — Resultados`,
              `Slides ${Math.floor(numSlides * 0.7) + 3}-${numSlides - 2} — Discussão e conclusão`,
              `Slide ${numSlides - 1} — Referências principais`,
              `Slide ${numSlides} — Agradecimentos / Contato`,
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botão de geração PPTX */}
      <div className="flex flex-col items-center gap-3">
        {pptxStatus === 'erro' && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Erro ao gerar a apresentação. Verifique se o trabalho tem seções escritas.
          </p>
        )}
        {pptxStatus === 'pronto' && (
          <p className="text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Apresentação baixada com sucesso!
          </p>
        )}
        {pptxProgress && (
          <p className="text-sm text-primary flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {pptxProgress}
          </p>
        )}
        <button
          onClick={gerarApresentacao}
          disabled={pptxStatus === 'gerando'}
          className={cn(buttonVariants({ size: 'lg' }), 'gap-3 w-full sm:w-auto')}
        >
          {pptxStatus === 'gerando'
            ? <><Loader2 className="h-5 w-5 animate-spin" /> Gerando apresentação…</>
            : <><Download className="h-5 w-5" /> Gerar e baixar apresentação (.pptx)</>
          }
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Quanto mais seções concluídas no editor, melhor o resultado.
        </p>
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function RoteiroBloco({
  titulo, conteudo, cor,
}: {
  titulo: string
  conteudo: string
  cor: 'blue' | 'violet' | 'green'
}) {
  const [expanded, setExpanded] = useState(false)
  const corMap = {
    blue:   { border: 'border-blue-200',   bg: 'bg-blue-50',   text: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700' },
    violet: { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-700' },
    green:  { border: 'border-green-200',  bg: 'bg-green-50',  text: 'text-green-800',  badge: 'bg-green-100 text-green-700' },
  }
  const c = corMap[cor]
  const preview = conteudo.length > 150 && !expanded ? conteudo.substring(0, 150) + '…' : conteudo

  return (
    <div className={cn('rounded-lg border p-4', c.border, c.bg)}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', c.badge)}>{titulo}</span>
        {conteudo.length > 150 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn('text-[11px] underline', c.text)}
          >
            {expanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>
      <p className={cn('text-xs leading-relaxed', c.text)}>{preview}</p>
    </div>
  )
}
