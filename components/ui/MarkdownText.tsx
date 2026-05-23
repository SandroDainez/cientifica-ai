import React from 'react'

/**
 * Renderiza texto com markdown básico (**negrito**, *itálico*, ###títulos e listas)
 * para exibição em visualizações e no chat da IA.
 */
export function renderMarkdownInline(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/)
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**'))
      return <strong key={i}>{token.slice(2, -2)}</strong>
    if (token.startsWith('*') && token.endsWith('*'))
      return <em key={i}>{token.slice(1, -1)}</em>
    return token
  })
}

interface MarkdownTextProps {
  content: string
  className?: string
}

/** Componente que renderiza markdown básico linha a linha */
export function MarkdownText({ content, className }: MarkdownTextProps) {
  const linhas = content.split('\n').filter(Boolean)
  return (
    <div className={className}>
      {linhas.map((linha, i) => {
        // Cabeçalho ###
        if (linha.startsWith('### '))
          return <p key={i} className="font-semibold mt-1">{renderMarkdownInline(linha.slice(4))}</p>
        if (linha.startsWith('## '))
          return <p key={i} className="font-bold mt-1">{renderMarkdownInline(linha.slice(3))}</p>
        // Item de lista
        if (linha.match(/^[-•*] /))
          return (
            <p key={i} className="flex gap-1">
              <span className="shrink-0">•</span>
              <span>{renderMarkdownInline(linha.slice(2))}</span>
            </p>
          )
        // Item numerado
        if (linha.match(/^\d+\. /))
          return <p key={i}>{renderMarkdownInline(linha)}</p>
        // Parágrafo normal
        return <p key={i}>{renderMarkdownInline(linha)}</p>
      })}
    </div>
  )
}
