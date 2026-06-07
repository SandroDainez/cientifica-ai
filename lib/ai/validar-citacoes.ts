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
  // Nome próprio solto imediatamente antes de um placeholder (resíduo de citação quebrada)
  t = t.replace(/\b(?:[A-ZÀ-Ý][a-zà-ÿ]+\s+){1,3}\(SOBRENOME,\s*ANO\)/g, '(SOBRENOME, ANO)')
  // Colapsa placeholders duplicados consecutivos
  t = t.replace(/\(SOBRENOME,\s*ANO\)(\s*\(SOBRENOME,\s*ANO\))+/g, '(SOBRENOME, ANO)')
  return t
}

export function validarCitacoesReais(
  texto: string,
  referencias: Referencia[],
  formato: FormatoCitacao = 'abnt',
): string {
  // Vancouver usa [1], [2] — validação numérica é tratada à parte; não mexe aqui
  if (formato === 'vancouver') {
    // Mesmo em Vancouver, garante que placeholders fiquem canônicos
    return normalizarPlaceholders(texto)
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
