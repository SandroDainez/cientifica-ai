import type { SecaoTrabalho } from '@/types'

/**
 * Capitaliza a primeira letra (sentence case) — para títulos científicos, que
 * em português levam só a inicial maiúscula (e nomes próprios), não Title Case.
 * "dois protocolos de…" → "Dois protocolos de…"
 */
export function capitalizarTitulo(s: string | null | undefined): string {
  const t = (s ?? '').trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Capitaliza um nome próprio (cada palavra), mantendo conectores minúsculos.
 * "claudio scorcine" → "Claudio Scorcine"; "joão de souza" → "João de Souza".
 */
export function nomeProprioCase(s: string | null | undefined): string {
  const t = (s ?? '').trim()
  if (!t) return ''
  const conectores = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  return t
    .toLowerCase()
    .split(/\s+/)
    .map(w => (conectores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/**
 * Título efetivo do trabalho para a CAPA e exportações.
 *
 * A coluna `trabalhos.titulo` só é preenchida quando o usuário digita um título
 * na criação — muitas vezes fica vazia. O título real costuma ser produzido na
 * seção "Título e Escopo" (chave_secao 'titulo'). Esta função usa o título da
 * coluna quando existir e, senão, extrai a primeira linha significativa da seção
 * de título, removendo markdown e rótulos como "Título:".
 */
export function tituloEfetivo(
  titulo: string | null | undefined,
  secoes: SecaoTrabalho[],
): string | null {
  if (titulo?.trim()) return titulo.trim()

  const secaoTitulo = secoes.find(s => s.chave_secao === 'titulo')
  if (!secaoTitulo?.conteudo?.trim()) return null

  const limpo = secaoTitulo.conteudo.replace(/[*#`>]/g, '')
  const primeiraLinha = limpo
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0 && !/^(escopo|abstract|resumo|palavras?-chave|keywords)\b/i.test(l))

  if (!primeiraLinha) return null

  // Remove rótulo inicial "Título:" / "Título —" se presente
  const semRotulo = primeiraLinha.replace(/^t[íi]tulo\s*[:\-—]\s*/i, '').trim()
  return semRotulo || null
}
