/**
 * Validação de citações contra a lista REAL de referências cadastradas.
 *
 * Garante que NENHUMA citação inventada sobreviva no texto final. Toda citação
 * autor-ano cujo sobrenome não corresponda a uma referência real (ou a um autor
 * institucional reconhecido) é convertida no marcador genérico (SOBRENOME, ANO).
 *
 * Esta é a camada final de defesa: mesmo que a IA ou o humanizador inventem um
 * nome de autor plausível (ex: "Lombardi, 1978"), ele é capturado aqui porque
 * não existe na lista de referências reais do trabalho.
 */

import type { Referencia, FormatoCitacao } from '@/types'
import { citacaoInTexto } from '@/lib/referencias/formatar'
import { ehSobrenomePlaceholder, ehReferenciaUtilizavel } from '@/lib/referencias/qualidade'

// Contexto de software/ferramenta estatística: nessas frases um placeholder de
// citação NÃO deve ser preenchido com uma referência da biblioteca (seria
// inventar a associação). Programas citam-se com sua referência canônica própria
// (ex.: R → "R Core Team"), tratada à parte.
const CONTEXTO_SOFTWARE = /\b(software|programa estat[íi]stico|pacote estat[íi]stico|vers[ãa]o do|core team|rstudio|\bspss\b|\bstata\b|\bsas\b|jamovi|jasp|graphpad|prism|minitab|matlab|epi\s?info|redcap|\bpython\b|linguagem r\b|ambiente r\b|software r\b|programa r\b|\bno r\b)/i

// Palavras irrelevantes para casar tema da frase × título da referência
const STOPWORDS = new Set([
  'de','da','do','das','dos','para','com','por','uma','que','os','as','na','no',
  'em','ou','um','ao','aos','sua','seu','entre','sobre','como','mais','foi','são',
  'the','of','and','in','on','for','with','from','this','that','study','review',
  'analysis','based','using','among','effect','effects','clinical','patients',
])

function palavrasChave(texto: string): Set<string> {
  return new Set(
    normalizar(texto)
      .toLowerCase()
      .split(/[^a-zà-ÿ]+/i)
      .filter(p => p.length >= 4 && !STOPWORDS.has(p))
  )
}

/**
 * Rede de segurança final: remove qualquer placeholder de citação que tenha
 * sobrado no texto (ex.: "(SOBRENOME, ANO)" sem referência adequada). Um
 * placeholder NUNCA deve aparecer no documento final — melhor a frase sem a
 * citação do que com o marcador visível.
 */
export function removerPlaceholdersCitacaoResiduais(texto: string): string {
  if (!texto) return texto
  return texto
    .replace(/\(\s*SOBRENOME\s*,?\s*ANO\s*\)/gi, '')
    .replace(/ +([.,;:)])/g, '$1')   // espaço antes de pontuação
    .replace(/\(\s*\)/g, '')          // parênteses vazios
    .replace(/[ \t]{2,}/g, ' ')       // espaços duplos
}

/**
 * Substitui cada placeholder "(SOBRENOME, ANO)" por uma citação REAL da lista de
 * referências, escolhendo a mais próxima do tema da frase e variando as fontes
 * (evita repetir sempre a mesma). É o que um pesquisador faz: "preciso de uma
 * citação aqui — qual das minhas referências melhor embasa isto?".
 *
 * Só atua quando há referências citáveis. Sem referências, o placeholder
 * permanece (sinalizando ao usuário que falta cadastrar fontes). Não mexe em
 * Vancouver (numérico, tratado à parte).
 */
