// ============================================================
// CIENTÍFICA AI — Qualidade de referências (fonte única de verdade)
// ============================================================
// Garante que NÃO entrem na biblioteca referências inaceitáveis em qualquer
// norma acadêmica:
//  - sem autor real (placeholders "NA", "&NA;", "Anonymous"…)
//  - registros que não são o artigo original (recomendações Faculty Opinions,
//    errata, correções, retratações, comentários, respostas de autor…)
// Aplicado tanto no mapeamento externo (CrossRef/PubMed) quanto no filtro do
// import automático, para o problema não voltar por caminhos diferentes.

import type { AutorReferencia } from '@/types'

const normalizar = (s: string) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Sobrenomes que não são nomes reais (artefatos de importação). */
const SOBRENOMES_INVALIDOS = new Set([
  'na', 'n/a', 'nan', 'null', 'none', 'nil', 'undefined',
  'anonymous', 'anon', 'anonimo', 'unknown', 'desconhecido',
  'et al', 'etal', 'author', 'authors', 'autor', 'autores',
  's/a', 'sa', 'no author', 'sem autor',
])

/** Um sobrenome de autor é placeholder/ inválido? (ex.: "&NA;", "NA", "Anonymous") */
export function ehSobrenomePlaceholder(sobrenome?: string): boolean {
  if (!sobrenome) return true
  // remove entidades HTML tipo "&NA;" / "&amp;" e pontuação solta
  const limpo = normalizar(sobrenome.replace(/&[a-z]+;/gi, '').replace(/[&;]/g, ''))
  if (!limpo) return true
  if (SOBRENOMES_INVALIDOS.has(limpo)) return true
  // só dígitos/pontuação, ou letra única
  if (!/[a-zà-ÿ]{2,}/i.test(limpo)) return true
  return false
}

/** Remove autores-placeholder de uma lista, preservando os reais. */
export function limparAutoresPlaceholder(autores?: AutorReferencia[]): AutorReferencia[] {
  return (autores ?? []).filter(a => !ehSobrenomePlaceholder(a?.sobrenome))
}

// Títulos que indicam que o registro NÃO é o artigo original e sim um
// metadado sobre outro trabalho — não devem ser citados como fonte primária.
const PADROES_TITULO_DESCARTAVEL: RegExp[] = [
  /^faculty opinions recommendation/i,
  /^f1000(prime)? recommendation/i,
  /\brecommendation of\b/i,
  /^(erratum|errata|corrigendum|correction)\b/i,
  /^correction to\b/i,
  /^retraction\b|\bretracted\b/i,
  /^withdrawal of\b|^withdrawn\b/i,
  /^expression of concern\b/i,
  /^comment on\b|^commentary on\b/i,
  /^reply to\b|^response to\b|^author'?s? reply\b/i,
  /^in (this|the) (issue|number)\b/i,
]

/** O título indica um registro não-original (recomendação, errata, etc.)? */
export function ehTituloDescartavel(titulo?: string): boolean {
  const t = (titulo ?? '').trim()
  if (!t) return true
  return PADROES_TITULO_DESCARTAVEL.some(rx => rx.test(t))
}

/**
 * A referência é utilizável como fonte acadêmica?
 * Exige: título original (não recomendação/errata) E ao menos um autor real.
 */
export function ehReferenciaUtilizavel(ref: { titulo?: string; autores?: AutorReferencia[] }): boolean {
  if (ehTituloDescartavel(ref.titulo)) return false
  if (limparAutoresPlaceholder(ref.autores).length === 0) return false
  return true
}
