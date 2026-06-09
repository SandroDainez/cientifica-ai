'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Loader2, CheckCircle2, XCircle, AlertTriangle, FileWarning,
  ChevronDown, Wand2, Check, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
// import type → NÃO bundla o código server (openai/process.env) no cliente.
import type { ReviewResult, ReviewProblema, IterativeReviewData } from '@/lib/ai/reviewService'

interface Props {
  trabalho: string
  tipo: string
  tema: string
  area: string
  normas: string
  idioma?: string
  /** Chamado quando o usuário aceita a versão final corrigida. */
  onAceitarVersaoFinal?: (versao: string) => void
}

type Estado = 'inicial' | 'analisando' | 'resultado' | 'corrigindo' | 'final'

const CHECKLIST_ROTULOS: Record<keyof ReviewResult['checklist'], string> = {
  coerencia_objetivos: 'Coerência objetivos ↔ metodologia ↔ conclusão',
  linguagem_adequada: 'Linguagem acadêmica adequada',
  estrutura_completa: 'Estrutura completa (intro, desenvolvimento, conclusão)',
  citacoes_com_suporte: 'Citações com suporte',
  referencias_verificadas: 'Referências verificadas',
  sem_contradicoes: 'Sem contradições internas',
}

const CATEGORIA_ROTULO: Record<ReviewProblema['categoria'], string> = {
  linguagem: 'Linguagem', estrutura: 'Estrutura', citacao: 'Citação',
  referencia: 'Referência', coerencia: 'Coerência', formatacao: 'Formatação',
}

