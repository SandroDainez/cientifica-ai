'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sparkles, Loader2, CheckCircle2, XCircle, FileWarning,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
// import type → NÃO bundla o código server (openai/process.env) no cliente.
import type { ReviewResult, ReviewProblema } from '@/lib/ai/reviewService'
import { filtrarApontamentos } from '@/lib/revisao/filtrar-apontamentos'

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

type Estado = 'inicial' | 'analisando' | 'resultado' | 'aplicando' | 'revisando'

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

// Sinais de que uma referência é OFF-TOPIC (não pertence ao trabalho) — mesmo quando
// o revisor a rotula como "corrigir_contexto" em vez de "remover".
const OFF_TOPIC = /n[ãa]o (se )?relacion|n[ãa]o tem rela|outro tema|tema (completamente )?diferente|n[ãa]o pertence|fora do (tema|escopo)|sem rela[çc][ãa]o com o tema|assunto diferente|n[ãa]o se relaciona diretamente/i
// Citação órfã: mencionada no texto mas SEM referência correspondente na lista.
const ORFA = /n[ãa]o (est[áa]|presente|consta|aparece) (n[ao]s? )?(refer|lista)|mencionada no texto mas n[ãa]o/i

/** Referências/citações a ELIMINAR: "remover", off-topic, ou citação órfã (sem ref). */
function listaRemover(a: ReviewResult): string[] {
  return (a.referencias_suspeitas ?? [])
    .filter(r => {
      const p = r.problema ?? ''
      if (r.acao_recomendada === 'remover') return true
      if (OFF_TOPIC.test(p)) return true     // off-topic, qualquer que seja o rótulo
      if (ORFA.test(p)) return true          // citação sem referência → tirar
      return false
    })
    .map(r => `${r.referencia}${r.problema ? ` — ${r.problema}` : ''}`)
}

/** Normaliza a resposta da revisão: garante TODOS os campos para o render nunca quebrar. */
function normalizarResultado(data: unknown): ReviewResult {
  const r = (data ?? {}) as Partial<ReviewResult>
  const c = (r.checklist ?? {}) as Partial<ReviewResult['checklist']>
  return {
    nota_estimada: typeof r.nota_estimada === 'number' ? r.nota_estimada : 0,
    status: r.status ?? 'precisa_corrigir',
    resumo_geral: typeof r.resumo_geral === 'string' ? r.resumo_geral : '',
    checklist: {
      coerencia_objetivos: !!c.coerencia_objetivos,
      linguagem_adequada: !!c.linguagem_adequada,
      estrutura_completa: !!c.estrutura_completa,
      citacoes_com_suporte: !!c.citacoes_com_suporte,
      referencias_verificadas: !!c.referencias_verificadas,
      sem_contradicoes: !!c.sem_contradicoes,
    },
    // Trava determinística: descarta falsos-positivos de formatação da lista de
    // referências (negrito do periódico = destaque obrigatório da norma, NÃO é erro).
    problemas_encontrados: filtrarApontamentos(Array.isArray(r.problemas_encontrados) ? r.problemas_encontrados : []),
    referencias_suspeitas: Array.isArray(r.referencias_suspeitas) ? r.referencias_suspeitas : [],
    precisa_nova_iteracao: !!r.precisa_nova_iteracao,
    motivo_nova_iteracao: typeof r.motivo_nova_iteracao === 'string' ? r.motivo_nova_iteracao : '',
    versao_corrigida: typeof r.versao_corrigida === 'string' ? r.versao_corrigida : '',
  }
}

