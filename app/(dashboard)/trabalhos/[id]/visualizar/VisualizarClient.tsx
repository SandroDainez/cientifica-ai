'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, PencilLine, BookMarked, ChevronRight, List, Shield, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { RelatorioQualidade } from '@/components/visualizacao/RelatorioQualidade'
import { ChecklistFinal } from '@/components/visualizacao/ChecklistFinal'
import type { Trabalho, SecaoTrabalho, Referencia } from '@/types'

interface Props {
  trabalho: Trabalho
  secoes: SecaoTrabalho[]
  referencias: Referencia[]
  autorNome?: string
  autorInstituicao?: string
}

export function VisualizarClient({ trabalho, secoes, referencias, autorNome, autorInstituicao }: Props) {
  const [tocAberto, setTocAberto] = useState(false)
  const [checklistAberto, setChecklistAberto] = useState(false)
  const [relatorioAberto, setRelatorioAberto] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  function imprimir() {
    window.print()
  }

  function irPara(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTocAberto(false)
  }

  const anoAtual = new Date().getFullYear()
  const secoesComConteudo = secoes.filter(s => s.conteudo?.trim())

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barra de controle */}
      <div className="no-print sticky top-16 z-20 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href={`/trabalhos/${trabalho.id}/editar`}
            className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-sm')}>
            <ArrowLeft className="h-4 w-4" /> Editor
          </Link>

          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground truncate">
              {trabalho.titulo || 'Sem título'} · {getTipoLabel(trabalho.tipo_trabalho)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTocAberto(v => !v); setChecklistAberto(false) }}
              className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-sm')}
            >
              <List className="h-4 w-4" /> Sumário
            </button>
            <button
              onClick={() => { setChecklistAberto(v => !v); setTocAberto(false) }}
              className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-sm')}
            >
              <ClipboardCheck className="h-4 w-4" /> Checklist
            </button>
            <Link href={`/trabalhos/${trabalho.id}/referencias`}
              className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-sm')}>
              <BookMarked className="h-4 w-4" /> Refs
            </Link>
            <button
              onClick={() => setRelatorioAberto(true)}
              className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-sm')}
            >
              <Shield className="h-4 w-4" /> Qualidade
            </button>
            <Link href={`/trabalhos/${trabalho.id}/editar`}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 text-sm')}>
              <PencilLine className="h-4 w-4" /> Editar
            </Link>
            <button onClick={imprimir}
              className={cn(buttonVariants(), 'gap-2 text-sm')}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>
        </div>

        {/* Sumário dropdown */}
        {tocAberto && (
          <div className="no-print border-t bg-white shadow-md max-w-5xl mx-auto">
            <nav className="px-4 py-3 space-y-0.5 max-h-72 overflow-y-auto">
              <button onClick={() => irPara('capa')}
                className="w-full text-left text-sm py-1.5 px-3 rounded-lg hover:bg-gray-50 flex items-center gap-2 font-medium">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> Capa
              </button>
              {secoesComConteudo.map((s, i) => (
                <button key={s.id} onClick={() => irPara(`secao-${s.chave_secao}`)}
                  className="w-full text-left text-sm py-1.5 px-3 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                  {s.nome_secao}
                </button>
              ))}
              {referencias.length > 0 && (
                <button onClick={() => irPara('referencias')}
                  className="w-full text-left text-sm py-1.5 px-3 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> Referências
                </button>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Checklist dropdown */}
      {checklistAberto && (
        <div className="no-print border-t bg-gray-50 shadow-md max-w-5xl mx-auto">
          <div className="px-4 py-4 max-w-lg">
            <ChecklistFinal
              titulo={trabalho.titulo ?? undefined}
              secoes={secoes}
              referencias={referencias}
            />
          </div>
        </div>
      )}

      {/* Documento */}
      <div ref={contentRef} className="max-w-4xl mx-auto py-8 px-4 space-y-0">

        {/* ── Capa ──────────────────────────────────────────── */}
        <section id="capa" className="doc-page bg-white shadow-sm rounded-t-lg px-16 py-20 min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 border border-b-0">
          {autorInstituicao && (
            <p className="doc-content text-sm font-medium uppercase tracking-widest text-gray-500">
              {autorInstituicao}
            </p>
          )}

          <div className="space-y-3 my-8">
            <p className="doc-content text-xs uppercase tracking-widest text-gray-400">
              {getTipoLabel(trabalho.tipo_trabalho)}
            </p>
            <h1 className="doc-content text-2xl font-bold text-gray-900 leading-tight" style={{ textIndent: 0 }}>
              {trabalho.titulo || 'Título do Trabalho'}
            </h1>
          </div>

          {autorNome && (
            <p className="doc-content text-base text-gray-700" style={{ textIndent: 0 }}>
              {autorNome}
            </p>
          )}

          {trabalho.orientador && (
            <div className="space-y-1">
              <p className="doc-content text-sm text-gray-500" style={{ textIndent: 0 }}>Orientador(a):</p>
              <p className="doc-content text-sm text-gray-700" style={{ textIndent: 0 }}>{trabalho.orientador}</p>
            </div>
          )}

          <p className="doc-content text-sm text-gray-500 mt-auto" style={{ textIndent: 0 }}>
            {trabalho.area_conhecimento && `${trabalho.area_conhecimento} · `}{anoAtual}
          </p>
        </section>

        {/* ── Sumário ──────────────────────────────────────── */}
        {secoesComConteudo.length > 0 && (
          <section className="doc-page bg-white shadow-sm px-16 py-12 border border-y-0">
            <h2 className="doc-content text-lg font-bold uppercase tracking-widest text-center mb-8"
              style={{ textIndent: 0, fontFamily: 'inherit' }}>
              SUMÁRIO
            </h2>
            <div className="space-y-2">
              {secoesComConteudo.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => irPara(`secao-${s.chave_secao}`)}
                  className="no-print w-full flex items-center justify-between py-1 border-b border-dotted border-gray-300 hover:text-primary transition-colors group"
                >
                  <span className="doc-content text-sm flex items-center gap-2" style={{ textIndent: 0 }}>
                    <span className="text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                    <span className="ml-3 group-hover:underline">{s.nome_secao.toUpperCase()}</span>
                  </span>
                  <span className="doc-content text-sm text-gray-400" style={{ textIndent: 0 }}>
                    ……
                  </span>
                </button>
              ))}
              {referencias.length > 0 && (
                <button
                  onClick={() => irPara('referencias')}
                  className="no-print w-full flex items-center justify-between py-1 border-b border-dotted border-gray-300 hover:text-primary transition-colors group"
                >
                  <span className="doc-content text-sm flex items-center gap-2" style={{ textIndent: 0 }}>
                    <span className="text-gray-400 w-5 text-right shrink-0">{secoesComConteudo.length + 1}</span>
                    <span className="ml-3 group-hover:underline">REFERÊNCIAS</span>
                  </span>
                  <span className="doc-content text-sm text-gray-400" style={{ textIndent: 0 }}>……</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Seções ────────────────────────────────────────── */}
        {secoesComConteudo.map((secao, i) => (
          <section
            key={secao.id}
            id={`secao-${secao.chave_secao}`}
            className="doc-page doc-section-break bg-white shadow-sm px-16 py-12 border border-y-0"
          >
            <h2 className="doc-content font-bold text-base uppercase tracking-wide mb-6"
              style={{ textIndent: 0, fontFamily: 'inherit' }}>
              {i + 1} {secao.nome_secao.toUpperCase()}
            </h2>
            <div className="doc-content">
              {(secao.conteudo ?? '').split('\n').filter(Boolean).map((paragrafo, pi) => (
                <p key={pi}>{paragrafo}</p>
              ))}
            </div>
          </section>
        ))}

        {/* ── Referências ───────────────────────────────────── */}
        {referencias.length > 0 && (
          <section
            id="referencias"
            className="doc-page doc-section-break bg-white shadow-sm rounded-b-lg px-16 py-12 border"
          >
            <h2 className="doc-content font-bold text-base uppercase tracking-wide text-center mb-8"
              style={{ textIndent: 0, fontFamily: 'inherit' }}>
              REFERÊNCIAS
            </h2>
            <div className="space-y-3">
              {referencias.map((ref, i) => (
                <p key={ref.id} className="doc-content text-sm leading-relaxed"
                  style={{ paddingLeft: '2em', textIndent: '-2em' } as React.CSSProperties}>
                  {formatarReferencia(ref, trabalho.formato_citacao).replace(/\*\*/g, '')}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Estado vazio */}
        {secoesComConteudo.length === 0 && (
          <div className="bg-white shadow-sm rounded-xl p-16 text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Nenhuma seção com conteúdo ainda.
            </p>
            <Link href={`/trabalhos/${trabalho.id}/editar`}
              className={cn(buttonVariants(), 'gap-2')}>
              <PencilLine className="h-4 w-4" /> Ir para o editor
            </Link>
          </div>
        )}
      </div>

      {relatorioAberto && (
        <RelatorioQualidade trabalhoId={trabalho.id} onClose={() => setRelatorioAberto(false)} />
      )}
    </div>
  )
}