const GRAVIDADE_COR: Record<ReviewProblema['gravidade'], string> = {
  baixa: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  media: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  alta: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  critica: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function corNota(n: number): string {
  if (n >= 80) return 'text-green-600 dark:text-green-400'
  if (n >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function NotaGrande({ nota, rotulo }: { nota: number; rotulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <span className={cn('text-6xl font-bold tabular-nums', corNota(nota))}>{nota}</span>
      <span className="text-xs text-muted-foreground mt-1">{rotulo} (0–100)</span>
    </div>
  )
}

function Checklist({ checklist }: { checklist: ReviewResult['checklist'] }) {
  return (
    <ul className="space-y-1.5">
      {(Object.keys(CHECKLIST_ROTULOS) as (keyof ReviewResult['checklist'])[]).map(k => (
        <li key={k} className="flex items-center gap-2 text-sm">
          {checklist[k]
            ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            : <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />}
          <span className={checklist[k] ? 'text-foreground' : 'text-foreground font-medium'}>{CHECKLIST_ROTULOS[k]}</span>
        </li>
      ))}
    </ul>
  )
}

function ListaProblemas({ problemas }: { problemas: ReviewProblema[] }) {
  if (problemas.length === 0) {
    return <p className="text-sm text-green-700 dark:text-green-300">Nenhum problema apontado. 🎉</p>
  }
  // Agrupa por categoria
  const grupos = problemas.reduce<Record<string, ReviewProblema[]>>((acc, p) => {
    (acc[p.categoria] ??= []).push(p)
    return acc
  }, {})
  return (
    <div className="space-y-3">
      {Object.entries(grupos).map(([cat, lista]) => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            {CATEGORIA_ROTULO[cat as ReviewProblema['categoria']] ?? cat} ({lista.length})
          </p>
          <div className="space-y-2">
            {lista.map((p, i) => (
              <div key={i} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={cn('text-[10px]', GRAVIDADE_COR[p.gravidade])}>{p.gravidade}</Badge>
                  {p.impacto_estimado < 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">{p.impacto_estimado} pts</span>
                  )}
                </div>
                {p.trecho && <p className="text-xs italic text-muted-foreground mb-1 break-words">“{p.trecho}”</p>}
                <p className="text-foreground">{p.problema}</p>
                {p.sugestao && <p className="text-xs text-muted-foreground mt-1"><strong>Sugestão:</strong> {p.sugestao}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReferenciasSuspeitas({ refs }: { refs: ReviewResult['referencias_suspeitas'] }) {
  if (!refs || refs.length === 0) return null
  return (
    <div className="rounded-lg border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
        <FileWarning className="h-4 w-4" /> Referências suspeitas ({refs.length})
      </p>
      <div className="space-y-2">
        {refs.map((r, i) => (
          <div key={i} className="text-sm">
            <p className="font-medium text-foreground break-words">{r.referencia}</p>
            <p className="text-xs text-foreground/80">{r.problema}</p>
            <Badge className="mt-1 text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
              ação: {r.acao_recomendada.replace('_', ' ')}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdvancedReview({ trabalho, tipo, tema, area, normas, idioma = 'pt-BR', onAceitarVersaoFinal }: Props) {
  const [estado, setEstado] = useState<Estado>('inicial')
  const [analise, setAnalise] = useState<ReviewResult | null>(null)
  const [iterativo, setIterativo] = useState<IterativeReviewData | null>(null)
  const [verDiff, setVerDiff] = useState(false)

  const metadados = { tipo, tema, area, normas, idioma }

  async function executarRevisao() {
    if (!trabalho?.trim()) { toast.error('O trabalho está vazio.'); return }
    setEstado('analisando')
    try {
      const res = await fetch('/api/review/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...metadados, trabalho, modoCorrecao: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha na revisão.')
      setAnalise(data as ReviewResult)
      setEstado('resultado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao revisar.')
      setEstado('inicial')
    }
  }

  async function aplicarCorrecoes() {
    setEstado('corrigindo')
    try {
      const res = await fetch('/api/review/iterate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...metadados, trabalho, versaoAtual: trabalho }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao aplicar correções.')
      setIterativo(data as IterativeReviewData)
      setEstado('final')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao corrigir.')
      setEstado('resultado')
    }
  }

  function finalizarSemCorrigir() {
    toast.success('Revisão concluída. Nenhuma correção automática aplicada.')
    setEstado('inicial'); setAnalise(null)
  }

  function aceitarVersaoFinal() {
    if (iterativo?.versaoFinal) {
      onAceitarVersaoFinal?.(iterativo.versaoFinal)
      toast.success('Versão final aceita.')
    }
    setEstado('inicial'); setAnalise(null); setIterativo(null); setVerDiff(false)
  }

  // Notas por iteração (passos de análise = índices pares do histórico)
  const progressaoNotas = (iterativo?.historico ?? []).filter((_, i) => i % 2 === 0).map(r => r.nota_estimada)
  const resultadoFinal = iterativo?.historico?.[iterativo.historico.length - 1]

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Revisão Avançada por IA
        </CardTitle>
        <CardDescription>
          Um revisor acadêmico (modelo dedicado) audita o trabalho, aponta problemas e, se você quiser,
          aplica correções iterativas sem inventar dados nem reescrever do zero.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 1. INICIAL */}
        {estado === 'inicial' && (
          <Button onClick={executarRevisao} className="gap-2">
            <Sparkles className="h-4 w-4" /> Executar Revisão Avançada
          </Button>
        )}

        {/* 2. ANALISANDO */}
        {estado === 'analisando' && (
          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Analisando trabalho…</span>
          </div>
        )}

        {/* 3. RESULTADO */}
        {estado === 'resultado' && analise && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <NotaGrande nota={analise.nota_estimada} rotulo="Nota estimada" />
              <div className="flex-1">
                <Badge className={cn('mb-1', analise.status === 'aprovado'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : analise.status === 'critico'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300')}>
                  {analise.status.replace('_', ' ')}
                </Badge>
                {analise.resumo_geral && <p className="text-sm text-muted-foreground">{analise.resumo_geral}</p>}
              </div>
            </div>

            <Separator />
            <div>
              <p className="text-sm font-semibold mb-2">Checklist de critérios</p>
              <Checklist checklist={analise.checklist} />
            </div>

            <ReferenciasSuspeitas refs={analise.referencias_suspeitas} />

            <div>
              <p className="text-sm font-semibold mb-2">Problemas encontrados ({analise.problemas_encontrados.length})</p>
              <ListaProblemas problemas={analise.problemas_encontrados} />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={aplicarCorrecoes} className="gap-2">
                <Wand2 className="h-4 w-4" /> Aplicar correções automáticas
              </Button>
              <Button variant="outline" onClick={finalizarSemCorrigir}>Finalizar sem corrigir</Button>
            </div>
          </div>
        )}

        {/* 4. CORRIGINDO */}
        {estado === 'corrigindo' && (
          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Aplicando correções automáticas… (revisão iterativa, pode levar alguns instantes)</span>
          </div>
        )}

        {/* 5. FINAL */}
        {estado === 'final' && iterativo && resultadoFinal && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <NotaGrande nota={resultadoFinal.nota_estimada} rotulo="Nota final" />
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  <strong>{iterativo.iteracoes}</strong> {iterativo.iteracoes === 1 ? 'iteração' : 'iterações'} de correção aplicada(s).
                </p>
                {progressaoNotas.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
                    Progressão:
                    {progressaoNotas.map((n, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <span className={cn('font-medium tabular-nums', corNota(n))}>{n}</span>
                        {i < progressaoNotas.length - 1 && <ArrowRight className="h-3 w-3" />}
                      </span>
                    ))}
                  </p>
                )}
                {resultadoFinal.resumo_geral && <p className="text-sm text-muted-foreground mt-1">{resultadoFinal.resumo_geral}</p>}
              </div>
            </div>

            {/* Comparativo antes/depois */}
            <div>
              <button
                type="button"
                onClick={() => setVerDiff(v => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', verDiff && 'rotate-180')} />
                Ver diferenças (antes / depois)
              </button>
              {verDiff && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">ANTES</p>
                    <pre className="text-xs whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 p-3 max-h-80 overflow-y-auto font-sans">{trabalho}</pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">DEPOIS</p>
                    <pre className="text-xs whitespace-pre-wrap break-words rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 max-h-80 overflow-y-auto font-sans">{iterativo.versaoFinal}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {iterativo.versaoFinal && iterativo.versaoFinal !== trabalho && onAceitarVersaoFinal && (
                <Button onClick={aceitarVersaoFinal} className="gap-2">
                  <Check className="h-4 w-4" /> Aceitar versão final
                </Button>
              )}
              <Button variant="outline" onClick={() => { setEstado('inicial'); setAnalise(null); setIterativo(null); setVerDiff(false) }}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