export function substituirPlaceholdersPorReais(
  texto: string,
  referencias: Referencia[],
  formato: FormatoCitacao = 'abnt',
): string {
  if (formato === 'vancouver') return texto
  // Só preenche placeholders com referências UTILIZÁVEIS (autor real, registro
  // original) — nunca com "&NA;"/recomendação/errata.
  const citaveis = referencias.filter(r =>
    (r.autores?.[0]?.sobrenome?.trim().length ?? 0) > 1 && !!r.ano && ehReferenciaUtilizavel(r))
  if (citaveis.length === 0) return texto

  const refsInfo = citaveis.map(r => ({ r, kws: palavrasChave(r.titulo ?? '') }))
  const usos = new Array(refsInfo.length).fill(0)

  const PLACEHOLDER = /\(SOBRENOME,\s*ANO\)/g
  let resultado = ''
  let lastIndex = 0
  let m: RegExpExecArray | null
  let houveRemocao = false
  while ((m = PLACEHOLDER.exec(texto)) !== null) {
    // Contexto = SOMENTE a frase atual (do último ponto final até o placeholder),
    // para não vazar palavras da frase anterior e repetir a mesma referência.
    const janela = texto.slice(Math.max(0, m.index - 240), m.index)
    const ctx = janela.split(/[.!?]\s+/).pop() ?? janela

    // ANTI-FABRICAÇÃO (contexto de software/ferramenta): menções a programas
    // estatísticos NÃO se citam com referência bibliográfica da biblioteca (o R,
    // por ex., cita-se como "R Core Team"). Inserir uma referência qualquer aqui
    // inventaria a associação (ex.: "R" → YAMADA, 1984). Nesses casos REMOVEMOS o
    // placeholder em vez de preencher.
    if (CONTEXTO_SOFTWARE.test(ctx)) {
      resultado += texto.slice(lastIndex, m.index)
      houveRemocao = true
      lastIndex = m.index + m[0].length
      continue
    }

    const ctxKws = palavrasChave(ctx)
    let melhor = 0
    let melhorScore = -Infinity
    for (let k = 0; k < refsInfo.length; k++) {
      let overlap = 0
      for (const w of refsInfo[k].kws) if (ctxKws.has(w)) overlap++
      // relevância domina; menos usos desempata (garante diversidade)
      const score = overlap * 100 - usos[k]
      if (score > melhorScore) { melhorScore = score; melhor = k }
    }
    resultado += texto.slice(lastIndex, m.index) + citacaoInTexto(refsInfo[melhor].r, formato)
    usos[melhor]++
    lastIndex = m.index + m[0].length
  }
  resultado += texto.slice(lastIndex)
  // Limpa a pontuação/espaços deixados pela remoção de placeholders de software
  // (ex.: "no software R ." → "no software R.").
  if (houveRemocao) {
    resultado = resultado
      .replace(/ +([.,;:)])/g, '$1')   // espaço antes de pontuação
      .replace(/\(\s*\)/g, '')          // parênteses vazios remanescentes
      .replace(/[ \t]{2,}/g, ' ')       // espaços duplos
  }
  return resultado
}

// Autores institucionais reconhecidos — sempre válidos mesmo sem referência cadastrada
const AUTORES_INSTITUCIONAIS = new Set([
  'BRASIL', 'WHO', 'OMS', 'MS', 'OPAS', 'PAHO', 'CDC', 'NIH', 'FDA', 'EMA',
  'CFM', 'COFEN', 'CFO', 'CFF', 'CREFITO', 'CFP', 'CFESS', 'CFN', 'CRMV',
  'ANVISA', 'CONITEC', 'CONASS', 'CONASEMS', 'FIOCRUZ', 'IBGE', 'IPEA',
  'INEP', 'MEC', 'CAPES', 'CNPQ', 'FAPESP', 'CNS', 'CONEP', 'CONAMA',
  'EMBRAPA', 'CONAB', 'MAPA', 'INMET', 'ANA', 'ICMBIO', 'IBAMA', 'INPE',
  'ABNT', 'ISO', 'IEEE', 'ASTM', 'IUPAC', 'SBD', 'SBC', 'SBPT', 'AMB',
  'STF', 'STJ', 'TST', 'TSE', 'CNJ', 'CNMP', 'OAB', 'BACEN', 'CVM', 'CONAR',
  'UNESCO', 'UNICEF', 'ONU', 'FAO', 'OIT', 'OCDE', 'BANCO MUNDIAL',
])