/** Descreve um problema (com trecho/sugestão) para o revisor localizar e corrigir. */
function descreverProblema(p: ReviewProblema): string {
  const partes = [`${CATEGORIA_ROTULO[p.categoria] ?? p.categoria} [${p.gravidade}]: ${p.problema}`]
  if (p.trecho?.trim()) partes.push(`Trecho: "${p.trecho.trim()}"`)
  if (p.sugestao?.trim()) partes.push(`Sugestão: ${p.sugestao.trim()}`)
  return partes.join(' — ')
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

function NotaGrande({ nota }: { nota: number }) {
  return (
    <div className="flex flex-col items-center justify-center text-center max-w-[150px]">
      <span className={cn('text-6xl font-bold tabular-nums', corNota(nota))}>{nota}</span>
      <span className="text-xs font-medium text-muted-foreground mt-1">Indicador de qualidade (IA)</span>
      <span className="text-[10px] text-muted-foreground/80 leading-tight mt-0.5">estimativa 0–100 — NÃO é nota de banca</span>
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
          As correções <strong>foram aplicadas e salvas no texto</strong>. A nota é uma <strong>estimativa</strong> do revisor que
          oscila a cada leitura (ele sempre acha novos detalhes), então pode não subir mesmo com o texto melhor — confie no texto e
          na lista de problemas, não no número. Os apontamentos que sobram costumam ser de fundo (profundidade, suporte das fontes).
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
        body: JSON.stringify({ ...metadados, trabalho: texto, modoCorrecao: false, trabalhoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha na revisão.')
      const safe = normalizarResultado(data)   // nunca deixa campo faltando → não quebra a tela
      setAnalise(safe)
      setEstado('resultado')
      return safe
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao revisar.')
      setEstado(analise ? 'resultado' : 'inicial')
      return null
    }
  }

  // Corrige os problemas. PRIMÁRIO: aplica a correção EXATA que o revisor entrega
  // (trecho→correcao) de forma determinística — agora com casamento robusto (aspas/
  // espaços), e a trava permite REMOVER citação errada. FALLBACK: para problemas
  // sem correção pronta, manda reescrever a seção em modo "mudança mínima".
  async function aplicarCorrecoesExatas(probs: ReviewProblema[]): Promise<{ totalAplicadas: number; corpo?: string }> {
    const comCorrecao = probs.filter(p => (p.trecho?.trim().length ?? 0) >= 3 && typeof p.correcao === 'string')
    const semCorrecao = probs.filter(p => p.categoria !== 'estrutura' && !((p.trecho?.trim().length ?? 0) >= 3 && typeof p.correcao === 'string'))
    let totalAplicadas = 0
    let corpo: string | undefined

    if (comCorrecao.length > 0) {
      const correcoes = comCorrecao.map(p => ({ trecho: p.trecho, correcao: p.correcao ?? '' }))
      const res = await fetch('/api/review/aplicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trabalhoId, correcoes }) })
      const data = await res.json() as { ok?: boolean; totalAplicadas?: number; corpoAtualizado?: string }
      if (res.ok && data.ok) { totalAplicadas += data.totalAplicadas ?? 0; corpo = data.corpoAtualizado ?? corpo }
    }
    // Fallback (reescrita mínima) só p/ o que não veio com correção pronta.
    if (semCorrecao.length > 0) {
      const remover = analise ? listaRemover(analise) : []
      const res = await fetch('/api/review/revisar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trabalhoId, problemas: semCorrecao.map(descreverProblema), remover }) })
      const data = await res.json() as { ok?: boolean; secoesRevisadas?: number; corpoAtualizado?: string }
      if (res.ok && data.ok) { totalAplicadas += data.secoesRevisadas ?? 0; corpo = data.corpoAtualizado ?? corpo }
    }
    return { totalAplicadas, corpo }
  }

  // LIMPEZA DETERMINÍSTICA: remove por código as referências marcadas "remover"
  // (off-topic) e suas citações — inclusive em grupo. Não depende do modelo.
  async function passadaLimpeza(remover: string[]): Promise<{ refsRemovidas: number; corpoAtualizado?: string } | null> {
    if (remover.length === 0) return { refsRemovidas: 0 }
    const res = await fetch('/api/review/limpar-suspeitas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trabalhoId, remover }),
    })
    const data = await res.json() as { ok?: boolean; itensRemovidos?: number; corpoAtualizado?: string; error?: string }
    if (!res.ok || !data.ok) { toast.error(data.error ?? 'Falha ao remover referências.'); return null }
    return { refsRemovidas: data.itensRemovidos ?? 0, corpoAtualizado: data.corpoAtualizado }
  }

  // COERÊNCIA GLOBAL: alinha intro↔objetivos↔resultados↔conclusão (só ajusta o
  // enquadramento p/ casar com os fatos). Retorna o resultado ou null em erro.
  async function passadaCoerencia(): Promise<{ ajustesAplicados: number; corpoAtualizado?: string } | null> {
    const res = await fetch('/api/review/coerencia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trabalhoId }),
    })
    const data = await res.json() as { ok?: boolean; ajustesAplicados?: number; corpoAtualizado?: string; error?: string }
    if (!res.ok || !data.ok) { toast.error(data.error ?? 'Falha na coerência global.'); return null }
    return { ajustesAplicados: data.ajustesAplicados ?? 0, corpoAtualizado: data.corpoAtualizado }
  }

  // REVISÃO FINAL COMPLETA (orquestrada): vê tudo → pesquisa/acrescenta fontes →
  // reescreve → revisa de novo → repete até atingir a meta, parar de melhorar ou
  // bater o teto de passadas. Cada passada tem as travas do servidor.
  async function revisaoFinalCompleta() {
    const MAX_PASSADAS = 3
    setEstado('revisando')
    try {
      let atual = analise ?? await analisar(trabalho)
      if (!atual) { setEstado(analise ? 'resultado' : 'inicial'); return }
      const notaInicial = atual.nota_estimada
      const qtdInicial = atual.problemas_encontrados.length

      // Passo 0: remove DETERMINISTICAMENTE as referências off-topic ("remover").
      const removerLista = listaRemover(atual)
      if (removerLista.length > 0) {
        setEstado('revisando')
        toast.message(`Removendo ${removerLista.length} referência(s) que não pertencem ao trabalho…`)
        const limpo = await passadaLimpeza(removerLista)
        if (limpo && limpo.refsRemovidas > 0) {
          const nova = await analisar(limpo.corpoAtualizado ?? trabalho)
          if (nova) atual = nova
        }
      }

      let passada = 0
      while (passada < MAX_PASSADAS) {
        if (atual.problemas_encontrados.length === 0) break
        setEstado('revisando')
        toast.message(`Passada ${passada + 1}: aplicando as correções exatas do revisor…`)
        // Aplica a correção EXATA de cada problema (trecho→correcao) — cirúrgico,
        // sem regenerar a seção (não reintroduz os mesmos padrões = sem esteira).
        const { totalAplicadas, corpo } = await aplicarCorrecoesExatas(atual.problemas_encontrados)
        if (totalAplicadas === 0) {
          toast.message('Sem novas correções pontuais a aplicar — encerrando os ajustes.')
          break
        }
        const nova = await analisar(corpo ?? trabalho)
        if (!nova) break
        passada++
        const melhorou = nova.problemas_encontrados.length < atual.problemas_encontrados.length || nova.nota_estimada > atual.nota_estimada
        atual = nova
        if (!melhorou) break // não oscila: para se uma passada não reduz problemas
      }

      // Passo final: COERÊNCIA GLOBAL (alinha intro↔objetivos↔resultados↔conclusão).
      setEstado('revisando')
      toast.message('Alinhando a coerência global do trabalho…')
      const coOut = await passadaCoerencia()
      if (coOut && coOut.ajustesAplicados > 0) {
        const nova = await analisar(coOut.corpoAtualizado ?? trabalho)
        if (nova) atual = nova
      }

      router.refresh() // UMA recarga só, no fim — evita o "sumir e voltar" das seções
      setDelta({
        notaAntes: notaInicial, notaDepois: atual.nota_estimada,
        qtdAntes: qtdInicial, qtdDepois: atual.problemas_encontrados.length,
      })
      setEstado('resultado')
      toast.success(`Revisão final concluída em ${passada} passada(s). Nota ${notaInicial} → ${atual.nota_estimada}.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro na revisão final.')
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
          A nota é um <strong>indicador de qualidade gerado por IA</strong>, para orientação — <strong>não substitui a avaliação da banca</strong>.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 1. INICIAL */}
        {estado === 'inicial' && (
          <Button onClick={() => { setDelta(null); analisar(trabalho) }} className="gap-2">
            <Sparkles className="h-4 w-4" /> Executar Revisão Avançada
          </Button>
        )}

        {/* 2/4. ANALISANDO / APLICANDO / REVISANDO */}
        {(estado === 'analisando' || estado === 'aplicando' || estado === 'revisando') && (
          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>
              {estado === 'analisando' ? 'Analisando o trabalho…'
                : estado === 'aplicando' ? 'Aplicando as correções nas seções…'
                : 'Reescrevendo e aprofundando as seções com base nas fontes reais… (pode levar 1–2 min)'}
            </span>
          </div>
        )}

        {/* 3. RESULTADO */}
        {estado === 'resultado' && analise && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <NotaGrande nota={analise.nota_estimada} />
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

            {/* Ação única — faz tudo */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button onClick={revisaoFinalCompleta} className="gap-2">
                <Sparkles className="h-4 w-4" /> Corrigir o trabalho
              </Button>
              <Button variant="ghost" onClick={() => { setEstado('inicial'); setAnalise(null); setDelta(null) }}>Fechar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Corrigir o trabalho</strong> faz tudo de uma vez: <strong>remove</strong> o que não serve (refs off-topic,
              citações órfãs), aplica a <strong>correção exata</strong> de cada problema reescrevendo a frase para manter o sentido
              (não deixa buraco nem afirmação sem apoio), <strong>alinha a coerência</strong> entre as seções e repete até estabilizar.
              <strong> Nunca inventa</strong> dados/citações e guarda a versão anterior de cada seção (restaurável no histórico do Editor).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
