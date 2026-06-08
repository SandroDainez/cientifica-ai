// ============================================================
// CIENTÍFICA AI — Detecção de referências citadas no corpo
// ============================================================
// REGRA ABNT/Vancouver/APA: toda referência da lista DEVE estar citada no
// texto, e toda citação do texto DEVE constar na lista. Este módulo identifica
// quais referências foram efetivamente citadas, para que a lista final do
// documento exportado/visualizado nunca contenha referências órfãs.
//
// PRINCÍPIO DE SEGURANÇA: na dúvida, MANTÉM a referência. Só removemos quando
// há certeza razoável de que não foi citada (sobrenome distintivo do 1º autor
// totalmente ausente do corpo). Assim nunca removemos uma referência válida.

import type { Referencia, FormatoCitacao } from '@/types'
import { ehReferenciaUtilizavel } from './qualidade'

const normalizar = (s: string) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()

/** Extrai todos os índices [N] citados no corpo (inclui listas [1,3] e faixas [2-4]). */
export function indicesVancouverCitados(corpo: string): Set<number> {
  const set = new Set<number>()
  for (const m of corpo.matchAll(/\[([\d,;\s–-]+)\]/g)) {
    for (const parte of m[1].split(/[,;]/)) {
      const faixa = parte.trim().match(/^(\d+)\s*[–-]\s*(\d+)$/)
      if (faixa) {
        for (let k = parseInt(faixa[1], 10); k <= parseInt(faixa[2], 10); k++) set.add(k)
      } else {
        const n = parseInt(parte.trim(), 10)
        if (!isNaN(n)) set.add(n)
      }
    }
  }
  return set
}

/**
 * Uma referência (autor-data) é considerada citada se o sobrenome do 1º autor
 * aparece no corpo. Para entidades coletivas, autores com sobrenome curto, ou
 * referências sem autor, retorna SEMPRE true (mantém — não é seguro remover).
 */
export function referenciaCitadaAutorData(ref: Referencia, corpoNorm: string): boolean {
  const primeiro = ref.autores?.[0]
  if (!primeiro) return true // sem autor → não dá para verificar com segurança
  const temPrenome = !!(primeiro.nome ?? '').trim()
  const sobrenome = normalizar(primeiro.sobrenome ?? '').trim()
  // Só removemos com base em sobrenome de autor pessoal e distintivo (>= 4 letras).
  // Entidades coletivas (sem prenome) e sobrenomes curtos são sempre mantidos.
  if (!temPrenome || sobrenome.length < 4) return true
  return corpoNorm.includes(sobrenome)
}

/**
 * Separa as referências em CITADAS e NÃO CITADAS no corpo.
 * - ABNT / APA: cruza pelo sobrenome do 1º autor (conservador — ver acima).
 * - Vancouver: cruza pelo número [N] (1-based na ordem recebida). Só marca como
 *   não citada quando o índice está claramente ausente.
 */
export function separarReferenciasCitadas(
  refs: Referencia[],
  corpo: string,
  formato: FormatoCitacao,
): { citadas: Referencia[]; naoCitadas: Referencia[] } {
  const citadas: Referencia[] = []
  const naoCitadas: Referencia[] = []

  if (formato === 'vancouver') {
    // CUIDADO: no Vancouver a numeração [N] é posicional — remover uma referência
    // do MEIO renumeraria todas as seguintes e quebraria a correspondência com o
    // corpo. Por isso só removemos órfãs no FINAL da lista (índice acima do maior
    // número citado), o que NÃO altera a numeração das que permanecem.
    const indices = indicesVancouverCitados(corpo)
    if (indices.size === 0) return { citadas: refs, naoCitadas: [] }
    const maxCitado = Math.max(...indices)
    refs.forEach((ref, i) => {
      if (i + 1 <= maxCitado) citadas.push(ref)
      else naoCitadas.push(ref)
    })
    return { citadas, naoCitadas }
  }

  const corpoNorm = normalizar(corpo)
  for (const ref of refs) {
    // Mesmo quando "citada", uma referência sem autor real (ex.: "&NA;") ou de
    // registro não-original (recomendação/errata) NUNCA deve constar na lista.
    if (!ehReferenciaUtilizavel(ref)) { naoCitadas.push(ref); continue }
    if (referenciaCitadaAutorData(ref, corpoNorm)) citadas.push(ref)
    else naoCitadas.push(ref)
  }
  return { citadas, naoCitadas }
}
