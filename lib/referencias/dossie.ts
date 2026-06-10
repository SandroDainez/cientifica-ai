// ============================================================
// CIENTÍFICA AI — Dossiê de fontes (geração ancorada na fonte)
// ============================================================
// Coração do "lê → escreve → cita": em vez de a IA escolher referências só
// pelo TÍTULO (cego ao conteúdo, gera citação que não sustenta a afirmação),
// selecionamos as fontes mais relevantes para a seção e mostramos o RESUMO
// (abstract) de cada uma no prompt. Assim a IA escreve ancorada no que a fonte
// realmente diz e cita só o que o resumo sustenta.
//
// Tudo aqui é determinístico e puro → travado por teste de regressão.

import type { Referencia, FormatoCitacao } from '@/types'
import { citacaoInTexto } from '@/lib/referencias/formatar'

// Stopwords PT + EN: palavras vazias que não ajudam a medir relevância.
const STOPWORDS = new Set([
  // português
  'para', 'como', 'pela', 'pelo', 'pelos', 'pelas', 'esse', 'essa', 'este', 'esta',
  'isso', 'aquele', 'aquela', 'seus', 'suas', 'dos', 'das', 'uma', 'uns', 'umas',
  'com', 'sem', 'sobre', 'entre', 'sob', 'ante', 'apos', 'desde', 'mais', 'menos',
  'muito', 'pouco', 'todo', 'toda', 'todos', 'todas', 'ser', 'estar', 'foram', 'sao',
  'que', 'qual', 'quais', 'quando', 'onde', 'porque', 'por', 'nao', 'sim', 'tem',
  'entao', 'assim', 'tambem', 'ainda', 'cada', 'pode', 'podem', 'deve', 'devem',
  'estudo', 'estudos', 'pesquisa', 'trabalho', 'artigo', 'analise', 'objetivo',
  'partir', 'forma', 'caso', 'casos', 'dados', 'resultado', 'resultados',
  // inglês
  'the', 'and', 'for', 'with', 'without', 'from', 'into', 'this', 'that', 'these',
  'those', 'their', 'there', 'which', 'what', 'when', 'where', 'study', 'studies',
  'analysis', 'research', 'results', 'using', 'based', 'between', 'among', 'about',
  'were', 'was', 'are', 'has', 'have', 'had', 'can', 'may', 'will', 'such', 'also',
  'data', 'paper', 'article', 'review', 'effect', 'effects',
])

/** Quebra um texto em palavras-chave normalizadas (sem acento, ≥4 letras, sem stopword). */
export function normalizarTermos(texto: string): string[] {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w))
}

/** Encurta um abstract para caber no prompt, cortando numa fronteira de frase. */
export function resumirAbstract(abstract: string, maxChars = 480): string {
  const s = (abstract || '').replace(/\s+/g, ' ').trim()
  if (s.length <= maxChars) return s
  const corte = s.slice(0, maxChars)
  const ultimoPonto = corte.lastIndexOf('. ')
  return ultimoPonto > maxChars * 0.6 ? corte.slice(0, ultimoPonto + 1) : `${corte.trimEnd()}…`
}

/** Pontua quão relevante uma referência é para os termos da seção. Título pesa mais. */
export function pontuarRelevancia(ref: Pick<Referencia, 'titulo' | 'abstract'>, termos: Set<string>): number {
  if (termos.size === 0) return 0
  const tituloKW = new Set(normalizarTermos(ref.titulo ?? ''))
  const absKW = new Set(normalizarTermos(ref.abstract ?? ''))
  let score = 0
  for (const t of termos) {
    if (tituloKW.has(t)) score += 3        // bater no título indica forte aderência
    else if (absKW.has(t)) score += 1      // bater no resumo indica aderência temática
  }
  return score
}

/**
 * Seleciona as fontes COM RESUMO mais relevantes para a seção (para mostrar o
 * abstract no prompt). Só entram referências que têm abstract útil e alguma
 * aderência aos termos da seção — assim controlamos o tamanho do prompt e
 * evitamos "encher" com fontes fora do tema. Determinístico (desempate estável).
 */
export function selecionarFontesRelevantes(
  refs: Referencia[],
  termosTexto: string,
  max = 16,
): Referencia[] {
  const termos = new Set(normalizarTermos(termosTexto))
  const comAbstract = refs.filter(r => (r.abstract ?? '').trim().length >= 80)
  if (comAbstract.length === 0) return []
  if (termos.size === 0) return comAbstract.slice(0, max)
  return comAbstract
    .map((ref, i) => ({ ref, i, score: pontuarRelevancia(ref, termos) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, max)
    .map(x => x.ref)
}

/**
 * BLOCO E — monta o bloco "FONTES CITADAS (com resumo)" para a Revisão Avançada
 * conferir se cada citação tem suporte na fonte. Só entram fontes COM abstract;
 * resumo curto (300 chars) para caber no orçamento de tokens da revisão.
 */
export function montarFontesParaRevisao(refs: Referencia[], formato: FormatoCitacao = 'abnt', max = 18): string {
  const comAbstract = refs.filter(r => (r.abstract ?? '').trim().length >= 80).slice(0, max)
  if (comAbstract.length === 0) return ''
  return comAbstract
    .map((ref, i) => `${citacaoInTexto(ref, formato, i + 1)} — "${ref.titulo}": ${resumirAbstract(ref.abstract ?? '', 300)}`)
    .join('\n')
}
