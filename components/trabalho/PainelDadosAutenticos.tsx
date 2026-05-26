'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  BarChart2, BookOpen, FlaskConical, Lightbulb, Users, FileText,
  Loader2, Sparkles, CheckCircle2, ArrowRight, ChevronLeft, X, DatabaseZap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import type { DadosProjeto, FaseConfig } from '@/types'
import type { ClassificacaoDado, ResultadoClassificacao } from '@/app/api/ia/classificar-dados/route'

// ── Labels dos campos ─────────────────────────────────────────────────────────
const CAMPOS_LABEL: Record<string, { label: string; descricao: string; icone: React.ComponentType<{ className?: string }> }> = {
  notas_contexto:      { label: 'Contexto / Justificativa',    descricao: 'Alimenta Introdução e Justificativa', icone: BookOpen },
  notas_metodologia:   { label: 'Notas de Metodologia',        descricao: 'Alimenta Metodologia e Métodos',      icone: FlaskConical },
  dados_coletados:     { label: 'Dados Coletados',             descricao: 'Alimenta Resultados',                 icone: BarChart2 },
  notas_interpretacao: { label: 'Interpretação / Discussão',   descricao: 'Alimenta Discussão e Conclusão',      icone: Lightbulb },
  n_participantes:     { label: 'N.º de Participantes',        descricao: 'Campo de Metodologia',                icone: Users },
  software_analise:    { label: 'Software de Análise',         descricao: 'Campo de Metodologia',                icone: FileText },
  taxa_resposta:       { label: 'Taxa de Resposta',            descricao: 'Campo de Resultados',                 icone: BarChart2 },
}

const RELEVANCIA_STYLE: Record<string, string> = {
  alta:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  media: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  baixa: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700',
}

const RELEVANCIA_LABEL: Record<string, string> = {
  alta: 'Alta relevância', media: 'Relevância média', baixa: 'Baixa relevância',
}

// ── Exemplos de dados que o usuário pode colar ────────────────────────────────
const EXEMPLOS = [
  'Estatísticas coletadas na pesquisa (frequências, percentuais, médias)',
  'Dados de participantes: n.º de casos, perfil demográfico, taxa de adesão',
  'Notas de como a coleta foi realizada (instrumentos, protocolo)',
  'Trechos relevantes de artigos pagos ou fontes acadêmicas',
  'Interpretações e impressões sobre os achados',
  'Dados contextuais ou epidemiológicos para embasar a justificativa',
]

// ── Props ────────────────────────────────────────────────────────────────────
interface PainelDadosAutenticosProps {
  trabalhoId: string
  dadosProjeto: DadosProjeto | null | undefined
  fases: FaseConfig[]
  isOpen: boolean
  onClose: () => void
  onIrParaSecao: (chaveSecao: string) => void
}

type Step = 'input' | 'analyzing' | 'results' | 'saving' | 'success'

interface SalvoInfo {
  campo: string
  secoes: string[]
  chaveSecaoPrincipal?: string
}

