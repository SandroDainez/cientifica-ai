// ============================================================
// CIENTÍFICA AI — Saneamento DETERMINÍSTICO de referências
// ============================================================
// Quando a revisão marca uma referência como "remover" (off-topic, não pertence
// ao trabalho), removemos suas citações do corpo por CÓDIGO — inclusive dentro de
// citações em grupo "(A; B, 2022; C, 2023)" — e a referência da lista. Sem depender
// do modelo: "achou errado → corrige". Funções puras → travadas por teste.

import type { Referencia } from '@/types'

/** Normaliza um sobrenome para comparação: sem acento, maiúsculo, sem espaços nas pontas. */
const normSob = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

/** Extrai o 1º sobrenome + ano de uma citação/referência textual. null se não der. */
export function extrairSobrenomeAno(citacao: string): { sobrenome: string; ano: number } | null {
  const my = citacao.match(/(?:19|20)\d{2}/)
  if (!my) return null
  const ano = Number.parseInt(my[0], 10)
  const antesAno = citacao.slice(0, citacao.indexOf(my[0]))
  const sobrenome = antesAno.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]+/)?.[0]
  if (!sobrenome) return null
  return { sobrenome, ano }
}

/**
 * Casa uma citação textual ("GALVÃO; SILVA, 2022", "SANTOS et al., 2022") com a
 * referência real da lista, pelo sobrenome do 1º autor + ano. Retorna null se não achar.
 */
export function acharRefPorCitacao(refs: Referencia[], citacao: string): Referencia | null {
  const sa = extrairSobrenomeAno(citacao)
  if (!sa) return null
  const alvo = normSob(sa.sobrenome)
  return refs.find(r => r.ano === sa.ano && normSob(r.autores?.[0]?.sobrenome ?? '') === alvo) ?? null
}

/**
 * VANCOUVER: remove com segurança as citações [N] das referências em `posicoesRemovidas`
 * (posições 1-based na lista ordenada) e RENUMERA o resto — `[j]` com j > k vira `[j-k_count]`.
 * Mantém o corpo consistente com a bibliografia recompilada (que renumera 1..M).
 * Trabalha com colchetes simples `[N]` (formato gerado pelo app). Pura/testada.
 */
export function renumerarVancouverRemovendo(corpo: string, posicoesRemovidas: number[]): { texto: string; removidas: number } {
  if (!corpo || posicoesRemovidas.length === 0) return { texto: corpo, removidas: 0 }
  const removidas = new Set(posicoesRemovidas)
  let cont = 0
  let out = corpo.replace(/\[(\d+)\]/g, (_full, numStr: string) => {
    const n = Number.parseInt(numStr, 10)
    if (removidas.has(n)) { cont++; return '' }          // citação da ref removida → apaga
    const shift = posicoesRemovidas.filter(p => p < n).length
    return `[${n - shift}]`                               // decrementa pelas removidas antes dele
  })
  // Limpeza de pontuação/espaço órfão deixado pela citação removida.
  out = out
    .replace(/ +([.,;:)])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/,\s*\./g, '.')
    .replace(/ +\./g, '.')
  return { texto: out, removidas: cont }
}

/**
 * Remove TODAS as citações parentéticas de uma referência (1º sobrenome + ano) do
 * texto — inclusive quando ela está DENTRO de um grupo. Em ABNT, refs num mesmo
 * parêntese são separadas por ';' que vem DEPOIS de um ano; o ';' entre autores de
 * uma mesma ref vem depois de um sobrenome. Usamos isso para separar com segurança.
 * Não mexe em Vancouver ([N]) — renumerar é arriscado.
 */
export function removerEntradaDeCitacoes(texto: string, primeiroSobrenome: string, ano: number): { texto: string; removidas: number } {
  if (!texto || !primeiroSobrenome || !ano) return { texto, removidas: 0 }
  const alvo = normSob(primeiroSobrenome)
  const anoStr = String(ano)
  let removidas = 0

  let out = texto.replace(/\(([^()]+)\)/g, (full, inner: string) => {
    // separa as referências do grupo: ';' que vem logo após um ano (ex.: "2022; ")
    const tokens = inner.split(/(?<=\d{4}[a-z]?)\s*;\s*/)
    const mantidos = tokens.filter(tok => {
      const bate = normSob(tok).startsWith(alvo) && tok.includes(anoStr)
      if (bate) removidas++
      return !bate
    })
    if (mantidos.length === tokens.length) return full   // nada removido neste grupo
    if (mantidos.length === 0) return ''                 // o parêntese inteiro era a ref alvo
    return `(${mantidos.join('; ')})`
  })

  // Limpeza pós-remoção: espaços/pontuação órfãos.
  out = out
    .replace(/\(\s*[;,]\s*/g, '(')      // "( ; X" → "(X"
    .replace(/\s*[;,]\s*\)/g, ')')      // "X ; )" → "X)"
    .replace(/ +([.,;:)])/g, '$1')      // espaço antes de pontuação
    .replace(/\s{2,}/g, ' ')            // espaços duplos (de citação solo removida)
    .replace(/ +\./g, '.')              // " ." → "."
  return { texto: out, removidas }
}
