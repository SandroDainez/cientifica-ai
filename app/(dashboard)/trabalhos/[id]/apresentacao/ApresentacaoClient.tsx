'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Presentation, Download, Loader2, Sparkles,
  Clock, Layers, Palette, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import type { Trabalho } from '@/types'

interface Props { trabalho: Trabalho }

const TEMPOS = [
  { value: 10, label: '10 min — Apresentação rápida (evento/congresso)' },
  { value: 20, label: '20 min — TCC/Monografia (defesa padrão)' },
  { value: 30, label: '30 min — Qualificação ou artigo longo' },
  { value: 45, label: '45 min — Dissertação de mestrado' },
  { value: 60, label: '60 min — Tese de doutorado' },
]

const TEMAS_COR = [
  { value: 'azul_academico', label: 'Azul Acadêmico', preview: 'bg-blue-700' },
  { value: 'verde_ciencia', label: 'Verde Ciência', preview: 'bg-emerald-700' },
  { value: 'roxo_premium', label: 'Roxo Premium', preview: 'bg-violet-700' },
  { value: 'cinza_profissional', label: 'Cinza Profissional', preview: 'bg-gray-700' },
]

type Status = 'idle' | 'gerando' | 'pronto' | 'erro'

export function ApresentacaoClient({ trabalho }: Props) {
  const [tempo, setTempo] = useState(20)
  const [temaCor, setTemaCor] = useState('azul_academico')
  const [incluirNotas, setIncluirNotas] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [progresso, setProgresso] = useState('')

  const numSlides = Math.round(tempo * 0.9)

  async function gerarApresentacao() {
    setStatus('gerando')
    setProgresso('Analisando o trabalho…')
    try {
      const res = await fetch(`/api/exportar/pptx?id=${trabalho.id}`, {
        method: 'GET',
      })

      if (!res.ok) {
        setStatus('erro')
        return
      }

      setProgresso('Gerando slides…')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `apresentacao_${(trabalho.titulo ?? 'trabalho').replace(/\s+/g, '_').slice(0, 40)}.pptx`
      a.click()
      URL.revokeObjectURL(url)

      setStatus('pronto')
      setProgresso('')
    } catch (err) {
      console.error('[ApresentacaoClient] Erro:', err)
      setStatus('erro')
      setProgresso('')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <PageHeader
        title="Gerar Apresentação"
        description="Slides PowerPoint gerados com IA a partir do seu trabalho"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo ?? 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'Apresentação' },
        ]}
        actions={
          <Link href={`/trabalhos/${trabalho.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
            <ArrowLeft className="h-4 w-4" /> Voltar ao Editor
          </Link>
        }
      />

      {/* Card do trabalho */}
      <div className="bg-white border rounded-xl p-5 flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Presentation className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{trabalho.titulo || 'Trabalho sem título'}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{getTipoLabel(trabalho.tipo_trabalho)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            A IA irá estruturar os slides com base em todas as seções escritas do trabalho.
          </p>
        </div>
      </div>

      {/* Configurações */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-gray-900">Configurações da apresentação</p>
        </div>
        <div className="p-5 space-y-5">
          {/* Tempo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Tempo de apresentação — aprox. {numSlides} slides
            </label>
            <div className="space-y-2">
              {TEMPOS.map(t => (
                <label key={t.value} className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all',
                  tempo === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}>
                  <input type="radio" name="tempo" value={t.value}
                    checked={tempo === t.value} onChange={() => setTempo(t.value)} className="sr-only" />
                  <div className={cn(
                    'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                    tempo === t.value ? 'border-primary' : 'border-gray-300'
                  )}>
                    {tempo === t.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tema de cor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              Tema de cores
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TEMAS_COR.map(tema => (
                <label key={tema.value} className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all',
                  temaCor === tema.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}>
                  <input type="radio" name="tema" value={tema.value}
                    checked={temaCor === tema.value} onChange={() => setTemaCor(tema.value)} className="sr-only" />
                  <div className={cn('h-4 w-4 rounded-full shrink-0', tema.preview)} />
                  <span className="text-sm">{tema.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Opções extras */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={incluirNotas}
              onChange={e => setIncluirNotas(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary" />
            <div>
              <span className="text-sm font-medium text-gray-700">Incluir notas do apresentador</span>
              <p className="text-xs text-muted-foreground">Texto de apoio em cada slide para guiar a fala</p>
            </div>
          </label>
        </div>
      </div>

      {/* Estrutura dos slides */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-gray-900">Estrutura gerada pela IA</p>
          <span className="ml-auto text-xs text-muted-foreground">~{numSlides} slides</span>
        </div>
        <div className="p-5">
          <div className="space-y-2">
            {[
              `Slide 1 — Capa (título, autor, orientador, instituição)`,
              `Slide 2 — Agenda / Sumário`,
              `Slides 3-${Math.floor(numSlides * 0.2) + 2} — Introdução e contextualização`,
              `Slides ${Math.floor(numSlides * 0.2) + 3}-${Math.floor(numSlides * 0.4) + 2} — Objetivos e metodologia`,
              `Slides ${Math.floor(numSlides * 0.4) + 3}-${Math.floor(numSlides * 0.7) + 2} — Resultados`,
              `Slides ${Math.floor(numSlides * 0.7) + 3}-${numSlides - 2} — Discussão e conclusão`,
              `Slide ${numSlides - 1} — Referências principais`,
              `Slide ${numSlides} — Agradecimentos / Contato`,
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botão de geração */}
      <div className="flex flex-col items-center gap-3">
        {status === 'erro' && (
          <p className="text-sm text-red-600">Erro ao gerar a apresentação. Verifique se o trabalho tem seções escritas.</p>
        )}
        {status === 'pronto' && (
          <p className="text-sm text-green-600 flex items-center gap-1.5">
            ✓ Apresentação baixada com sucesso!
          </p>
        )}
        {progresso && (
          <p className="text-sm text-primary flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {progresso}
          </p>
        )}
        <button
          onClick={gerarApresentacao}
          disabled={status === 'gerando'}
          className={cn(buttonVariants({ size: 'lg' }), 'gap-3 w-full sm:w-auto')}
        >
          {status === 'gerando'
            ? <><Loader2 className="h-5 w-5 animate-spin" /> Gerando apresentação…</>
            : <><Download className="h-5 w-5" /> Gerar e baixar apresentação (.pptx)</>
          }
        </button>
        <p className="text-xs text-muted-foreground text-center">
          A apresentação é gerada com base nas seções já escritas no editor. Quanto mais seções concluídas, melhor o resultado.
        </p>
      </div>
    </div>
  )
}
