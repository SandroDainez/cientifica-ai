'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sparkles, Loader2, CheckCircle2, XCircle, FileWarning, Wand2,
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
        body: JSON.stringify({ ...metadados, trabalho: texto, modoCorrecao: false, trabalhoId }),
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
    const problemas = corrigiveis.map(descreverProblema)
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

  // REVISÃO PROFUNDA: reescreve seção a seção (remove/reescreve/ajusta/aprofunda)
  // ancorado nas fontes reais, com trava anti-fabricação e backup de versão.
  async function revisarProfundo() {
    const problemas = (analise?.problemas_encontrados ?? []).map(descreverProblema)
    const remover = analise ? listaRemover(analise) : []
    setEstado('revisando')
    try {
      const res = await fetch('/api/review/revisar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, problemas, remover }),
      })
      const data = await res.json() as { ok?: boolean; secoesRevisadas?: number; secoesAvaliadas?: number; corpoAtualizado?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Falha na revisão profunda.')
      if (!data.secoesRevisadas) {
        toast.warning('Nenhuma seção pôde ser reescrita com segurança nesta passada (a trava anti-invenção barrou as mudanças).')
        setEstado('resultado')
        return
      }
      const antes = analise
      toast.success(`Reescrevi ${data.secoesRevisadas} de ${data.secoesAvaliadas} seção(ões) com base nas fontes reais. Re-avaliando…`)
      router.refresh()
      const depois = await analisar(data.corpoAtualizado ?? trabalho)
      if (antes && depois) {
        setDelta({
          notaAntes: antes.nota_estimada, notaDepois: depois.nota_estimada,
          qtdAntes: antes.problemas_encontrados.length, qtdDepois: depois.problemas_encontrados.length,
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro na revisão profunda.')
      setEstado('resultado')
    }
  }

  // Uma passada do servidor: pesquisa+acrescenta fontes, reescreve as seções e
  // devolve o corpo. Retorna {secoesRevisadas, corpoAtualizado} ou null em erro.
  async function umaPassadaProfunda(problemas: string[], remover: string[]): Promise<{ secoesRevisadas: number; corpoAtualizado?: string } | null> {
    const res = await fetch('/api/review/revisar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trabalhoId, problemas, remover }),
    })
    const data = await res.json() as { ok?: boolean; secoesRevisadas?: number; corpoAtualizado?: string; error?: string }
    if (!res.ok || !data.ok) { toast.error(data.error ?? 'Falha na revisão.'); return null }
    return { secoesRevisadas: data.secoesRevisadas ?? 0, corpoAtualizado: data.corpoAtualizado }
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

  // Botão standalone: remover referências que não servem.
  async function removerNaoServem() {
    const remover = analise ? listaRemover(analise) : []
    if (remover.length === 0) { toast.message('Nenhuma referência marcada como "remover" nesta análise.'); return }
    setEstado('revisando')
    try {
      const antes = analise
      const out = await passadaLimpeza(remover)
      if (!out) { setEstado('resultado'); return }
      if (out.refsRemovidas === 0) { toast.message('Nada a remover (já saíram ou não localizadas).'); setEstado('resultado'); return }
      toast.success(`${out.refsRemovidas} item(ns) suspeito(s) removido(s) do texto/lista. Re-avaliando…`)
      router.refresh()
      const depois = await analisar(out.corpoAtualizado ?? trabalho)
      if (antes && depois) setDelta({ notaAntes: antes.nota_estimada, notaDepois: depois.nota_estimada, qtdAntes: antes.problemas_encontrados.length, qtdDepois: depois.problemas_encontrados.length })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover referências.')
      setEstado('resultado')
    }
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

  // Botão standalone de coerência global.
  async function coerenciaGlobal() {
    setEstado('revisando')
    try {
      const antes = analise
      toast.message('Alinhando a coerência global do trabalho…')
      const out = await passadaCoerencia()
      if (!out) { setEstado('resultado'); return }
      if (out.ajustesAplicados === 0) {
        toast.success('Trabalho já coerente — nenhum ajuste necessário.')
        setEstado('resultado'); return
      }
      toast.success(`${out.ajustesAplicados} ajuste(s) de coerência aplicado(s). Re-avaliando…`)
      router.refresh()
      const depois = await analisar(out.corpoAtualizado ?? trabalho)
      if (antes && depois) {
        setDelta({ notaAntes: antes.nota_estimada, notaDepois: depois.nota_estimada, qtdAntes: antes.problemas_encontrados.length, qtdDepois: depois.problemas_encontrados.length })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro na coerência global.')
      setEstado('resultado')
    }
  }

  // REVISÃO FINAL COMPLETA (orquestrada): vê tudo → pesquisa/acrescenta fontes →
  // reescreve → revisa de novo → repete até atingir a meta, parar de melhorar ou
  // bater o teto de passadas. Cada passada tem as travas do servidor.
  async function revisaoFinalCompleta() {
    const MAX_PASSADAS = 3
    const META_NOTA = 85
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
          router.refresh()
          const nova = await analisar(limpo.corpoAtualizado ?? trabalho)
          if (nova) atual = nova
        }
      }

      let passada = 0
      while (passada < MAX_PASSADAS) {
        if (atual.nota_estimada >= META_NOTA && atual.problemas_encontrados.length === 0) break
        setEstado('revisando')
        toast.message(`Passada ${passada + 1}: pesquisando fontes, reescrevendo e aprofundando…`)
        const passOut = await umaPassadaProfunda(atual.problemas_encontrados.map(descreverProblema), listaRemover(atual))
        if (!passOut) break
        if (passOut.secoesRevisadas === 0) {
          toast.message('Nada mais pôde ser reescrito com segurança — encerrando.')
          break
        }
        router.refresh()
        const nova = await analisar(passOut.corpoAtualizado ?? trabalho)
        if (!nova) break
        passada++
        const melhorou = nova.nota_estimada > atual.nota_estimada || nova.problemas_encontrados.length < atual.problemas_encontrados.length
        atual = nova
        if (!melhorou) break // não oscila: para se uma passada não melhora
      }

      // Passo final: COERÊNCIA GLOBAL (alinha intro↔objetivos↔resultados↔conclusão).
      setEstado('revisando')
      toast.message('Alinhando a coerência global do trabalho…')
      const coOut = await passadaCoerencia()
      if (coOut && coOut.ajustesAplicados > 0) {
        router.refresh()
        const nova = await analisar(coOut.corpoAtualizado ?? trabalho)
        if (nova) atual = nova
      }

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
              <Button onClick={revisaoFinalCompleta} className="gap-2">
                <Sparkles className="h-4 w-4" /> Revisão final completa
              </Button>
              <Button onClick={revisarProfundo} variant="outline" className="gap-2">
                <Wand2 className="h-4 w-4" /> Só reescrever (1 passada)
              </Button>
              <Button onClick={coerenciaGlobal} variant="outline" className="gap-2">
                <Wand2 className="h-4 w-4" /> Coerência global
              </Button>
              {analise && listaRemover(analise).length > 0 && (
                <Button onClick={removerNaoServem} variant="outline" className="gap-2 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800">
                  <FileWarning className="h-4 w-4" /> Remover {listaRemover(analise).length} item(ns) suspeito(s)
                </Button>
              )}
              {corrigiveis.length > 0 && (
                <Button onClick={aplicarCorrecoes} variant="ghost" className="gap-2 text-muted-foreground">
                  Correção cirúrgica
                </Button>
              )}
              <Button variant="ghost" onClick={() => { setEstado('inicial'); setAnalise(null); setDelta(null) }}>Fechar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Revisão final completa</strong>: o revisor pesquisa e acrescenta fontes reais onde falta, reescreve cada
              seção (remove/ajusta/aprofunda), revisa de novo e repete até o trabalho ficar correto e de bom nível (até 3 passadas;
              leva alguns minutos). <strong>Nunca inventa</strong> dados ou citações (trava anti-fabricação) e guarda a versão
              anterior de cada seção — você pode restaurar pelo histórico no Editor. As demais opções fazem só parte disso.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