/** Extrai sobrenomes válidos (primeiro autor) da lista de referências reais. */
function sobrenomesValidos(referencias: Referencia[]): Set<string> {
  const set = new Set<string>()
  const conectores = new Set(['DA', 'DE', 'DO', 'DOS', 'DAS', 'E', 'DI', 'DEL', 'VAN', 'VON'])
  for (const ref of referencias) {
    for (const autor of (ref.autores ?? []).slice(0, 3)) {
      const sob = autor?.sobrenome
      if (!sob) continue
      const n = normalizar(sob)
      set.add(n)
      // Também adiciona cada palavra significativa do sobrenome composto
      // (ex: "MULIK DEVIKA BHIVGADE" → MULIK, DEVIKA, BHIVGADE) para que a IA
      // possa citar por qualquer parte sem ser convertida em placeholder.
      for (const parte of n.split(/\s+/)) {
        if (parte.length >= 4 && !conectores.has(parte)) set.add(parte)
      }
    }
  }
  return set
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toUpperCase()
    .trim()
}

/**
 * Valida e corrige as citações autor-ano de um texto.
 * @param texto       texto gerado pela IA
 * @param referencias lista real de referências cadastradas
 * @param formato     formato de citação escolhido (não converte Vancouver numérico)
 * @returns texto com citações inventadas substituídas pelo placeholder
 */
/**
 * Corrige o formato híbrido errado de citação ABNT:
 *   "GAN; GOLDBERG (2018)"  → "(GAN; GOLDBERG, 2018)"   (autor em maiúsculas com ano fora)
 *   "JOHNSON et al. (1997)" → "(JOHNSON et al., 1997)"
 * Não toca em citações narrativas corretas (autor em minúsculas: "Silva (2020)")
 * nem em citações já parentéticas: "(SILVA, 2020)".
 */
export function normalizarFormatoCitacoesAbnt(texto: string): string {
  return texto.replace(
    // Sobrenome(s) em MAIÚSCULAS, opcionalmente com "; SOBRENOME" e "et al.", seguido de (ANO)
    /(?<![(\wÀ-ÿ])([A-ZÀ-Ý][A-ZÀ-Ý]+(?:\s*;\s*[A-ZÀ-Ý][A-ZÀ-Ý]+)*(?:\s+et\s+al\.?)?)\s+\(((?:19|20)\d{2}[a-z]?)\)/g,
    (_match, autor, ano) => `(${autor.trim()}, ${ano})`
  )
}

/**
 * REGRA RÍGIDA 1 — Normaliza TODO placeholder para a forma canônica "(SOBRENOME, ANO)".
 * Captura todos os híbridos errados onde o autor é placeholder mas o ano é real/inventado:
 *   "(SOBRENOME, 2024)" → "(SOBRENOME, ANO)"
 *   "(SOBRENOME et al., 2019)" → "(SOBRENOME, ANO)"
 *   "(AUTOR, 2023)" → "(SOBRENOME, ANO)"
 *   "SOBRENOME (2024)" → "(SOBRENOME, ANO)"
 *   "[AUTOR, ANO]" / "(autor, ano)" → "(SOBRENOME, ANO)"
 * E também remove um nome solto que tenha ficado ANTES de um placeholder:
 *   "Mulik Devika (SOBRENOME, ANO)" → "(SOBRENOME, ANO)"
 */
export function normalizarPlaceholders(texto: string): string {
  let t = texto
  // Parentético com autor-placeholder + qualquer ano (real ou ANO)
  t = t.replace(/\(\s*(?:SOBRENOME|AUTOR)(?:\s+et\s+al\.?)?(?:\s*;\s*(?:SOBRENOME|AUTOR))*\s*,\s*[^)]*\)/gi, '(SOBRENOME, ANO)')
  // Colchetes: [AUTOR, ANO] / [SOBRENOME, 2020]
  t = t.replace(/\[\s*(?:SOBRENOME|AUTOR)\s*,\s*[^\]]*\]/gi, '(SOBRENOME, ANO)')
  // Narrativo: SOBRENOME (2024) / AUTOR (ANO) / SOBRENOME et al. (2024)
  t = t.replace(/\b(?:SOBRENOME|AUTOR)(?:\s+et\s+al\.?)?\s*\([^)]*\)/gi, '(SOBRENOME, ANO)')
  // (Removido) Não apagar palavras capitalizadas antes do placeholder: a regra
  // antiga engolia conteúdo real ("Norte e Nordeste (SOBRENOME, ANO)" perdia
  // "Nordeste"). O placeholder é resolvido pelo preenchedor ou removido pela
  // rede de segurança, sem destruir o texto.
  // Colapsa placeholders duplicados consecutivos
  t = t.replace(/\(SOBRENOME,\s*ANO\)(\s*\(SOBRENOME,\s*ANO\))+/g, '(SOBRENOME, ANO)')
  return t
}

