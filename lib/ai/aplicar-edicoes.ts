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

/**
 * Verifica se uma reescrita do texto inteiro é SEGURA de aplicar — para a IA
 * NUNCA piorar o trabalho. Rejeita quando:
 *  - resposta vazia ou idêntica (não aplica nada de útil);
 *  - perdeu citações (anos 19xx/20xx ou marcadores [N] sumiram);
 *  - cresceu demais (risco de conteúdo/parágrafos inventados).
 * NÃO exige tamanho mínimo (remoções legítimas encolhem o texto).
 */
export function reescritaSegura(original: string, novo: string): { ok: boolean; motivo: string } {
  const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim()
  const o = norm(original)
  const n = norm(novo)
  if (!n) return { ok: false, motivo: 'resposta vazia' }
  if (n === o) return { ok: false, motivo: 'a IA não sugeriu mudança' }

  const palavras = (s: string) => (s ? s.split(' ').length : 0)
  const wO = palavras(o)
  const wN = palavras(n)
  if (wO > 0 && wN > wO * 1.6) return { ok: false, motivo: 'o texto cresceu demais (risco de conteúdo inventado)' }

  const anos = (s: string) => (s.match(/(?:19|20)\d{2}/g) ?? []).length
  const vanc = (s: string) => (s.match(/\[\s*\d+/g) ?? []).length
  if (anos(n) < anos(o)) return { ok: false, motivo: 'a reescrita perdeu citações (anos)' }
  if (vanc(n) < vanc(o)) return { ok: false, motivo: 'a reescrita perdeu citações numéricas' }

  return { ok: true, motivo: '' }
}

/**
 * Segurança de UMA edição cirúrgica (buscar→substituir) na Revisão Avançada.
 * Diferente de `reescritaSegura`: aqui REMOVER uma citação é legítimo (corrigir
 * ou retirar referência ruim / ano fabricado), então NÃO bloqueamos perda. O que
 * bloqueamos é FABRICAÇÃO e invenção de conteúdo:
 *  - "buscar" curto demais (<3) → casaria em qualquer lugar;
 *  - "substituir" idêntico ao "buscar" → não muda nada;
 *  - "substituir" cresce demais vs "buscar" → risco de parágrafo inventado;
 *  - "substituir" introduz ano (19xx/20xx) ou marcador [N] ausente no "buscar".
 * Remoção (substituir vazio) é sempre permitida.
 */
export function edicaoSeguraCirurgica(buscar: string, substituir: string): { ok: boolean; motivo: string } {
  if (typeof buscar !== 'string' || typeof substituir !== 'string') return { ok: false, motivo: 'tipos inválidos' }
  const b = buscar.trim()
  if (b.length < 3) return { ok: false, motivo: 'trecho curto demais' }
  if (substituir === buscar) return { ok: false, motivo: 'sem mudança' }
  const s = substituir.trim()
  if (s.length === 0) return { ok: true, motivo: '' } // remoção legítima

  const wB = b.split(/\s+/).length
  const wS = s.split(/\s+/).length
  if (wS > wB * 2.2 + 12) return { ok: false, motivo: 'a substituição cresceu demais (risco de invenção)' }

  const anosNovos = (s.match(/(?:19|20)\d{2}/g) ?? []).filter(a => !b.includes(a))
  if (anosNovos.length > 0) return { ok: false, motivo: 'introduziria citação (ano) inexistente no trecho' }
  const marcadores = (t: string) => (t.match(/\[\s*\d+\s*\]/g) ?? []).length
  if (marcadores(s) > marcadores(b)) return { ok: false, motivo: 'introduziria citação numérica nova' }

  return { ok: true, motivo: '' }
}

/**
 * Segurança de uma REVISÃO PROFUNDA (seção inteira reescrita). Diferente de
 * `reescritaSegura`: aqui CRESCER é desejável (aprofundar com fontes) e PERDER
 * citação ruim é legítimo. Bloqueamos só os extremos que indicam dano:
 *  - resultado vazio ou idêntico (nada a salvar);
 *  - encolheu demais (< 40% das palavras → risco de ter perdido conteúdo real);
 *  - inchou demais (> 3x as palavras → risco de enrolação/invenção).
 * A trava anti-fabricação de citações é o posProcessarTextoGerado (aplicado fora).
 */
export function revisaoProfundaSegura(original: string, novo: string): { ok: boolean; motivo: string } {
  const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim()
  const o = norm(original)
  const n = norm(novo)
  if (!n) return { ok: false, motivo: 'resposta vazia' }
  if (n === o) return { ok: false, motivo: 'sem mudança' }
  const palavras = (s: string) => (s ? s.split(' ').length : 0)
  const wO = palavras(o)
  const wN = palavras(n)
  if (wO >= 40 && wN < wO * 0.4) return { ok: false, motivo: 'a reescrita encolheu demais (risco de perder conteúdo)' }
  if (wO > 0 && wN > wO * 3) return { ok: false, motivo: 'a reescrita inchou demais (risco de enrolação/invenção)' }
  return { ok: true, motivo: '' }
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

    // 2) match tolerante a espaços/quebras de linha E a aspas/travessões
    // (o revisor costuma devolver o trecho com aspas curvas "…" e o texto tem
    // aspas retas, ou vice-versa — sem isso o casamento falhava e nada aplicava).
    const alvo = e.buscar.trim()
    if (alvo.length < 1) continue
    const padrao = escapeRegex(alvo)
      .replace(/\s+/g, '\\s+')
      .replace(/["“”]/g, '["“”]')      // qualquer aspa dupla
      .replace(/['‘’]/g, "['‘’]")      // qualquer aspa simples/apóstrofo
      .replace(/[-–—]/g, '[-–—]')      // qualquer hífen/travessão
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
