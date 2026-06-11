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

// Veículos que indicam fonte FRACA / não revisada por pares — não devem ser a base
// de um trabalho de excelência (newsletter, jornal de notícias, preprint).
const VEICULO_FRACO = /\bnews\b|newsletter|hospitalist news|\bdaily\b|gazette|bulletin\b|\bmagazine\b|ssrn|bior[xX]iv|medr[xX]iv|\bpreprint|research square|preprints?\.org|\barxiv\b/i

/**
 * Fonte fraca (não-primária / não revisada por pares): newsletter, nota de jornal,
 * preprint, ou item de 1 página (ex.: paginas "18-18"). Usado para DEPRIORIZAR no
 * import (a qualidade entra primeiro) — NÃO remove o que já existe.
 */
export function ehFonteFraca(ref: { journal?: string; paginas?: string }): boolean {
  if (VEICULO_FRACO.test(ref.journal ?? '')) return true
  const pg = (ref.paginas ?? '').match(/(\d+)\s*[-–—]\s*(\d+)/)
  if (pg && pg[1] === pg[2]) return true   // mesma página de início e fim = 1 página
  return false
}