/**
 * Para Vancouver: renumera as citações [N] no texto conforme a ordem real
 * de aparecimento das referências na lista ordenada.
 *
 * A IA gera [1], [2], [3] arbitrariamente. Esta função:
 * 1. Percorre o texto da esquerda para a direita
 * 2. Cada sobrenome de referência citável recebe um número sequencial
 *    na primeira aparição
 * 3. Reutiliza o mesmo número em aparições subsequentes
 *
 * Como o texto Vancouver não tem sobrenomes — só números — esta função
 * apenas garante que os números sejam sequenciais de 1 a N sem gaps.
 */
export function resolverCitacoesVancouver(texto: string, totalRefs: number): string {
  if (totalRefs === 0) return texto

  const mapa = new Map<number, number>() // número antigo → número novo
  let proximoNumero = 1
  // Primeira passagem: mapeia números existentes para sequência correta
  const resultado = texto.replace(/\[(\d+)\]/g, (match, numStr) => {
    const num = parseInt(numStr, 10)
    if (num < 1 || num > totalRefs * 3) return match // ignora números absurdos
    if (!mapa.has(num)) {
      mapa.set(num, proximoNumero++)
    }
    return `[${mapa.get(num)}]`
  })
  return resultado
}

/**
 * Remove o travessão "—" (em-dash) usado como aposto/separador entre palavras —
 * é uma das marcas mais fortes de texto de IA e não pertence ao registro formal
 * ABNT. Converte para vírgula. Preserva intervalos numéricos com en-dash sem
 * espaços (ex.: "2015–2020"); só troca en-dash quando cercado por espaços.
 */
export function removerTravessoes(texto: string): string {
  if (!texto) return texto
  return texto
    .replace(/\s*—\s*/g, ', ')   // em-dash (U+2014) → vírgula
    .replace(/\s+–\s+/g, ', ')   // en-dash (U+2013) com espaços = separador → vírgula
    .replace(/ +,/g, ',')        // " ," → ","
    .replace(/,\s*,/g, ',')      // ",," → ","
    // Garante espaço após a vírgula, MAS preserva vírgula decimal (ex.: 204,5):
    // não insere espaço quando a vírgula está entre dígitos.
    .replace(/,(?=\S)/g, (_m: string, offset: number, str: string) =>
      /\d/.test(str[offset - 1] ?? '') && /\d/.test(str[offset + 1] ?? '') ? ',' : ', ')
    .replace(/,\s+\./g, '.')     // ", ." → "."
}

