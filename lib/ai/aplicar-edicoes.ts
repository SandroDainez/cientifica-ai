// ============================================================
// CIENTÍFICA AI — Aplicação de edições cirúrgicas (buscar→substituir)
// ============================================================
// Aplica trocas pontuais no texto, com matching TOLERANTE a diferenças de
// espaço/quebra de linha — o modelo costuma devolver o "buscar" com whitespace
// levemente diferente do original, o que fazia o indexOf falhar e o texto NÃO
// ser corrigido (caindo na reescrita inteira, que piora). Determinístico e
// testável.

export interface Edicao { buscar: string; substituir: string }

/** Extrai e valida o array de edições do JSON retornado pelo modelo. */
export function parseEdicoes(raw: string): Edicao[] {
  if (!raw) return []
  let txt = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const ini = txt.indexOf('{')
  const fim = txt.lastIndexOf('}')
  if (ini >= 0 && fim > ini) txt = txt.slice(ini, fim + 1)
  try {
    const obj = JSON.parse(txt) as { edicoes?: Edicao[] }
    if (!Array.isArray(obj.edicoes)) return []
    return obj.edicoes
      .filter(e => e && typeof e.buscar === 'string' && typeof e.substituir === 'string' && e.buscar.length > 0)
      .slice(0, 12)
  } catch {
    return []
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ehLinhaTabela = (s: string) => /^\s*\|/m.test(s)

/**
 * Aplica as edições no texto. Para cada edição:
 *  1) tenta match EXATO (indexOf);
 *  2) se falhar, tenta match TOLERANTE a espaços (runs de whitespace ↔ \s+);
 *  3) se ainda falhar, ignora (não arrisca).
 * Nunca toca em linhas de tabela. Limpa pontuação/espaços deixados por remoções.
 */
export function aplicarEdicoes(texto: string, edicoes: Edicao[]): { texto: string; aplicadas: number } {
  let resultado = texto
  let aplicadas = 0

  for (const e of edicoes) {
    if (ehLinhaTabela(e.buscar) || ehLinhaTabela(e.substituir)) continue

    // 1) match exato
    const idx = resultado.indexOf(e.buscar)
    if (idx !== -1) {
      resultado = resultado.slice(0, idx) + e.substituir + resultado.slice(idx + e.buscar.length)
      aplicadas++
      continue
    }

    // 2) match tolerante a espaços/quebras de linha
    const alvo = e.buscar.trim()
    if (alvo.length < 1) continue
    const padrao = escapeRegex(alvo).replace(/\s+/g, '\\s+')
    let m: RegExpExecArray | null = null
    try { m = new RegExp(padrao).exec(resultado) } catch { m = null }
    if (m) {
      resultado = resultado.slice(0, m.index) + e.substituir + resultado.slice(m.index + m[0].length)
      aplicadas++
      continue
    }
    // 3) não bateu → ignora
  }

  // Limpeza pós-remoção: linhas em branco triplas, espaço antes de pontuação,
  // espaços duplos e " ," / " ." remanescentes de trechos apagados.
  resultado = resultado
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +([.,;:!?)])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
  return { texto: resultado, aplicadas }
}
