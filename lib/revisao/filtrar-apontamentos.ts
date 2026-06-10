// ============================================================
// CIENTÍFICA AI — Trava determinística contra apontamentos falsos da revisão
// ============================================================
// A lista de REFERÊNCIAS é gerada pelo app no padrão da norma (título do
// periódico/revista em NEGRITO = destaque ABNT/Vancouver OBRIGATÓRIO). O revisor
// de IA às vezes marca esse negrito como "negrito desnecessário" — falso-positivo
// que penaliza o que está CORRETO e que o usuário nem edita à mão. Esta trava
// descarta esses apontamentos POR CÓDIGO, independente do que o modelo devolva.
// Regra do app (ver AGENTS.md / prompt): NÃO regredir.

export interface ApontamentoMinimo {
  categoria?: string
  problema?: string
  trecho?: string
  sugestao?: string
}

/**
 * Verdadeiro quando o apontamento é uma reclamação de FORMATAÇÃO sobre uma entrada
 * da lista de referências (negrito do periódico, itálico, pontuação). Não é erro.
 */
export function ehFalsoPositivoFormatacaoReferencia(p: ApontamentoMinimo): boolean {
  if ((p.categoria ?? '') !== 'formatacao') return false
  const trecho = p.trecho ?? ''
  // Entrada de referência típica: "**Critical Care**, v. 16, n. S3, 2012." —
  // título do periódico em negrito (**...**) seguido de ano. Isso é destaque da norma.
  const temNegrito = /\*\*.+?\*\*/.test(trecho)
  const temAno = /\b(19|20)\d{2}\b/.test(trecho)
  if (temNegrito && temAno) return true
  // Reclamação textual de negrito em título de revista/periódico/referência.
  const txt = `${p.problema ?? ''} ${p.sugestao ?? ''}`.toLowerCase()
  return /negrito|bold/.test(txt) && /(revista|peri[oó]dico|t[ií]tulo da revista|refer[eê]ncia)/.test(txt)
}

/**
 * Verdadeiro quando o apontamento reclama que o trabalho cita a DATA ATUAL "mas
 * estamos em <ano atual>" — falso-positivo ilógico: a busca/estudo na data atual é
 * CORRETA, não inconsistência. Só dispara quando o trecho cita o ANO ATUAL e nenhum
 * ano futuro — NÃO suprime inconsistência REAL entre seções (ex.: "no resumo em 2024"),
 * porque nesses casos o problema não diz "estamos em <ano atual>".
 */
export function ehFalsoPositivoDataAtual(p: ApontamentoMinimo, anoAtual: number = new Date().getFullYear()): boolean {
  const txt = `${p.problema ?? ''} ${p.sugestao ?? ''}`.toLowerCase()
  if (!/inconsist[êe]ncia temporal|data (futura|atual)|temporal/.test(txt)) return false
  if (!new RegExp(`estamos em ${anoAtual}|data atual|ano atual`).test(txt)) return false
  const anos = (p.trecho?.match(/\b20\d{2}\b/g) ?? []).map(Number)
  if (anos.length === 0) return false
  // Trecho cita o ano atual e NENHUM ano futuro → a data está coerente: falso-positivo.
  return anos.includes(anoAtual) && anos.every(a => a <= anoAtual)
}

/** Remove os falsos-positivos (formatação de referência + data atual) da lista. */
export function filtrarApontamentos<T extends ApontamentoMinimo>(problemas: T[]): T[] {
  return problemas.filter(p => !ehFalsoPositivoFormatacaoReferencia(p) && !ehFalsoPositivoDataAtual(p))
}