// ── Componente ────────────────────────────────────────────────────────────────
export function PainelDadosAutenticos({
  trabalhoId,
  dadosProjeto,
  fases,
  isOpen,
  onClose,
  onIrParaSecao,
}: PainelDadosAutenticosProps) {
  const [step, setStep] = useState<Step>('input')
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState<ResultadoClassificacao | null>(null)
  const [salvoInfo, setSalvoInfo] = useState<SalvoInfo | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function resetar() {
    setStep('input')
    setTexto('')
    setResultado(null)
    setSalvoInfo(null)
    setErro(null)
  }

  function handleFechar() {
    onClose()
    // Reset delayed to avoid flash during close animation
    setTimeout(resetar, 300)
  }

  // ── Analisar dados com IA ──────────────────────────────────────────────────
  async function handleAnalisar() {
    if (!texto.trim() || texto.trim().length < 15) {
      setErro('Cole ao menos algumas frases para que a IA possa analisar.')
      return
    }
    setErro(null)
    setStep('analyzing')

    try {
      const res = await fetch('/api/ia/classificar-dados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, texto }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao analisar')
      setResultado(json as ResultadoClassificacao)
      setStep('results')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.')
      setStep('input')
    }
  }

  // ── Salvar dado no campo correto ──────────────────────────────────────────
  async function handleSalvar(classificacao: ClassificacaoDado, irParaSecao = false) {
    setStep('saving')

    try {
      // Monta dados_projeto atualizado: appenda ao campo existente
      const dpAtual = dadosProjeto ?? ({} as DadosProjeto)
      const valorAtual = (dpAtual[classificacao.campo as keyof DadosProjeto] as string) ?? ''
      const separador = valorAtual.trim() ? '\n\n---\n\n' : ''
      const novoValor = valorAtual + separador + texto.trim()

      const dpAtualizado = {
        ...dpAtual,
        [classificacao.campo]: novoValor,
        confirmado: dpAtual.confirmado ?? false,
        criado_em: dpAtual.criado_em ?? new Date().toISOString(),
      }

      const res = await fetch(`/api/trabalhos/${trabalhoId}/projeto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dados_projeto: dpAtualizado }),
      })

      if (!res.ok) throw new Error('Falha ao salvar os dados')

      const campoInfo = CAMPOS_LABEL[classificacao.campo]
      setSalvoInfo({
        campo: campoInfo?.label ?? classificacao.campo,
        secoes: classificacao.secoes_nomes,
        chaveSecaoPrincipal: classificacao.secoes_alvo[0],
      })
      setStep('success')

      toast.success(`Dados salvos em "${campoInfo?.label ?? classificacao.campo}"!`, {
        description: 'Vá para a seção e clique em "Gerar com IA" para incorporar.',
      })

      if (irParaSecao && classificacao.secoes_alvo[0]) {
        // Pequeno delay para o user ver o toast antes de navegar
        setTimeout(() => {
          onIrParaSecao(classificacao.secoes_alvo[0])
          handleFechar()
        }, 800)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
      setStep('results')
    }
  }

  // ── Verifica se a seção alvo existe no trabalho ────────────────────────────
  function secaoExisteNoTrabalho(chaveSecao: string): FaseConfig | undefined {
    return fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleFechar() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950">
                <DatabaseZap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <DialogTitle>Dados Autênticos</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Cole seus dados de pesquisa — a IA identifica onde incorporar
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={handleFechar}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="mt-2">
          {/* ── Step: Input ──────────────────────────────────────── */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20 px-4 py-3">
                <p className="text-xs font-semibold text-violet-800 dark:text-violet-300 mb-2">Exemplos do que você pode colar:</p>
                <ul className="space-y-1">
                  {EXEMPLOS.map((ex, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-violet-700 dark:text-violet-400">
                      <span className="mt-0.5 shrink-0 text-violet-400">›</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Cole aqui seus dados de pesquisa
                </label>
                <textarea
                  value={texto}
                  onChange={e => { setTexto(e.target.value); setErro(null) }}
                  placeholder="Cole qualquer texto, estatística, achado, nota metodológica ou trecho de referência aqui. A IA vai identificar automaticamente onde esse dado deve ser inserido no seu trabalho..."
                  className={cn(
                    'w-full min-h-[180px] resize-y rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
                    erro ? 'border-destructive focus:ring-destructive/20' : 'border-input'
                  )}
                />
                {erro && <p className="text-xs text-destructive">{erro}</p>}
                <p className="text-xs text-muted-foreground">
                  {texto.length > 0 ? `${texto.length} caracteres` : 'Máximo: 3000 caracteres por análise'}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleFechar}>Cancelar</Button>
                <Button
                  onClick={handleAnalisar}
                  disabled={texto.trim().length < 15}
                  className="gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Analisar com IA
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Analyzing ──────────────────────────────────── */}
          {step === 'analyzing' && (
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="h-14 w-14 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <Loader2 className="h-5 w-5 text-violet-500 animate-spin absolute -top-1 -right-1" />
              </div>
              <div>
                <p className="font-medium text-foreground">Analisando seus dados...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA está identificando o tipo e a seção correta
                </p>
              </div>
            </div>
          )}

          {/* ── Step: Results ─────────────────────────────────────── */}
          {step === 'results' && resultado && (
            <div className="space-y-4">
              {/* Resumo do tipo */}
              <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Análise da IA</p>
                  <p className="text-sm text-muted-foreground">{resultado.resumo_tipo}</p>
                </div>
              </div>

              {/* Classificações */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {resultado.classificacoes.length === 1
                    ? 'Destino identificado:'
                    : `${resultado.classificacoes.length} destinos identificados:`}
                </p>

                {resultado.classificacoes.map((c, i) => {
                  const info = CAMPOS_LABEL[c.campo]
                  const Icone = info?.icone ?? DatabaseZap
                  const fasePrincipal = c.secoes_alvo[0] ? secaoExisteNoTrabalho(c.secoes_alvo[0]) : undefined

                  return (
                    <div
                      key={i}
                      className="rounded-xl border bg-card p-4 space-y-3 shadow-xs"
                    >
                      {/* Cabeçalho do card */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-lg bg-muted shrink-0 mt-0.5">
                            <Icone className="h-3.5 w-3.5 text-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{info?.label ?? c.campo}</p>
                            <p className="text-xs text-muted-foreground">{info?.descricao}</p>
                          </div>
                        </div>
                        <span className={cn(
                          'shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border',
                          RELEVANCIA_STYLE[c.relevancia]
                        )}>
                          {RELEVANCIA_LABEL[c.relevancia]}
                        </span>
                      </div>

                      {/* Seções alvo */}
                      <div className="flex flex-wrap gap-1.5">
                        {c.secoes_nomes.map((nome, j) => (
                          <span key={j} className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                            {nome}
                          </span>
                        ))}
                      </div>

                      {/* Raciocínio da IA */}
                      <p className="text-xs text-muted-foreground border-l-2 border-border pl-2.5">
                        {c.razao}
                      </p>

                      {/* Trecho resumido */}
                      {c.trecho_resumido && (
                        <p className="text-xs text-foreground/70 font-mono bg-muted rounded px-2 py-1 truncate">
                          &quot;{c.trecho_resumido}&quot;
                        </p>
                      )}

                      {/* Ações */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleSalvar(c, false)}
                          className="gap-1.5 flex-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Salvar neste campo
                        </Button>
                        {fasePrincipal && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSalvar(c, true)}
                            className="gap-1.5 flex-1"
                            title={`Salva e navega para "${fasePrincipal.nome}"`}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            Salvar e ir para {fasePrincipal.nome}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Voltar */}
              <div className="flex justify-start pt-1">
                <button
                  onClick={() => setStep('input')}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Editar texto
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Saving ─────────────────────────────────────── */}
          {step === 'saving' && (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
              <p className="font-medium text-foreground">Salvando seus dados...</p>
            </div>
          )}

          {/* ── Step: Success ─────────────────────────────────────── */}
          {step === 'success' && salvoInfo && (
            <div className="py-6 flex flex-col items-center gap-5 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-lg">Dados salvos com sucesso!</p>
                <p className="text-sm text-muted-foreground">
                  Adicionados ao campo <strong className="text-foreground">{salvoInfo.campo}</strong>
                </p>
                {salvoInfo.secoes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Quando você gerar ou regenerar{' '}
                    <strong className="text-foreground">{salvoInfo.secoes.join(', ')}</strong>,
                    a IA incorporará esses dados automaticamente.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={resetar}
                >
                  <DatabaseZap className="h-3.5 w-3.5" />
                  Adicionar mais dados
                </Button>
                {salvoInfo.chaveSecaoPrincipal && (
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      onIrParaSecao(salvoInfo.chaveSecaoPrincipal!)
                      handleFechar()
                    }}
                  >
                    Ir para a seção
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {!salvoInfo.chaveSecaoPrincipal && (
                <Button variant="outline" onClick={handleFechar}>Fechar</Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
