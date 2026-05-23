'use client'

import { useRef, useEffect, useCallback } from 'react'
import {
  Sparkles, CheckCircle2, Lightbulb, Save,
  Loader2, ChevronRight, AlignLeft,
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
}

export function EditorArea({
  fase, conteudo, onConteudoChange,
  onGerar, onValidar, onSalvar, onAbrirIA,
  statusIA, validacao, onAplicarSugestao,
  iaPanelOpen, isUltimaFase,
}: EditorAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const palavras = conteudo.trim() ? conteudo.trim().split(/\s+/).length : 0

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`
  }, [conteudo])

  // Auto-save com debounce (3s após parar de digitar)
  useEffect(() => {
    if (!conteudo.trim() || statusIA !== 'idle') return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      onSalvar(false)
    }, 3000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
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
      if (e.key === 'g') {
        e.preventDefault()
        if (statusIA === 'idle') onGerar()
      }
    }
  }, [conteudo, statusIA, onSalvar, onGerar])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const busy = statusIA !== 'idle'

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Cabeçalho da fase */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <AlignLeft className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{fase.nome}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{fase.descricao}</p>
              {(fase.min_palavras || fase.max_palavras) && (
                <p className={cn(
                  'text-xs mt-1 font-medium',
                  palavras > 0 && fase.max_palavras && palavras > fase.max_palavras ? 'text-red-500' :
                  palavras > 0 && fase.min_palavras && palavras >= fase.min_palavras ? 'text-green-600' :
                  'text-muted-foreground'
                )}>
                  {palavras} palavras
                  {fase.min_palavras && fase.max_palavras
                    ? ` (recomendado: ${fase.min_palavras}–${fase.max_palavras})`
                    : fase.min_palavras
                    ? ` (mín: ${fase.min_palavras})`
                    : ` (máx: ${fase.max_palavras})`}
                </p>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={onGerar}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {statusIA === 'gerando'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Gerar com IA</>
              }
            </button>

            <button
              onClick={onValidar}
              disabled={busy || !conteudo.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {statusIA === 'validando'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Validando…</>
                : <><CheckCircle2 className="h-3.5 w-3.5" /> Validar</>
              }
            </button>

            {!iaPanelOpen && (
              <button
                onClick={onAbrirIA}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                <Lightbulb className="h-3.5 w-3.5" /> Dicas IA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Área de texto */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <textarea
          ref={textareaRef}
          value={conteudo}
          onChange={e => onConteudoChange(e.target.value)}
          placeholder={`Escreva aqui o conteúdo de "${fase.nome}"…\n\nVocê pode:\n• Clicar em "Gerar com IA" para gerar um rascunho\n• Escrever diretamente e depois validar com a IA\n• Usar o painel de Dicas para orientações`}
          disabled={statusIA === 'gerando'}
          className="w-full resize-none p-5 text-sm text-gray-800 leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-70 font-mono"
          style={{ minHeight: 320 }}
        />
      </div>

      {/* Resultado de validação */}
      {validacao && (
        <div className="bg-card border rounded-xl p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Resultado da validação</p>
          <ValidadorSecao resultado={validacao} onAplicarSugestao={onAplicarSugestao} />
        </div>
      )}

      {/* Ações de rodapé */}
      <div className="flex items-center justify-between gap-3 pb-6">
        <button
          onClick={() => onSalvar(false)}
          disabled={busy || !conteudo.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {statusIA === 'salvando'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
            : <><Save className="h-3.5 w-3.5" /> Salvar rascunho</>
          }
        </button>

        <button
          onClick={() => onSalvar(true)}
          disabled={busy || !conteudo.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUltimaFase ? 'Concluir trabalho' : 'Concluir e avançar'}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
