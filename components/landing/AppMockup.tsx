'use client'

import { CheckCircle2, Sparkles } from 'lucide-react'

const SECOES = [
  { nome: 'Capa e Resumo',        done: true  },
  { nome: 'Introdução',            done: true  },
  { nome: 'Referencial Teórico',  done: true  },
  { nome: 'Metodologia',           done: false, active: true },
  { nome: 'Resultados',            done: false },
  { nome: 'Discussão',             done: false },
  { nome: 'Conclusão',             done: false },
  { nome: 'Referências',           done: false },
]

export function AppMockup() {
  return (
    <div className="relative w-full select-none">
      {/* Glow atrás do frame */}
      <div className="absolute -inset-6 bg-gradient-to-br from-teal-500/20 via-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl pointer-events-none" />

      {/* Frame do browser */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200/80 ring-1 ring-black/5">

        {/* Chrome bar */}
        <div className="bg-[#f0f0f0] px-4 py-2.5 flex items-center gap-3 border-b border-gray-300/60">
          <div className="flex gap-1.5 shrink-0">
            <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <div className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-[11px] text-gray-400 font-mono border border-gray-200 max-w-[260px] mx-auto text-center truncate">
            app.cientifica.ai/editor
          </div>
          <div className="w-14 shrink-0" />
        </div>

        {/* App UI — dark theme */}
        <div className="bg-[#0a1628] h-[400px] flex text-white overflow-hidden">

          {/* Sidebar */}
          <div className="w-44 bg-[#0d1e35] border-r border-white/[0.07] flex flex-col shrink-0">
            <div className="p-3 border-b border-white/[0.07]">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2 truncate">
                TCC — IA na Educação
              </p>
              {/* Barra de progresso */}
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
                  style={{ width: '43%' }}
                />
              </div>
              <p className="text-[9px] text-teal-400 mt-1">43% concluído · 4/8</p>
            </div>

            <div className="flex-1 p-2 space-y-0.5 overflow-hidden">
              {SECOES.map(({ nome, done, active }) => (
                <div
                  key={nome}
                  className={[
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] leading-tight',
                    active ? 'bg-teal-500/15 text-teal-300' : '',
                    done && !active ? 'text-white/55' : '',
                    !done && !active ? 'text-white/25' : '',
                  ].join(' ')}
                >
                  {done ? (
                    <CheckCircle2 className="h-2.5 w-2.5 text-teal-500 shrink-0" />
                  ) : active ? (
                    <div className="h-2.5 w-2.5 rounded-full border-2 border-teal-400 shrink-0 animate-pulse" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full border border-white/15 shrink-0" />
                  )}
                  <span className="truncate">{nome}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Área do editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header da seção */}
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between shrink-0">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-teal-400">Metodologia</p>
                <p className="text-xs font-semibold text-white/90">Materiais e Métodos</p>
              </div>
              <div className="flex items-center gap-1.5 bg-teal-500 px-2.5 py-1.5 rounded-lg">
                <Sparkles className="h-3 w-3 text-white" />
                <span className="text-[10px] text-white font-semibold">Gerar com IA</span>
              </div>
            </div>

            {/* Score strip */}
            <div className="mx-4 mt-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 flex items-center gap-3 shrink-0">
              {/* Círculo SVG */}
              <div className="relative h-12 w-12 shrink-0">
                <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15" fill="none"
                    stroke="#2dd4bf" strokeWidth="3"
                    strokeDasharray="78 94" strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-teal-400 leading-none">83</span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                  <span className="text-[9px] bg-red-900/40 text-red-400 border border-red-900/50 rounded px-1.5 py-0.5 font-medium">2 críticos</span>
                  <span className="text-[9px] bg-yellow-900/40 text-yellow-400 border border-yellow-900/50 rounded px-1.5 py-0.5 font-medium">3 importantes</span>
                  <span className="text-[9px] bg-teal-900/40 text-teal-400 border border-teal-900/50 rounded px-1.5 py-0.5 font-medium">5 OK</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-[83%] bg-gradient-to-r from-teal-500 to-teal-400 rounded-full" />
                </div>
              </div>
            </div>

            {/* Texto simulado */}
            <div className="flex-1 px-4 py-3 overflow-hidden">
              <div className="space-y-2">
                {[100, 92, 100, 78, 100, 88, 70, 95, 65].map((w, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full ${i < 5 ? 'bg-white/[0.13]' : 'bg-white/[0.07]'}`}
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
              {/* Cursor piscando */}
              <div className="mt-2 flex items-center">
                <div className="h-2 rounded-full bg-white/[0.13]" style={{ width: '37%' }} />
                <div className="h-4 w-0.5 bg-teal-400 ml-1 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
