'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles, CheckCircle2, Lightbulb, Save,
  Loader2, ChevronRight, AlignLeft, MousePointerClick,
  PenLine, AlertTriangle, XCircle, Trophy, ArrowRight,
  BookOpen, Target, ListChecks,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ValidadorSecao } from './ValidadorSecao'
import type { FaseConfig, ResultadoValidacao } from '@/types'

export type StatusIA = 'idle' | 'gerando' | 'validando' | 'sugerindo' | 'salvando'

interface EditorAreaProps {
  fase: FaseConfig
  conteudo: string
  onConteudoChange: (v: string) => void
  onGerar: () => void
  onValidar: () => void
  onSalvar: (avancar?: boolean) => void
  onAbrirIA: () => void
  statusIA: StatusIA
  validacao: ResultadoValidacao | null
  onAplicarSugestao: (id: string) => void
  iaPanelOpen: boolean
  isUltimaFase: boolean
  /** Opções de título extraídas da resposta da IA — mostra picker em vez de markdown bruto */
  tituloOpcoes?: string[]
  onSelecionarTituloOpcao?: (opcao: string) => void
}

// ── Helpers de qualidade ──────────────────────────────────────────────────────

function avaliarPalavas(palavras: number, min?: number, max?: number) {
  if (!min && !max) return 'ok'
  if (max && palavras > max) return 'excedido'
  if (min && palavras >= min) return 'ok'
  if (min && palavras >= Math.floor(min * 0.7)) return 'quase'
  return 'insuficiente'
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-500'
}

