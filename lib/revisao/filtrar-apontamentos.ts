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

/** Remove os falsos-positivos de formatação de referência da lista de problemas. */
export function filtrarApontamentos<T extends ApontamentoMinimo>(problemas: T[]): T[] {
  return problemas.filter(p => !ehFalsoPositivoFormatacaoReferencia(p))
}
