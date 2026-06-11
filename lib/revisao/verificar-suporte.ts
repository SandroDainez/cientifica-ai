// ============================================================
// CIENTÍFICA AI — Verificação determinística de SUPORTE da citação
// ============================================================
// O ponto #1 de confiabilidade (apontado por avaliação de banca): um número
// específico atribuído a uma fonte que não o sustenta. Esta checagem, por CÓDIGO,
// pega o caso mais grave e verificável: um PERCENTUAL citado ao lado de uma
// referência cujo RESUMO (abstract) NÃO contém aquele número. Conservadora:
// - só percentuais (alta precisão, baixo falso-positivo);
// - só acusa quando a fonte citada TEM resumo (senão não dá para verificar → cala);
// - marca como "verificar" (média) — pode estar no texto completo, não no resumo.

import type { Referencia } from '@/types'
import { acharRefPorCitacao } from '@/lib/revisao/sanear-refs'

export interface ProblemaSuporte { trecho: string; problema: string; sugestao: string }

/** O abstract contém o número (inteiro) seguido de %/percent? (tolerante PT/EN) */
function abstractSustenta(numero: string, abstract: string): boolean {
  const inteiro = numero.replace(',', '.').split('.')[0]
  if (!inteiro) return false
  return new RegExp(`\\b${inteiro}(?:[.,]\\d+)?\\s*(?:%|percent|per ?cent|por ?cento)`, 'i').test(abstract)
}

/** Extrai as citações (parentéticas e inline "Sobrenome (ano)") de uma frase. */
function citacoesNaFrase(frase: string): string[] {
  const cits: string[] = []
  for (const m of frase.matchAll(/\(([^)]*\b(?:19|20)\d{2}[a-z]?[^)]*)\)/g)) {
    for (const parte of m[1].split(/;|\be\b/)) if (/(?:19|20)\d{2}/.test(parte)) cits.push(parte.trim())
  }
  for (const m of frase.matchAll(/([A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+(?:\s+et\s+al\.?)?)\s*\(((?:19|20)\d{2})/g)) {
    cits.push(`${m[1]} ${m[2]}`)
  }
  return cits
}

/**
 * Devolve problemas (categoria citação) para PERCENTUAIS citados que não constam no
 * resumo da fonte citada. Não acusa quando a fonte não tem resumo (não dá p/ verificar).
 */
export function verificarNumerosSemSuporte(corpo: string, refs: Referencia[]): ProblemaSuporte[] {
  if (!corpo || !refs.length) return []
  const out: ProblemaSuporte[] = []
  const vistos = new Set<string>()
  const frases = corpo.split(/(?<=[.!?])\s+/)
  for (const frase of frases) {
    const percentuais = [...frase.matchAll(/\b(\d{1,3}(?:[.,]\d+)?)\s*%/g)].map(m => m[1])
    if (percentuais.length === 0) continue
    const refsCitadas = citacoesNaFrase(frase)
      .map(c => acharRefPorCitacao(refs, c))
      .filter((r): r is Referencia => !!r)
    const comAbstract = refsCitadas.filter(r => (r.abstract ?? '').trim().length >= 80)
    if (comAbstract.length === 0) continue   // sem resumo nas fontes citadas → não verificável
    for (const num of percentuais) {
      if (comAbstract.some(r => abstractSustenta(num, r.abstract ?? ''))) continue
      const chave = `${num}|${frase.slice(0, 40)}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      out.push({
        trecho: frase.trim().slice(0, 240),
        problema: `O número ${num}% não foi localizado no resumo da fonte citada — confirme na fonte original ou generalize (ex.: "taxas substancialmente mais altas").`,
        sugestao: `Verifique se ${num}% consta na referência; se não constar, remova o número ou reformule sem o dado específico.`,
      })
    }
  }
  return out
}
