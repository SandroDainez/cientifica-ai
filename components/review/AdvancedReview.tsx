'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sparkles, Loader2, CheckCircle2, XCircle, FileWarning, Wand2, PencilLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
// import type → NÃO bundla o código server (openai/process.env) no cliente.
import type { ReviewResult, ReviewProblema } from '@/lib/ai/reviewService'

interface Props {
  /** ID do trabalho — necessário para aplicar as correções nas seções. */
  trabalhoId: string
  trabalho: string
  tipo: string
  tema: string
  area: string
  normas: string
  idioma?: string
}

type Estado = 'inicial' | 'analisando' | 'resultado' | 'aplicando'

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

/** Banner honesto do efeito da última rodada de correção (antes → depois). */
function DeltaCorrecao({ delta }: { delta: { notaAntes: number; notaDepois: number; qtdAntes: number; qtdDepois: number } }) {
  const dNota = delta.notaDepois - delta.notaAntes
  const melhorou = dNota > 0 || delta.qtdDepois < delta.qtdAntes
  const seta = dNota > 0 ? '↑' : dNota < 0 ? '↓' : '='
  return (
    <div className={cn('rounded-lg border p-3 text-sm',
      melhorou
        ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40'
        : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40')}>
      <p className="font-semibold text-foreground mb-1">Efeito das correções aplicadas</p>
      <p className="text-foreground/90">
        Nota: <strong className="tabular-nums">{delta.notaAntes} → {delta.notaDepois}</strong> <span className="tabular-nums">({seta}{Math.abs(dNota)})</span>
        {'  ·  '}Apontamentos: <strong className="tabular-nums">{delta.qtdAntes} → {delta.qtdDepois}</strong>
      </p>
      {!melhorou && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Os ajustes pontuais (gramática, citações, redação) foram salvos, mas não elevaram a nota: os apontamentos restantes
          são de <strong>fundo</strong> — coerência, profundidade ou suporte das fontes — e não se resolvem trocando frases.
          Reveja no Editor ou regenere as seções marcadas. A re-análise é uma nova leitura do revisor, então a lista pode variar.
        </p>
      )}
    </div>
  )
}

export function AdvancedReview({ trabalhoId, trabalho, tipo, tema, area, normas, idioma = 'pt-BR' }: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('inicial')
  const [analise, setAnalise] = useState<ReviewResult | null>(null)
  // Delta da última rodada de correção (antes → depois), para mostrar o efeito
  // real em vez de o usuário comparar duas listas independentes na cabeça.
  const [delta, setDelta] = useState<{ notaAntes: number; notaDepois: number; qtdAntes: number; qtdDepois: number } | null>(null)
  const metadados = { tipo, tema, area, normas, idioma }

  // Problemas que a IA pode tentar corrigir trocando texto (todos, exceto os
  // puramente estruturais, que dependem de reorganizar/criar seções). A correção
  // em si é gerada na hora, seção por seção, pelo endpoint /api/review/corrigir.
  const corrigiveis = (analise?.problemas_encontrados ?? [])
    .filter(p => p.categoria !== 'estrutura')

  async function analisar(texto: string): Promise<ReviewResult | null> {
    if (!texto?.trim()) { toast.error('O trabalho está vazio.'); return null }
    setEstado('analisando')
    try {
      const res = await fetch('/api/review/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...metadados, trabalho: texto, modoCorrecao: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha na revisão.')
      setAnalise(data as ReviewResult)
      setEstado('resultado')
      return data as ReviewResult
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao revisar.')
      setEstado(analise ? 'resultado' : 'inicial')
      return null
    }
  }

  async function aplicarCorrecoes() {
    // Descreve cada problema (com o trecho exato, quando houver) para o revisor
    // localizar e corrigir. A correção surgical é gerada no servidor.
    const problemas = corrigiveis.map(p => {
      const partes = [`${CATEGORIA_ROTULO[p.categoria] ?? p.categoria} [${p.gravidade}]: ${p.problema}`]
      if (p.trecho?.trim()) partes.push(`Trecho: "${p.trecho.trim()}"`)
      if (p.sugestao?.trim()) partes.push(`Sugestão: ${p.sugestao.trim()}`)
      return partes.join(' — ')
    })
    if (problemas.length === 0) {
      toast.warning('Os problemas apontados são estruturais — exigem ajuste manual no Editor.')
      return
    }
    setEstado('aplicando')
    try {
      const res = await fetch('/api/review/corrigir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, problemas }),
      })
      const data = await res.json() as {
        ok?: boolean; totalAplicadas?: number; secoesAfetadas?: number; corpoAtualizado?: string; error?: string
        diagnostico?: { geradas: number; inseguras: number; naoCasaram: number }
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Falha ao aplicar correções.')
      if (!data.totalAplicadas) {
        const d = data.diagnostico
        let msg = 'Estes problemas precisam de ajuste manual no Editor.'
        if (d) {
          if (d.geradas === 0) msg = 'A IA não encontrou trechos pontuais para corrigir — os problemas parecem estruturais. Ajuste no Editor.'
          else if (d.naoCasaram > 0) msg = `A IA propôs ${d.naoCasaram} correção(ões), mas o texto exato não foi localizado nas seções. Reanalise ou ajuste no Editor.`
          else if (d.inseguras > 0) msg = `${d.inseguras} correção(ões) foram bloqueadas pela trava anti-invenção (evitam citações inventadas).`
        }
        toast.warning(msg)
        setEstado('resultado')
        return
      }
      const antes = analise
      toast.success(`Apliquei ${data.totalAplicadas} ajuste(s) em ${data.secoesAfetadas} seção(ões)${data.totalAplicadas > problemas.length ? ' (alguns problemas exigiram mais de uma troca)' : ''}. Re-avaliando…`)
      router.refresh() // o editor/seções refletem a correção salva
      const depois = await analisar(data.corpoAtualizado ?? trabalho) // re-avalia com o texto corrigido
      if (antes && depois) {
        setDelta({
          notaAntes: antes.nota_estimada, notaDepois: depois.nota_estimada,
          qtdAntes: antes.problemas_encontrados.length, qtdDepois: depois.problemas_encontrados.length,
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aplicar correções.')
      setEstado('resultado')
    }
  }

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Revisão Avançada por IA
        </CardTitle>
        <CardDescription>
          Um revisor acadêmico (modelo dedicado) audita o trabalho, aponta os erros e aplica as correções
          possíveis direto nas seções — sem inventar dados nem reescrever o trabalho do zero.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 1. INICIAL */}
        {estado === 'inicial' && (
          <Button onClick={() => { setDelta(null); analisar(trabalho) }} className="gap-2">
            <Sparkles className="h-4 w-4" /> Executar Revisão Avançada
          </Button>
        )}

        {/* 2/4. ANALISANDO / APLICANDO */}
        {(estado === 'analisando' || estado === 'aplicando') && (
          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>{estado === 'analisando' ? 'Analisando o trabalho…' : 'Aplicando as correções nas seções…'}</span>
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

            {delta && <DeltaCorrecao delta={delta} />}

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

            {/* Ações */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {corrigiveis.length > 0 ? (
                <Button onClick={aplicarCorrecoes} className="gap-2">
                  <Wand2 className="h-4 w-4" /> Corrigir {corrigiveis.length} problema{corrigiveis.length === 1 ? '' : 's'} no trabalho
                </Button>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <PencilLine className="h-4 w-4" /> Os problemas apontados são estruturais — ajuste manual no Editor.
                </p>
              )}
              <Button variant="outline" onClick={() => { setEstado('inicial'); setAnalise(null); setDelta(null) }}>Fechar</Button>
            </div>
            {corrigiveis.length > 0 && (
              <p className="text-xs text-muted-foreground">
                A IA gera correções cirúrgicas seção por seção, com trava anti-piora (não inventa dados, não reescreve do zero),
                salva direto nas seções e re-avalia. Itens estruturais ficam na lista acima para ajuste no Editor.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
