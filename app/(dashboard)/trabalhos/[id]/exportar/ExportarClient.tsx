'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText, Presentation, Printer, Download,
  ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Eye, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import { useReferenceValidator } from '@/hooks/useReferenceValidator'
import { PERIODICOS } from '@/lib/exportacao/periodicos'
import type { Trabalho, Referencia } from '@/types'

interface Props {
  trabalho: Trabalho
  totalFases: number
  secoesComConteudo: number
  referencias?: Referencia[]
}

type ExportStatus = 'idle' | 'loading' | 'done' | 'error'

export function ExportarClient({ trabalho, totalFases, secoesComConteudo, referencias }: Props) {
  const [statusDocx, setStatusDocx] = useState<ExportStatus>('idle')
  const [statusPptx, setStatusPptx] = useState<ExportStatus>('idle')

  // Guard de exportação por referências (passo 11 do briefing). strictMode local
  // (padrão desligado): só bloqueia quando explicitamente ativado e há erro crítico.
  const [strictMode] = useState(false)
  const { canExport } = useReferenceValidator({ strictMode })

  // Periódico-alvo (opcional) — usa a rota docx-periodico quando selecionado
  const [periodicoSelecionado, setPeriodicoSelecionado] = useState('')

  const progresso = Math.round((secoesComConteudo / totalFases) * 100)
  const incompleto = secoesComConteudo < totalFases

  async function baixar(formato: 'docx' | 'pptx') {
    if (strictMode && !canExport(referencias ?? [])) {
      toast.error('Corrija os erros críticos de referências antes de exportar.')
      return
    }
    const setStatus = formato === 'docx' ? setStatusDocx : setStatusPptx
    setStatus('loading')
    try {
      const url = formato === 'docx' && periodicoSelecionado
        ? `/api/exportar/docx-periodico?id=${trabalho.id}&periodico=${periodicoSelecionado}`
        : `/api/exportar/${formato}?id=${trabalho.id}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erro na geração')

      const blob = await res.blob()
      const titulo = (trabalho.titulo ?? 'trabalho')
        .replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim().substring(0, 60) || 'cientifica-ai'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${titulo}.${formato}`
      a.click()
      URL.revokeObjectURL(a.href)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      console.error('[ExportarClient] Erro:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  function imprimirPdf() {
    window.open(`/trabalhos/${trabalho.id}/visualizar`, '_blank')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Exportar trabalho"
        description={`${trabalho.titulo || 'Sem título'} · ${getTipoLabel(trabalho.tipo_trabalho)}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo || 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'Exportar' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/trabalhos/${trabalho.id}/visualizar`}
              className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2')}>
              <Eye className="h-4 w-4" /> Preview
            </Link>
            <Link href={`/trabalhos/${trabalho.id}/editar`}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              <ArrowLeft className="h-4 w-4" /> Editor
            </Link>
          </div>
        }
      />

      {/* Progresso */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">Progresso do trabalho</p>
          <span className={cn('text-sm font-bold', progresso === 100 ? 'text-green-600' : 'text-yellow-600')}>
            {progresso}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all', progresso === 100 ? 'bg-green-500' : 'bg-yellow-400')}
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {secoesComConteudo} de {totalFases} seções com conteúdo
        </p>

        {incompleto && (
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              O trabalho ainda não está completo. Você pode exportar agora, mas as seções sem conteúdo ficarão em branco.
            </p>
          </div>
        )}
      </div>

      {/* Preview antes de exportar */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <Eye className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-indigo-900">
            Revise antes de exportar
          </p>
          <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
            Verifique formatação, citações e referências na visualização completa antes de gerar o arquivo final.
          </p>
          <Link
            href={`/trabalhos/${trabalho.id}/visualizar`}
            target="_blank"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Abrir visualização completa
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Periódico-alvo (opcional) */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Exportar para periódico específico
          <span className="text-gray-400 font-normal ml-1">(opcional)</span>
        </label>
        <select
          value={periodicoSelecionado}
          onChange={e => setPeriodicoSelecionado(e.target.value)}
          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="">Formatação padrão do trabalho</option>
          {PERIODICOS.map(p => (
            <option key={p.id} value={p.id}>
              {p.nome}{p.area !== 'Qualquer' ? ` — ${p.area}` : ''}
            </option>
          ))}
        </select>

        {periodicoSelecionado && (() => {
          const p = PERIODICOS.find(x => x.id === periodicoSelecionado)
          if (!p) return null
          return (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 space-y-1">
              <p className="text-xs text-blue-800 font-medium">{p.instrucoes}</p>
              {p.urlInstrucoes && (
                <a href={p.urlInstrucoes} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">
                  Ver instruções completas →
                </a>
              )}
            </div>
          )
        })()}
      </div>

      {/* Opções de exportação */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-900">Escolha o formato</p>

        {/* DOCX */}
        <ExportCard
          icon={FileText}
          title="Documento Word (.docx)"
          description="Formatação ABNT completa: Times New Roman 12pt, margens 3×3×2×4cm, parágrafos com recuo. Pronto para edição final."
          badge="Recomendado"
          badgeColor="bg-primary/10 text-primary"
          status={statusDocx}
          onDownload={() => baixar('docx')}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />

        {/* PPTX */}
        <ExportCard
          icon={Presentation}
          title="Apresentação PowerPoint (.pptx)"
          description="Slides com slide de capa, sumário e um slide por seção, com o resumo do conteúdo. Ideal para defesas e bancas."
          status={statusPptx}
          onDownload={() => baixar('pptx')}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />

        {/* PDF via print */}
        <div className="bg-white border rounded-xl p-5 flex items-start gap-4">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', 'bg-red-50')}>
            <Printer className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-gray-900">PDF para impressão</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Abre o preview formatado em nova aba. Use <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+P</kbd> (ou <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">⌘P</kbd>) e escolha <strong>Salvar como PDF</strong>.
            </p>
            <button onClick={imprimirPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Eye className="h-4 w-4" /> Abrir preview
            </button>
          </div>
        </div>
      </div>

      {/* Dica de formato */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium">Sobre o formato de citação</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Este trabalho usa <strong>{trabalho.formato_citacao.toUpperCase()}</strong>. As referências são formatadas automaticamente neste estilo no DOCX e no PDF.
        </p>
      </div>
    </div>
  )
}

interface ExportCardProps {
  icon: React.ElementType
  title: string
  description: string
  badge?: string
  badgeColor?: string
  status: ExportStatus
  onDownload: () => void
  iconColor: string
  iconBg: string
}

function ExportCard({ icon: Icon, title, description, badge, badgeColor, status, onDownload, iconColor, iconBg }: ExportCardProps) {
  return (
    <div className="bg-white border rounded-xl p-5 flex items-start gap-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {badge && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', badgeColor)}>{badge}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{description}</p>
        <button
          onClick={onDownload}
          disabled={status === 'loading'}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            status === 'done'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : status === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
          )}
        >
          {status === 'loading' && <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>}
          {status === 'done'    && <><CheckCircle2 className="h-4 w-4" /> Baixado!</>}
          {status === 'error'   && <><AlertTriangle className="h-4 w-4" /> Erro — tentar novamente</>}
          {status === 'idle'    && <><Download className="h-4 w-4" /> Baixar</>}
        </button>
      </div>
    </div>
  )
}
