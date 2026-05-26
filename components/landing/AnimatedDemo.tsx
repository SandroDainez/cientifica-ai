'use client'

import { useState, useEffect } from 'react'
import {
  GraduationCap, FileText, BookOpen, Award,
  CheckCircle2, Sparkles, Download, Presentation,
  AlertCircle, AlertTriangle, Play, Pause,
} from 'lucide-react'

const DURATION = 5000   // ms por slide
const TICK     = 60     // ms por tick de progresso
const SLIDE_COUNT = 4

// ── Slide 1 — Escolher tipo de trabalho ──────────────────────────
function Slide1() {
  const tipos = [
    { icon: GraduationCap, label: 'TCC',          sub: '8 seções',    selected: true  },
    { icon: FileText,      label: 'Artigo',        sub: '6 seções',    selected: false },
    { icon: BookOpen,      label: 'Dissertação',   sub: '10 seções',   selected: false },
    { icon: Award,         label: 'Tese',           sub: '12 seções',   selected: false },
  ]
  return (
    <div className="p-5 space-y-4 h-full flex flex-col">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-0.5">Passo 1 de 4</p>
        <h3 className="text-white font-bold text-base leading-snug">Escolha o tipo de trabalho</h3>
        <p className="text-[11px] text-white/40 mt-0.5">Selecione e configure em menos de 2 minutos</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 flex-1">
        {tipos.map(({ icon: Icon, label, sub, selected }) => (
          <div
            key={label}
            className={[
              'flex flex-col gap-2 p-3 rounded-xl border transition-all',
              selected
                ? 'border-teal-500 bg-teal-500/15 shadow-lg shadow-teal-500/20'
                : 'border-white/10 bg-white/[0.04]',
            ].join(' ')}
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${selected ? 'bg-teal-500' : 'bg-white/10'}`}>
              <Icon className={`h-4 w-4 ${selected ? 'text-white' : 'text-white/40'}`} />
            </div>
            <div>
              <p className={`text-xs font-semibold leading-none ${selected ? 'text-white' : 'text-white/55'}`}>{label}</p>
              <p className={`text-[9px] mt-0.5 ${selected ? 'text-teal-400' : 'text-white/25'}`}>{sub}</p>
            </div>
            {selected && (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                <span className="text-[9px] text-teal-400 font-medium">Selecionado</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2.5">
          <p className="text-[9px] text-white/35 mb-0.5">Tema do trabalho</p>
          <p className="text-[11px] text-white font-medium">Impacto da IA na Educação Superior</p>
        </div>
        <div className="bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <p className="text-[9px] text-white/35 mb-0.5">Norma de citação</p>
            <p className="text-[11px] text-white font-medium">ABNT NBR 6023</p>
          </div>
          <span className="text-[9px] bg-teal-900/50 text-teal-400 border border-teal-900/60 rounded px-1.5 py-0.5">Padrão</span>
        </div>
      </div>
    </div>
  )
}

// ── Slide 2 — IA gerando conteúdo ────────────────────────────────
function Slide2() {
  return (
    <div className="p-5 space-y-4 h-full flex flex-col">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-0.5">Passo 2 de 4</p>
        <h3 className="text-white font-bold text-base leading-snug">IA escreve seção por seção</h3>
        <p className="text-[11px] text-white/40 mt-0.5">Rascunho completo com instruções detalhadas</p>
      </div>

      {/* Instrução */}
      <div className="bg-teal-950/60 border border-teal-900/60 rounded-xl p-3">
        <p className="text-[9px] text-teal-400 font-bold uppercase tracking-wider mb-1">💡 Instrução da seção</p>
        <p className="text-[10px] text-teal-200/70 leading-relaxed">
          Descreva o delineamento do estudo, população-alvo, critérios de inclusão/exclusão e instrumentos de coleta de dados utilizados.
        </p>
      </div>

      {/* Bloco de geração */}
      <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-white">Científica AI</p>
            <p className="text-[9px] text-white/40">Gerando Metodologia...</p>
          </div>
          {/* Dots animados */}
          <div className="flex gap-1 mr-1">
            {[0, 150, 300].map(delay => (
              <div
                key={delay}
                className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5 flex-1">
          {[100, 88, 100, 76, 95, 80, 100, 60].map((w, i) => (
            <div
              key={i}
              className="h-2 rounded-full bg-white/[0.12] animate-pulse"
              style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
            />
          ))}
          <div className="flex items-center mt-1">
            <div className="h-2 rounded-full bg-white/[0.12]" style={{ width: '38%' }} />
            <div className="h-4 w-0.5 bg-teal-400 ml-1 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Slide 3 — Score de validação ─────────────────────────────────
function Slide3() {
  const issues = [
    { Icon: AlertCircle,   color: 'text-red-400',    bg: 'bg-red-950/50 border-red-900/50',    text: 'Tamanho da amostra não justificado' },
    { Icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-950/50 border-yellow-900/50', text: 'Ausência de critérios de exclusão' },
    { Icon: CheckCircle2,  color: 'text-teal-400',   bg: 'bg-teal-950/40 border-teal-900/50',  text: 'Delineamento metodológico adequado' },
  ]
  return (
    <div className="p-5 space-y-4 h-full flex flex-col">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-0.5">Passo 3 de 4</p>
        <h3 className="text-white font-bold text-base leading-snug">Validação automática com score</h3>
        <p className="text-[11px] text-white/40 mt-0.5">A IA analisa e pontua cada seção de 0 a 100</p>
      </div>

      {/* Score visual */}
      <div className="flex items-center gap-5 bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke="#2dd4bf" strokeWidth="3"
              strokeDasharray="78 94" strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-teal-400 leading-none">83</span>
            <span className="text-[9px] text-white/35">/100</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-[10px] font-medium">
            <span className="text-red-400">2 críticos</span>
            <span className="text-yellow-400">3 importantes</span>
            <span className="text-teal-400">5 OK</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-[83%] bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" />
          </div>
          <p className="text-[9px] text-white/35">Qualidade boa — corrija 2 pontos críticos</p>
        </div>
      </div>

      {/* Issues */}
      <div className="flex-1 space-y-2">
        {issues.map(({ Icon, color, bg, text }) => (
          <div key={text} className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-[11px] ${bg}`}>
            <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
            <span className="text-white/75 leading-snug">{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slide 4 — Exportar ───────────────────────────────────────────
function Slide4() {
  return (
    <div className="p-5 space-y-4 h-full flex flex-col">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400 mb-0.5">Passo 4 de 4</p>
        <h3 className="text-white font-bold text-base leading-snug">Exporte o trabalho completo</h3>
        <p className="text-[11px] text-white/40 mt-0.5">Word formatado ABNT ou slides para defesa</p>
      </div>

      {/* Progresso geral */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-white/50">Progresso do trabalho</p>
          <span className="text-[10px] font-bold text-teal-400">8/8 seções</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full" />
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <CheckCircle2 key={i} className="h-3.5 w-3.5 text-teal-500" />
          ))}
        </div>
      </div>

      {/* Opções de exportação */}
      <div className="flex-1 space-y-2.5">
        <div className="bg-white/[0.06] border border-teal-500/40 rounded-xl p-3.5 flex items-center gap-3.5 ring-1 ring-teal-500/20">
          <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-white">Word (.docx)</p>
            <p className="text-[10px] text-white/45 mt-0.5">Formatação ABNT completa · margens corretas</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
            <Download className="h-3.5 w-3.5 text-white" />
          </div>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-orange-600 flex items-center justify-center shrink-0">
            <Presentation className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-white/75">PowerPoint (.pptx)</p>
            <p className="text-[10px] text-white/35 mt-0.5">Slides prontos para apresentação e defesa</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Download className="h-3.5 w-3.5 text-white/50" />
          </div>
        </div>
      </div>

      <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl py-2.5 text-center">
        <p className="text-xs text-teal-300 font-medium">✨ Acesso permanente ao documento</p>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────
const SLIDE_LABELS = [
  'Criar trabalho',
  'IA gera conteúdo',
  'Validar score',
  'Exportar',
]

const SLIDES = [<Slide1 key="s1" />, <Slide2 key="s2" />, <Slide3 key="s3" />, <Slide4 key="s4" />]

export function AnimatedDemo() {
  const [current, setCurrent]   = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying]   = useState(true)

  // Reinicia timer sempre que o slide muda ou o play/pause muda
  useEffect(() => {
    if (!playing) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0)
    let p = 0
    const step = 100 / (DURATION / TICK)

    const progressId = setInterval(() => {
      p = Math.min(p + step, 100)
      setProgress(p)
    }, TICK)

    const slideId = setTimeout(() => {
      setCurrent(prev => (prev + 1) % SLIDE_COUNT)
    }, DURATION)

    return () => {
      clearInterval(progressId)
      clearTimeout(slideId)
    }
  }, [current, playing])

  function goTo(i: number) {
    setCurrent(i)
    setProgress(0)
  }

  // Progresso global 0-100 considerando slide atual + progresso dentro do slide
  const globalProgress = ((current + progress / 100) / SLIDE_COUNT) * 100

  return (
    <div className="relative max-w-md mx-auto select-none">
      {/* Glow */}
      <div className="absolute -inset-6 bg-gradient-to-br from-teal-500/15 via-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl pointer-events-none" />

      {/* Container estilo player */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/[0.12]">

        {/* Barra de título */}
        <div className="bg-[#0d1b2a] border-b border-white/[0.07] px-4 py-2 flex items-center gap-3">
          <div className="flex gap-1.5 shrink-0">
            {['bg-white/15', 'bg-white/15', 'bg-white/15'].map((c, i) => (
              <div key={i} className={`h-2 w-2 rounded-full ${c}`} />
            ))}
          </div>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-white/35 font-medium tracking-wide">
              Demo interativo · Científica AI
            </p>
          </div>
          <div className="w-12 shrink-0" />
        </div>

        {/* Slides — altura fixa para não pular */}
        <div className="bg-[#0a1628] h-[380px] relative overflow-hidden">
          {SLIDES.map((slide, i) => (
            <div
              key={i}
              className="absolute inset-0 transition-all duration-500 ease-in-out overflow-y-auto"
              style={{
                opacity: i === current ? 1 : 0,
                transform: i === current
                  ? 'translateX(0)'
                  : i < current ? 'translateX(-24px)' : 'translateX(24px)',
                pointerEvents: i === current ? 'auto' : 'none',
              }}
            >
              {slide}
            </div>
          ))}
        </div>

        {/* Barra de controles */}
        <div className="bg-[#0d1b2a] border-t border-white/[0.07] px-4 pt-3 pb-3.5 space-y-2.5">
          {/* Barra de progresso global */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-[width] duration-75"
              style={{ width: `${globalProgress}%` }}
            />
          </div>

          {/* Controles */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying(v => !v)}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
              aria-label={playing ? 'Pausar' : 'Retomar'}
            >
              {playing
                ? <Pause className="h-3.5 w-3.5 text-white" />
                : <Play  className="h-3.5 w-3.5 text-white ml-0.5" />
              }
            </button>

            <div className="flex-1 flex gap-1.5">
              {SLIDE_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={[
                    'flex-1 py-1 rounded-md text-[9px] font-medium transition-colors truncate px-0.5',
                    i === current
                      ? 'bg-teal-500/20 text-teal-300'
                      : 'text-white/30 hover:text-white/55',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
