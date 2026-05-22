'use client'

import { useState } from 'react'
import { Copy, Trash2, CheckCheck, FileText, BookOpen, Globe, GraduationCap, Scale, FileBarChart, BookMarked } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatarReferencia } from '@/lib/referencias/formatar'
import type { Referencia, FormatoCitacao, TipoReferencia } from '@/types'

const TIPO_ICONS: Record<TipoReferencia, React.ElementType> = {
  artigo:       FileText,
  livro:        BookOpen,
  capitulo_livro: BookMarked,
  site:         Globe,
  tese:         GraduationCap,
  dissertacao:  GraduationCap,
  lei:          Scale,
  norma:        FileBarChart,
  anais:        FileText,
}

const TIPO_LABELS: Record<TipoReferencia, string> = {
  artigo:        'Artigo',
  livro:         'Livro',
  capitulo_livro:'Capítulo',
  site:          'Site',
  tese:          'Tese',
  dissertacao:   'Dissertação',
  lei:           'Lei',
  norma:         'Norma',
  anais:         'Anais',
}

const CONF_COLORS = {
  alta:  'bg-green-50 text-green-700 border-green-200',
  media: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  baixa: 'bg-red-50 text-red-700 border-red-200',
}

interface ReferenciaCardProps {
  referencia: Referencia
  formato: FormatoCitacao
  onDeletar: (id: string) => void
}

export function ReferenciaCard({ referencia: r, formato, onDeletar }: ReferenciaCardProps) {
  const [copiado, setCopiado] = useState(false)
  const Icon = TIPO_ICONS[r.tipo] ?? FileText
  const textoFormatado = formatarReferencia(r, formato)

  function copiar() {
    navigator.clipboard.writeText(textoFormatado.replace(/\*\*/g, ''))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 shrink-0">
          <Icon className="h-4 w-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{r.titulo}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground">{TIPO_LABELS[r.tipo]}</span>
            {r.ano && <span className="text-xs text-muted-foreground">· {r.ano}</span>}
            {r.journal && <span className="text-xs text-muted-foreground">· {r.journal}</span>}
            <span className={cn('text-xs px-1.5 py-0.5 rounded border ml-auto', CONF_COLORS[r.confiabilidade])}>
              {r.confiabilidade}
            </span>
          </div>
        </div>
      </div>

      {/* Referência formatada */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
        <p className="text-xs text-gray-700 leading-relaxed font-mono">
          {textoFormatado.replace(/\*\*/g, '')}
        </p>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {r.doi && (
            <a
              href={`https://doi.org/${r.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              DOI ↗
            </a>
          )}
          {r.url && !r.doi && (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              Link ↗
            </a>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={copiar}
            title="Copiar referência formatada"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-gray-100 transition-colors"
          >
            {copiado
              ? <><CheckCheck className="h-3.5 w-3.5 text-green-500" /> Copiado</>
              : <><Copy className="h-3.5 w-3.5" /> Copiar</>
            }
          </button>
          <button
            onClick={() => onDeletar(r.id)}
            title="Remover referência"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
