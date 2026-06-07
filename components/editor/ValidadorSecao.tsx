'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Lightbulb, Sparkles, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResultadoValidacao, SugestaoIA } from '@/types'

interface ValidadorSecaoProps {
  resultado: ResultadoValidacao
  onAplicarSugestao?: (id: string) => void
  /** Quando fornecido, habilita o botão "Aplicar com IA" que reescreve o texto */
  onAplicarComIA?: (sugestao: SugestaoIA) => Promise<void>
  /** chave_secao atual — usada para classificar sugestões e redirecionamentos */
  chaveSecao?: string
}

/**
 * Classifica uma sugestão: nem toda sugestão é segura para "Aplicar com IA".
 * Expandir extensão (gera enchimento), completar referência (risco de inventar)
 * e conteúdo que pertence a OUTRA seção devem ser revisados manualmente.
 */
function classificarSugestao(s: SugestaoIA, chaveSecao?: string): { autoAplicavel: boolean; aviso?: string } {
  const txt = `${s.titulo} ${s.descricao}`.toLowerCase()
  const ehMetodologia = /metodolog|busca|estrategia/.test(chaveSecao ?? '')

  if (!ehMetodologia && /(estrat[ée]gia de busca|bases de dados|crit[ée]rios de inclus|descritores|protocolo prisma|prisma)/.test(txt)) {
    return { autoAplicavel: false, aviso: 'Isto pertence à seção "Metodologia da Busca" — faça lá, não nesta seção.' }
  }
  // Só EXPANSÃO é arriscada (gera enchimento). Reduzir/compactar é seguro.
  if (/(expand|aprofund|aumente|amplie|mais palavras|texto mais longo|extens[ãa]o insuficiente|insuficiente|abaixo do esperado|abaixo do recomendado|inclua mais|adicione mais)/.test(txt)) {
    return { autoAplicavel: false, aviso: 'Aplicar automaticamente tende a gerar enchimento e baixar a qualidade. Expanda você mesmo com conteúdo real, ou regenere a seção.' }
  }
  if (/(refer[êe]ncia incompleta|complete a refer|complementar a refer|dados da refer|t[íi]tulo, peri[óo]dico)/.test(txt)) {
    return { autoAplicavel: false, aviso: 'A IA não deve inventar dados da referência. Complete no painel de Referências (busca automática) ou manualmente.' }
  }
  return { autoAplicavel: true }
}

export function ValidadorSecao({ resultado, onAplicarSugestao, onAplicarComIA, chaveSecao }: ValidadorSecaoProps) {
  const scoreColor =
    resultado.score >= 80 ? 'text-green-600' :
    resultado.score >= 60 ? 'text-yellow-500' :
    'text-red-500'

  const scoreBg =
    resultado.score >= 80 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' :
    resultado.score >= 60 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800' :
    'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'

  return (
    <div className="space-y-3">
      {/* Score + status */}
      <div className={cn('rounded-xl border p-4 flex items-center gap-4', scoreBg)}>
        <div className="text-center shrink-0 w-14">
          <p className={cn('text-3xl font-bold tabular-nums', scoreColor)}>{resultado.score}</p>
          <p className="text-[10px] text-muted-foreground">/100</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {resultado.aprovado
              ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            }
            <span className="text-sm font-semibold">
              {resultado.score >= 80 ? 'Excelente — pronto para avançar' :
               resultado.score >= 60 ? 'Bom — pequenos ajustes recomendados' :
               resultado.score >= 40 ? 'Razoável — revisão necessária' :
               'Requer reescrita significativa'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{resultado.comentarios}</p>
        </div>
      </div>

      {/* Sugestões */}
      {resultado.sugestoes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Sugestões da IA
          </p>
          {resultado.sugestoes.map(s => (
            <SugestaoCard
              key={s.id}
              sugestao={s}
              onMarcar={onAplicarSugestao}
              onAplicarComIA={onAplicarComIA}
              chaveSecao={chaveSecao}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SugestaoCard({
  sugestao,
  onMarcar,
  onAplicarComIA,
  chaveSecao,
}: {
  sugestao: SugestaoIA
  onMarcar?: (id: string) => void
  onAplicarComIA?: (sugestao: SugestaoIA) => Promise<void>
  chaveSecao?: string
}) {
  const [aplicando, setAplicando] = useState(false)
  const [forcar, setForcar] = useState(false)
  const { autoAplicavel, aviso } = classificarSugestao(sugestao, chaveSecao)

  const { icon: Icon, color, bg } = {
    critico:    { icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' },
    importante: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800' },
    sugestao:   { icon: Lightbulb,     color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' },
  }[sugestao.tipo]

  async function handleAplicarComIA() {
    if (!onAplicarComIA || aplicando) return
    setAplicando(true)
    try {
      await onAplicarComIA(sugestao)
      onMarcar?.(sugestao.id)
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', bg, sugestao.aplicado && 'opacity-50')}>
      <div className="flex items-start gap-2">
        <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', color)} />
        <p className="text-xs font-semibold text-foreground">{sugestao.titulo}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-5">{sugestao.descricao}</p>

      {/* Aviso para sugestões que NÃO devem ser aplicadas automaticamente */}
      {!sugestao.aplicado && !autoAplicavel && aviso && (
        <div className="ml-5 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-2 py-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-snug">
            <span className="font-semibold">Revisar manualmente.</span> {aviso}
          </p>
        </div>
      )}

      {!sugestao.aplicado && (
        <div className="flex items-center gap-2 pl-5">
          {/* Aplicar com IA — só destacado quando é seguro aplicar */}
          {onAplicarComIA && autoAplicavel && (
            <button
              onClick={handleAplicarComIA}
              disabled={aplicando}
              className={cn(
                'inline-flex items-center gap-1 text-xs rounded px-2 py-1 font-medium transition-all',
                'bg-primary text-primary-foreground hover:opacity-90',
                aplicando && 'opacity-60 cursor-not-allowed'
              )}
            >
              {aplicando
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Aplicando...</>
                : <><Sparkles className="h-3 w-3" /> Aplicar com IA</>
              }
            </button>
          )}
          {/* Sugestão de risco: aplicar fica como ação secundária discreta */}
          {onAplicarComIA && !autoAplicavel && (
            forcar ? (
              <button
                onClick={handleAplicarComIA}
                disabled={aplicando}
                className={cn(
                  'inline-flex items-center gap-1 text-xs rounded px-2 py-1 font-medium transition-all',
                  'border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30',
                  aplicando && 'opacity-60 cursor-not-allowed'
                )}
              >
                {aplicando
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Aplicando...</>
                  : <><Sparkles className="h-3 w-3" /> Aplicar mesmo assim</>
                }
              </button>
            ) : (
              <button
                onClick={() => setForcar(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Aplicar mesmo assim
              </button>
            )
          )}
          {/* Marcar como aplicado manualmente */}
          {onMarcar && (
            <button
              onClick={() => onMarcar(sugestao.id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="h-3 w-3" /> Já apliquei
            </button>
          )}
        </div>
      )}

      {sugestao.aplicado && (
        <p className="pl-5 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Check className="h-3 w-3" /> Aplicado
        </p>
      )}
    </div>
  )
}
