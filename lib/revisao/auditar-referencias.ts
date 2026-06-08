// ============================================================
// CIENTÍFICA AI — Revisor de Consistência (auditoria de referências)
// ============================================================
// Aponta no trabalho o que NÃO deveria estar nele (referências problemáticas) e
// permite removê-las com segurança, sem danificar o texto. Tudo determinístico
// e testável — não depende de julgamento da IA.

import type { Referencia, FormatoCitacao } from '@/types'
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'
import { ehSobrenomePlaceholder, ehTituloDescartavel } from '@/lib/referencias/qualidade'

export type TipoInconsistencia =
  | 'NAO_CITADA'            // está na lista mas não é citada no corpo
  | 'SEM_AUTOR_REAL'       // autor placeholder (&NA;, Anonymous…)
  | 'REGISTRO_NAO_ORIGINAL' // errata, recomendação Faculty Opinions…
  | 'ANO_NAO_VERIFICAVEL'  // ano corrente/posterior — possível no prelo

export interface Inconsistencia {
  referenciaId: string
  tipo: TipoInconsistencia
  severidade: 'alta' | 'media'
  rotulo: string          // nome curto da referência (Autor, ano)
  descricao: string       // o que está errado
  comoResolver: string    // como remover/resolver sem danificar
  citadaNoCorpo: boolean   // se está citada (remoção exige limpar o corpo)
  removivelComSeguranca: boolean // true quando dá para remover sem quebrar frase
}

function rotuloRef(r: Referencia): string {
  const autor = r.autores?.[0]?.sobrenome?.trim() || r.titulo?.slice(0, 30) || 'referência'
  return `${autor}${r.ano ? `, ${r.ano}` : ''}`
}

const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()

/** Escapa um texto para uso literal dentro de uma RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Detecta se a referência é citada SOMENTE em formato parentético solo
 * — "(SOBRENOME, ANO)" — que pode ser removido com segurança. Se aparece em
 * citação narrativa ("Sobrenome (ANO) afirma…") ou em grupo ("(A; SOBRENOME, ANO)"),
 * a remoção automática quebraria a frase → exige edição manual.
 */
function citacaoRemovivelComSeguranca(texto: string, r: Referencia, formato: FormatoCitacao): boolean {
  if (formato === 'vancouver') return false
  const sob = norm(r.autores?.[0]?.sobrenome ?? '')
  const ano = r.ano
  if (!sob || !ano) return false
  const S = escapeRegex(sob)
  const corpo = norm(texto)
  // Narrativa: "SOBRENOME (ANO)" ou "SOBRENOME ET AL. (ANO)"
  const narrativa = new RegExp(`(?<![(;])\\s*${S}(?:\\s+ET\\s+AL\\.?)?\\s*\\(\\s*${ano}`, '').test(corpo)
  // Em grupo: "; SOBRENOME, ANO" ou "SOBRENOME; "
  const emGrupo = new RegExp(`\\([^)]*;[^)]*${S}[^)]*${ano}`, '').test(corpo)
    || new RegExp(`\\(\\s*${S}\\s*;`, '').test(corpo)
  return !narrativa && !emGrupo
}

/**
 * Remove as citações parentéticas SOLO de uma referência do texto
 * ("(SOBRENOME, ANO)") e limpa a pontuação. Retorna o texto e se restaram
 * citações que precisam de revisão manual (narrativa/grupo).
 */
export function removerCitacoesDaRef(
  texto: string,
  r: Referencia,
  formato: FormatoCitacao = 'abnt',
): { texto: string; restaramManuais: boolean } {
  if (formato === 'vancouver' || !texto) return { texto, restaramManuais: formato === 'vancouver' }
  const sobOriginal = r.autores?.[0]?.sobrenome ?? ''
  const ano = r.ano
  if (!sobOriginal || !ano) return { texto, restaramManuais: false }
  const S = escapeRegex(sobOriginal)
  // Solo parentético: " (Sobrenome, 2020)" / " (Sobrenome et al., 2020)"
  const solo = new RegExp(`\\s*\\(\\s*${S}(?:\\s+et\\s+al\\.?)?,\\s*${ano}[a-z]?\\s*\\)`, 'gi')
  let t = texto.replace(solo, '')
  t = t
    .replace(/ +([.,;:)])/g, '$1')
    .replace(/(?<![\wÀ-ÿ.])\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
  const restaramManuais = !citacaoRemovivelComSeguranca(texto, r, formato)
  return { texto: t, restaramManuais }
}

/**
 * Audita as referências do trabalho contra o corpo do texto e devolve a lista
 * de inconsistências, cada uma com explicação e como resolver.
 */
export function auditarReferencias(
  referencias: Referencia[],
  corpo: string,
  formato: FormatoCitacao,
  anoAtual: number,
): Inconsistencia[] {
  const issues: Inconsistencia[] = []
  const { naoCitadas } = separarReferenciasCitadas(referencias, corpo, formato)
  const idsNaoCitadas = new Set(naoCitadas.map(r => r.id))

  for (const r of referencias) {
    const citada = !idsNaoCitadas.has(r.id)
    const removivel = !citada || citacaoRemovivelComSeguranca(corpo, r, formato)

    if (ehSobrenomePlaceholder(r.autores?.[0]?.sobrenome)) {
      issues.push({
        referenciaId: r.id, tipo: 'SEM_AUTOR_REAL', severidade: 'alta', rotulo: rotuloRef(r),
        descricao: 'Referência sem autor real (registro com autor vazio/placeholder, ex.: "&NA;").',
        comoResolver: 'Inaceitável em qualquer norma. Remover a referência do trabalho.',
        citadaNoCorpo: citada, removivelComSeguranca: removivel,
      })
      continue
    }
    if (ehTituloDescartavel(r.titulo)) {
      issues.push({
        referenciaId: r.id, tipo: 'REGISTRO_NAO_ORIGINAL', severidade: 'alta', rotulo: rotuloRef(r),
        descricao: 'Não é o artigo original (errata, recomendação Faculty Opinions, comentário…).',
        comoResolver: 'Substituir pelo artigo original ou remover.',
        citadaNoCorpo: citada, removivelComSeguranca: removivel,
      })
      continue
    }
    if (!citada) {
      issues.push({
        referenciaId: r.id, tipo: 'NAO_CITADA', severidade: 'alta', rotulo: rotuloRef(r),
        descricao: 'Está na lista de referências mas não é citada no texto (referência órfã).',
        comoResolver: 'Em ABNT/Vancouver toda referência deve ser citada. Remover da lista (não afeta o texto).',
        citadaNoCorpo: false, removivelComSeguranca: true,
      })
      continue
    }
    if (r.ano && r.ano >= anoAtual) {
      issues.push({
        referenciaId: r.id, tipo: 'ANO_NAO_VERIFICAVEL', severidade: 'media', rotulo: rotuloRef(r),
        descricao: `Ano ${r.ano} (corrente ou posterior) — pode ser artigo no prelo/preprint ainda não consolidado.`,
        comoResolver: 'Verificar o DOI manualmente. Se for preprint, identificar como tal; se não existir, remover.',
        citadaNoCorpo: true, removivelComSeguranca: removivel,
      })
    }
  }
  return issues
}