function scoreBg(score: number) {
  if (score >= 80) return 'bg-green-50 border-green-200'
  if (score >= 60) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EditorArea({
  fase, conteudo, onConteudoChange,
  onGerar, onValidar, onSalvar, onAbrirIA,
  statusIA, validacao, onAplicarSugestao,
  iaPanelOpen, isUltimaFase,
  tituloOpcoes = [], onSelecionarTituloOpcao,
}: EditorAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Estado local da UX
  const [mostraIntro, setMostraIntro] = useState(true)
  const [confirmandoAvanco, setConfirmandoAvanco] = useState(false)

  const palavras = conteudo.trim() ? conteudo.trim().split(/\s+/).length : 0
  const statusPalavras = avaliarPalavas(palavras, fase.min_palavras, fase.max_palavras)
  const temConteudo = conteudo.trim().length > 0
  const busy = statusIA !== 'idle'

  // Esconde o card intro assim que o usuário começa a escrever ou gerar
  useEffect(() => {
    if (temConteudo || statusIA === 'gerando') setMostraIntro(false)
  }, [temConteudo, statusIA])

  // Ao trocar de seção (fase.chave_secao muda), reconfigura o estado local
  useEffect(() => {
    setConfirmandoAvanco(false)
    setMostraIntro(!temConteudo)
    ultimoConteudoValidado.current = ''
    if (autoReviewTimer.current) clearTimeout(autoReviewTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase.chave_secao])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 280)}px`
  }, [conteudo])

  // Auto-save com debounce (3s após parar de digitar)
  useEffect(() => {
    if (!conteudo.trim() || statusIA !== 'idle') return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { onSalvar(false) }, 3000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudo])

  // Auto-revisão silenciosa: 25s após o usuário parar de editar (mín. 100 palavras, não validado recentemente)
  const autoReviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimoConteudoValidado = useRef<string>('')
  useEffect(() => {
    if (autoReviewTimer.current) clearTimeout(autoReviewTimer.current)
    const palavrasAtual = conteudo.trim().split(/\s+/).length
    if (!conteudo.trim() || statusIA !== 'idle' || palavrasAtual < 100) return
    // Só roda se o conteúdo mudou desde a última validação
    if (conteudo === ultimoConteudoValidado.current) return
    autoReviewTimer.current = setTimeout(() => {
      ultimoConteudoValidado.current = conteudo
      onValidar()
    }, 25000)
    return () => { if (autoReviewTimer.current) clearTimeout(autoReviewTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudo])

  // Atalhos de teclado: Ctrl+S → salvar, Ctrl+G → gerar com IA
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault()
        if (conteudo.trim() && statusIA === 'idle') {
          onSalvar(false)
          toast.success('Rascunho salvo', { duration: 2000 })
        }
      }
      if (e.key === 'g') { e.preventDefault(); if (statusIA === 'idle') onGerar() }
    }
  }, [conteudo, statusIA, onSalvar, onGerar])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Clique em "Concluir e avançar" ──────────────────────────────────────────
  function handleClickAvancar() {
    // Não mostra confirmação na última fase — vai para exportar direto
    if (isUltimaFase) { onSalvar(true); return }
    setConfirmandoAvanco(true)
  }

  function confirmarAvanco() {
    setConfirmandoAvanco(false)
    onSalvar(true)
  }

  // ── Indicador visual do botão "Concluir" ────────────────────────────────────
  const avancoStyle = (() => {
    if (!temConteudo) return 'default'
    if (validacao && validacao.score >= 80) return 'aprovado'
    if (validacao && validacao.score >= 60) return 'atencao'
    if (validacao && validacao.score < 60) return 'revisar'
    return 'pendente' // tem conteudo mas nao validou
  })()

  return (
    <div className="flex-1 min-w-0 space-y-4">

      {/* ── Cabeçalho da fase ────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <AlignLeft className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{fase.nome}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{fase.descricao}</p>
              {(fase.min_palavras || fase.max_palavras) && temConteudo && (
                <p className={cn(
                  'text-xs mt-1 font-medium',
                  statusPalavras === 'excedido' ? 'text-red-500' :
                  statusPalavras === 'ok'       ? 'text-green-600' :
                  statusPalavras === 'quase'    ? 'text-yellow-600' :
                  'text-muted-foreground'
                )}>
                  {palavras} palavras
                  {fase.min_palavras && fase.max_palavras
                    ? ` (recomendado: ${fase.min_palavras}–${fase.max_palavras})`
                    : fase.min_palavras ? ` (mín: ${fase.min_palavras})`
                    : ` (máx: ${fase.max_palavras})`}
                  {statusPalavras === 'quase' && ' — quase lá!'}
                  {statusPalavras === 'excedido' && ' — acima do recomendado'}
                </p>
              )}
            </div>
          </div>

          {/* Toolbar ações IA */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button onClick={onGerar} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {statusIA === 'gerando'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Gerar com IA</>}
            </button>

            <button onClick={onValidar} disabled={busy || !temConteudo}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                !validacao
                  ? 'border-border text-muted-foreground hover:bg-accent'
                  : validacao.score >= 80
                  ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                  : validacao.score >= 60
                  ? 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                  : 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100'
              )}>
              {statusIA === 'validando'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Validando…</>
                : validacao
                ? <><CheckCircle2 className="h-3.5 w-3.5" /> {validacao.score}/100</>
                : <><CheckCircle2 className="h-3.5 w-3.5" /> Validar</>}
            </button>

            {!iaPanelOpen && (
              <button onClick={onAbrirIA}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
                <Lightbulb className="h-3.5 w-3.5" /> Dicas IA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Card de boas-vindas (seção em branco) ───────────────────── */}
      {mostraIntro && !temConteudo && statusIA !== 'gerando' && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">
                {fase.nome}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {fase.instrucoes}
              </p>
            </div>
          </div>

          {/* Elementos obrigatórios */}
          {fase.elementos_obrigatorios?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
                <ListChecks className="h-3.5 w-3.5 text-primary" />
                Esta seção deve conter:
              </div>
              <ul className="space-y-1">
                {fase.elementos_obrigatorios.slice(0, 5).map((el, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 h-4 w-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    {el}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Objetivo e extensão */}
          {(fase.min_palavras || fase.max_palavras) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/60 rounded-lg px-3 py-2">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <span>
                Extensão recomendada:{' '}
                <strong className="text-foreground">
                  {fase.min_palavras && fase.max_palavras
                    ? `${fase.min_palavras}–${fase.max_palavras} palavras`
                    : fase.min_palavras
                    ? `mínimo ${fase.min_palavras} palavras`
                    : `máximo ${fase.max_palavras} palavras`}
                </strong>
              </span>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setMostraIntro(false); onGerar() }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
              <Sparkles className="h-4 w-4" />
              Gerar com IA
              <span className="text-xs opacity-75 font-normal">(recomendado)</span>
            </button>
            <button onClick={() => { setMostraIntro(false); setTimeout(() => textareaRef.current?.focus(), 50) }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <PenLine className="h-4 w-4" />
              Escrever por conta própria
            </button>
          </div>
        </div>
      )}

      {/* ── Picker de opções de título ───────────────────────────────── */}
      {tituloOpcoes.length > 0 && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <MousePointerClick className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                A IA sugeriu {tituloOpcoes.length} opções de título
              </p>
              <p className="text-xs text-muted-foreground">Clique em uma para usá-la, ou escreva diretamente abaixo</p>
            </div>
          </div>
          <div className="space-y-2">
            {tituloOpcoes.map((opcao, i) => (
              <button key={i} onClick={() => onSelecionarTituloOpcao?.(opcao)}
                className="w-full text-left px-4 py-3 rounded-lg border-2 border-transparent hover:border-primary/50 bg-muted/40 hover:bg-primary/5 transition-all group">
                <span className="text-xs font-semibold text-muted-foreground mb-1 block">Opção {i + 1}</span>
                <span className="text-sm text-foreground group-hover:text-primary transition-colors leading-snug">{opcao}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Área de texto ────────────────────────────────────────────── */}
      <div className={cn(
        'bg-card border rounded-xl overflow-hidden transition-all',
        !temConteudo && mostraIntro ? 'opacity-0 h-0 pointer-events-none' : 'opacity-100'
      )}>
        <textarea
          ref={textareaRef}
          value={conteudo}
          onChange={e => onConteudoChange(e.target.value)}
          placeholder={`Escreva aqui o conteúdo de "${fase.nome}"…`}
          disabled={statusIA === 'gerando'}
          className="w-full resize-none p-5 text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-70 bg-transparent"
          style={{ minHeight: 280 }}
        />
      </div>

      {/* ── Resultado de validação ───────────────────────────────────── */}
      {validacao && (
        <div className="bg-card border rounded-xl p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Resultado da validação</p>
          <ValidadorSecao resultado={validacao} onAplicarSugestao={onAplicarSugestao} />
        </div>
      )}

      {/* ── Painel de confirmação de avanço ─────────────────────────── */}
      {confirmandoAvanco && (
        <div className={cn(
          'border-2 rounded-xl p-5 space-y-4',
          avancoStyle === 'aprovado' ? 'border-green-300 bg-green-50' :
          avancoStyle === 'atencao'  ? 'border-yellow-300 bg-yellow-50' :
          avancoStyle === 'revisar'  ? 'border-red-300 bg-red-50' :
          'border-primary/30 bg-primary/5'
        )}>
          {/* Ícone e título conforme qualidade */}
          <div className="flex items-start gap-3">
            {avancoStyle === 'aprovado' && <Trophy className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />}
            {avancoStyle === 'atencao'  && <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0 mt-0.5" />}
            {avancoStyle === 'revisar'  && <XCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />}
            {avancoStyle === 'pendente' && <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />}

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">
                {avancoStyle === 'aprovado' && 'Excelente! Esta seção está ótima.'}
                {avancoStyle === 'atencao'  && 'Esta seção pode melhorar um pouco.'}
                {avancoStyle === 'revisar'  && 'Esta seção precisa de atenção antes de avançar.'}
                {avancoStyle === 'pendente' && 'Você ainda não validou esta seção.'}
              </p>

              {/* Checklist de qualidade */}
              <div className="mt-3 space-y-1.5">
                {/* Palavras */}
                <div className="flex items-center gap-2 text-xs">
                  {statusPalavras === 'ok'
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    : statusPalavras === 'quase'
                    ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span className={cn(
                    statusPalavras === 'ok' ? 'text-green-700' :
                    statusPalavras === 'quase' ? 'text-yellow-700' : 'text-red-600'
                  )}>
                    {palavras} palavras
                    {fase.min_palavras && ` (recomendado: ${fase.min_palavras}${fase.max_palavras ? `–${fase.max_palavras}` : '+'})`}
                  </span>
                </div>

                {/* Validação */}
                {validacao ? (
                  <div className="flex items-center gap-2 text-xs">
                    {validacao.score >= 80
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      : validacao.score >= 60
                      ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className={cn('font-medium', scoreColor(validacao.score))}>
                      Qualidade: {validacao.score}/100 — {validacao.score >= 80 ? 'Ótimo' : validacao.score >= 60 ? 'Razoável' : 'Abaixo do esperado'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    Seção não validada — recomendamos validar antes de avançar
                  </div>
                )}
              </div>

              {/* Mensagem personalizada por estado */}
              {avancoStyle === 'revisar' && (
                <p className="mt-2 text-xs text-red-600 leading-relaxed">
                  Há pontos críticos a corrigir. Clique em "Revisar seção" para ver as sugestões da IA, ou avance mesmo assim se preferir corrigir depois.
                </p>
              )}
              {avancoStyle === 'pendente' && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Validar a seção garante que você cobriu todos os elementos obrigatórios e que o texto está adequado. É rápido e vale a pena!
                </p>
              )}
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-2 pt-1">
            {avancoStyle !== 'aprovado' && (
              <button
                onClick={() => { setConfirmandoAvanco(false); onValidar() }}
                disabled={busy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <CheckCircle2 className="h-4 w-4" /> Validar esta seção
              </button>
            )}
            <button
              onClick={confirmarAvanco}
              disabled={busy}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                avancoStyle === 'aprovado'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}>
              {avancoStyle === 'aprovado'
                ? <><Trophy className="h-4 w-4" /> Avançar para a próxima seção</>
                : <>Avançar assim mesmo <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
            <button
              onClick={() => setConfirmandoAvanco(false)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Ações de rodapé ─────────────────────────────────────────── */}
      {!confirmandoAvanco && (
        <div className="flex items-center justify-between gap-3 pb-6">
          <button
            onClick={() => onSalvar(false)}
            disabled={busy || !temConteudo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {statusIA === 'salvando'
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
              : <><Save className="h-3.5 w-3.5" /> Salvar rascunho</>}
          </button>

          <button
            onClick={handleClickAvancar}
            disabled={busy || !temConteudo}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              avancoStyle === 'aprovado'
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200'
                : avancoStyle === 'atencao'
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : avancoStyle === 'revisar'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}>
            {isUltimaFase ? (
              <><Trophy className="h-4 w-4" /> Concluir trabalho</>
            ) : avancoStyle === 'aprovado' ? (
              <><CheckCircle2 className="h-4 w-4" /> Seção aprovada — avançar</>
            ) : (
              <>
                {isUltimaFase ? 'Concluir trabalho' : 'Concluir e avançar'}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
