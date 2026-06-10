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

/**
 * Verdadeiro quando o apontamento é PREFERÊNCIA DE ESTILO que a calibração do revisor
 * já PROÍBE (frase longa "dividir em frases", troca de palavra "uso impreciso / termo
 * mais adequado / soaria melhor"). NÃO dispara em erro REAL (repetição, redundância,
 * concordância, gramática, ortografia, pontuação, acentuação) — esses continuam.
 */
export function ehPreferenciaEstilo(p: ApontamentoMinimo): boolean {
  if ((p.categoria ?? '') !== 'linguagem') return false
  const txt = `${p.problema ?? ''} ${p.sugestao ?? ''}`.toLowerCase()
  // ERRO REAL — nunca tratar como estilo: repetição/redundância, gramática/ortografia,
  // e afirmação SEM SUPORTE (essa pede citação, é problema legítimo).
  if (/repeti|redund|concord|gram[aá]|ortog|grafia|acentua|pontua[çc]|sem (suporte|fundament|apoio|cita)|sem fonte/.test(txt)) return false
  const fraseLonga = /frase (muito )?longa|per[ií]odo (muito )?longo|dividir em (duas|mais|v[áa]rias) frases|m[uú]ltiplas (ora[çc][õo]es )?subordinadas|prejudica(ndo)? a (clareza|fluidez|flu[êe]ncia)/.test(txt)
  const escolhaPalavra = /uso impreciso|termo mais (preciso|adequado|espec[ií]fico)|seria mais adequado|palavra mais (precisa|adequada)|soaria melhor|poderia ser mais (clar|precis|espec[ií]fic|fluid|detalhad)/.test(txt)
  // "Poderia ser mais específico/detalhado" disfarçado: frase genérica/vaga, ser mais
  // específico, não adiciona informação. A calibração proíbe — é gosto, não erro.
  const vagueza = /(frase|afirma[çc][ãa]o|express[ãa]o) (muito )?(gen[ée]rica|vaga)|muito gen[ée]rica|ser mais espec[ií]fic|especificar melhor|n[ãa]o adiciona informa[çc][ãa]o|mais detalhad|pouco espec[ií]fic/.test(txt)
  return fraseLonga || escolhaPalavra || vagueza
}

/** Normaliza para casamento tolerante (caixa, aspas curvas/retas, travessões, espaços). */
function normalizarMatch(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’“”'"]/g, '"')
    .replace(/[-–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Verdadeiro se o `trecho` aparece (tolerante) no `texto` do trabalho. Trechos curtos
 * (< 15 chars normalizados) não são validados — retorna true para não descartar à toa.
 * Trecho substancial AUSENTE = o revisor citou errado/alucinou → o corretor não acha
 * para corrigir e o apontamento é provável falso-positivo: deve ser descartado.
 */
export function trechoExisteNoTexto(trecho: string, texto: string): boolean {
  const t = normalizarMatch(trecho)
  if (t.length < 15) return true
  return normalizarMatch(texto).includes(t)
}

/**
 * Remove falsos-positivos da lista: (1) formatação de referência, (2) data atual
 * marcada como inconsistência, e — quando `textoTrabalho` é dado — (3) apontamentos
 * cujo TRECHO não existe no texto (citação errada/alucinada → incorrigível).
 */
export function filtrarApontamentos<T extends ApontamentoMinimo>(problemas: T[], textoTrabalho?: string): T[] {
  return problemas.filter(p => {
    if (ehFalsoPositivoFormatacaoReferencia(p)) return false
    if (ehFalsoPositivoDataAtual(p)) return false
    if (ehPreferenciaEstilo(p)) return false
    if (textoTrabalho && (p.trecho?.trim().length ?? 0) >= 15 && !trechoExisteNoTexto(p.trecho ?? '', textoTrabalho)) return false
    return true
  })
}
