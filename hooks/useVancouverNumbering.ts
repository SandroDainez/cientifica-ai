import { useMemo } from 'react'
import type { Referencia, FormatoCitacao } from '@/types'

/**
 * Para Vancouver: calcula a numeração correta das citações no texto atual.
 * Retorna um mapa de número antigo → número correto baseado na ordem
 * de primeira aparição no texto.
 */
export function useVancouverNumbering(
  conteudo: string,
  referencias: Referencia[],
  formato: FormatoCitacao
): { conteudoCorrigido: string; totalCitacoes: number } {
  return useMemo(() => {
    if (formato !== 'vancouver' || !conteudo || referencias.length === 0) {
      return { conteudoCorrigido: conteudo, totalCitacoes: 0 }
    }

    const mapa = new Map<number, number>()
    let proximo = 1
    let totalCitacoes = 0

    const corrigido = conteudo.replace(/\[(\d+)\]/g, (match, numStr) => {
      const num = parseInt(numStr, 10)
      if (num < 1 || num > referencias.length * 3) return match
      if (!mapa.has(num)) mapa.set(num, proximo++)
      totalCitacoes++
      return `[${mapa.get(num)}]`
    })

    return { conteudoCorrigido: corrigido, totalCitacoes }
  }, [conteudo, referencias.length, formato])
}