export function validarCitacoesReais(
  texto: string,
  referencias: Referencia[],
  formato: FormatoCitacao = 'abnt',
): string {
  // Remove travessões "—" (marca de IA / fora da norma ABNT) em qualquer formato
  texto = removerTravessoes(texto)

  // Vancouver usa [1], [2] — renumera sequencialmente conforme a ordem de aparição
  if (formato === 'vancouver') {
    const textoNormalizado = normalizarPlaceholders(texto)
    return resolverCitacoesVancouver(textoNormalizado, referencias.length)
  }

  // REGRA RÍGIDA 1: normaliza todos os placeholders para "(SOBRENOME, ANO)"
  texto = normalizarPlaceholders(texto)

  // REGRA RÍGIDA 2: corrige o formato híbrido (maiúsculas + ano fora dos parênteses)
  if (formato === 'abnt') texto = normalizarFormatoCitacoesAbnt(texto)

  const validos = sobrenomesValidos(referencias)

  function ehValido(sobrenome: string): boolean {
    const n = normalizar(sobrenome)
    if (!n || n.length < 2) return false
    if (n === 'SOBRENOME') return true            // placeholder genérico — sempre ok
    // Autor-placeholder (ex.: "NA", "&NA;", "Anonymous") NUNCA é citação válida,
    // mesmo que conste na biblioteca — vira (SOBRENOME, ANO) e é tratado depois.
    if (ehSobrenomePlaceholder(sobrenome)) return false
    if (AUTORES_INSTITUCIONAIS.has(n)) return true
    if (validos.has(n)) return true
    // Sobrenome composto: testa cada parte (ex: "DA SILVA PIRES" → "PIRES")
    const partes = n.split(/\s+/).filter(p => p.length > 2 && !['DA', 'DE', 'DO', 'DOS', 'DAS', 'E'].includes(p))
    return partes.some(p => validos.has(p))
  }

  let resultado = texto

  // ── 1. Citações parentéticas: (SOBRENOME, ANO) / (S; S, ANO) / (S et al., ANO) ──
  resultado = resultado.replace(
    /\(([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s;.]{1,60}?)(?:\s+et\s+al\.?)?,\s*((?:19|20)\d{2}[a-z]?|s\.?\s*d\.?)\)/g,
    (match, autoresParte) => {
      // Pega o primeiro sobrenome do grupo de autores
      const primeiroAutor = autoresParte.split(/[;,]/)[0].replace(/\s+et\s+al\.?/i, '').trim()
      if (ehValido(primeiroAutor)) return match
      return '(SOBRENOME, ANO)'
    }
  )

  // ── 2. Citações narrativas: Sobrenome (ANO) / Sobrenome et al. (ANO) ──────────
  resultado = resultado.replace(
    /\b([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+(?:e|&|;)\s+[A-ZÀ-Ý][a-zà-ÿ]+)?(?:\s+et\s+al\.?)?)\s*\(((?:19|20)\d{2}[a-z]?|s\.?\s*d\.?)\)/g,
    (match, autorParte) => {
      const primeiroAutor = autorParte.replace(/\s+et\s+al\.?/i, '').split(/\s+(?:e|&|;)\s+/)[0].trim()
      if (ehValido(primeiroAutor)) return match
      return '(SOBRENOME, ANO)'
    }
  )

  // REGRA RÍGIDA FINAL: re-normaliza para colapsar placeholders adjacentes e
  // remover nomes soltos que a conversão acima possa ter deixado.
  resultado = normalizarPlaceholders(resultado)

  // ETAPA FINAL: troca os placeholders restantes por referências REAIS da lista
  // (quando existirem). Assim o texto não fica com "(SOBRENOME, ANO)" visível.
  resultado = substituirPlaceholdersPorReais(resultado, referencias, formato)

  return resultado
}

/**
 * Conta quantas citações reais (válidas, não-placeholder) existem no texto.
 * Útil para avisar o usuário se o texto ficou sem citações reais.
 */
export function contarCitacoesReais(texto: string): { reais: number; placeholders: number } {
  const placeholders = (texto.match(/\(SOBRENOME,\s*ANO\)/gi) ?? []).length
  const todasParenteticas = (texto.match(/\([A-Za-zÀ-ÿ][^)]{1,60}?,\s*(?:19|20)\d{2}[a-z]?\)/g) ?? []).length
  const todasNarrativas = (texto.match(/\b[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+et\s+al\.?)?\s*\((?:19|20)\d{2}[a-z]?\)/g) ?? []).length
  return { reais: Math.max(0, todasParenteticas + todasNarrativas - placeholders), placeholders }
}
