/**
 * Substituição da lista de referências gerada pela IA pela lista REAL formatada
 * pelo sistema, garantindo: (1) só referências reais, (2) formato correto do
 * estilo escolhido (ABNT/APA alfabético sem número; Vancouver numerado).
 */

import type { Referencia, FormatoCitacao } from '@/types'
import { formatarReferencia, ordenarReferencias } from '@/lib/referencias/formatar'

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

/**
 * Mantém apenas as referências cujo sobrenome do 1º autor aparece citado no texto.
 * Garante que a lista final não tenha referências órfãs (não citadas).
 */
export function filtrarRefsCitadas(referencias: Referencia[], texto: string): Referencia[] {
  const textoNorm = normalizar(texto)
  const citadas = referencias.filter(r => {
    const sob = r.autores?.[0]?.sobrenome
    if (!sob) return false
    return textoNorm.includes(normalizar(sob))
  })
  // Se o filtro removeu tudo (texto sem citações reconhecíveis), mantém todas
  return citadas.length > 0 ? citadas : referencias
}

/** Monta o bloco de referências formatado (sem o cabeçalho). */
export function montarListaReferencias(referencias: Referencia[], formato: FormatoCitacao): string {
  const ordenadas = ordenarReferencias(referencias, formato)
  const linhas = ordenadas.map((ref, i) => formatarReferencia(ref, formato, formato === 'vancouver' ? i + 1 : undefined))
  if (formato === 'vancouver') {
    return linhas.map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, '')}`).join('\n\n')
  }
  // ABNT/APA: alfabética, sem numeração
  return linhas.join('\n\n')
}

/**
 * Localiza o cabeçalho de "REFERÊNCIAS" no documento gerado e substitui tudo a
 * partir dele pela lista real formatada. Como a seção de referências é sempre a
 * última, substituir do cabeçalho até o fim é seguro.
 * Se não houver referências reais, retorna o texto sem alteração.
 */
export function substituirListaReferencias(
  texto: string,
  referencias: Referencia[],
  formato: FormatoCitacao,
): string {
  if (!referencias.length) return texto

  // Procura o cabeçalho de referências (com ou sem numeração/markdown)
  // Ex: "## 8. REFERÊNCIAS BIBLIOGRÁFICAS", "## REFERÊNCIAS", "8. REFERÊNCIAS (ABNT)"
  const regexCabecalho = /^#{0,6}\s*(?:\d+\.?\s*)?(?:REFERÊNCIAS|REFERENCIAS)(?:\s+BIBLIOGR[ÁA]FICAS)?(?:\s*\([^)]*\))?\s*$/im
  const match = texto.match(regexCabecalho)
  if (!match || match.index === undefined) {
    // Sem seção de referências detectada — anexa uma ao final
    return `${texto.trimEnd()}\n\n## REFERÊNCIAS\n\n${montarListaReferencias(referencias, formato)}\n`
  }

  const antes = texto.slice(0, match.index)
  const cabecalho = match[0].trim()
  // Lista apenas as referências efetivamente citadas no corpo do texto (antes da seção)
  const citadas = filtrarRefsCitadas(referencias, antes)
  const lista = montarListaReferencias(citadas, formato)

  return `${antes.trimEnd()}\n\n${cabecalho}\n\n${lista}\n`
}
