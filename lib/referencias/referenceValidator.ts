// ============================================================
// CIENTÍFICA AI — Reference Validator
// ============================================================

import type { Referencia, FormatoCitacao } from '@/types'

export type ValidationStatus =
  | 'VALIDATED'
  | 'PARTIALLY_VALIDATED'
  | 'UNVERIFIED'
  | 'REJECTED'

export type ValidationError =
  | 'DOI_INVALID_FORMAT'
  | 'DOI_NOT_FOUND'
  | 'TITLE_MISMATCH'
  | 'AUTHOR_MISMATCH'
  | 'YEAR_MISMATCH'
  | 'MISSING_REQUIRED_FIELDS'
  | 'CITATION_WITHOUT_REFERENCE'
  | 'REFERENCE_NOT_CITED'
  | 'EXTERNAL_VALIDATION_FAILED'

export interface ReferenceValidationResult {
  referenceId: string
  status: ValidationStatus
  errors: ValidationError[]
  warnings: ValidationError[]
  message?: string
  crossrefData?: CrossrefWork | null
  checkedAt: string
}

export interface CitationError {
  citation: string
  error: ValidationError
  message: string
}

export interface ValidationReport {
  totalReferences: number
  validated: number
  partiallyValidated: number
  unverified: number
  rejected: number
  criticalErrors: Array<{ referenceId: string; error: ValidationError; message: string }>
  warnings: Array<{ referenceId: string; error: ValidationError; message: string }>
  citationErrors: CitationError[]
  generatedAt: string
}

export interface ValidatorConfig {
  strictMode: boolean
  titleSimilarityThreshold: number
  authorSimilarityThreshold: number
  useExternalValidation: boolean
  cacheTTLMinutes: number
}

const DEFAULT_CONFIG: ValidatorConfig = {
  strictMode: false,
  titleSimilarityThreshold: 0.80,
  authorSimilarityThreshold: 0.75,
  useExternalValidation: true,
  cacheTTLMinutes: 60 * 24,
}

export interface CrossrefWork {
  DOI: string
  title: string[]
  author?: Array<{ given?: string; family: string }>
  published?: { 'date-parts': number[][] }
  'container-title'?: string[]
}

interface CacheEntry {
  data: CrossrefWork | null
  expiresAt: number
}
const doiCache = new Map<string, CacheEntry>()

function getCached(doi: string): CrossrefWork | null | undefined {
  const entry = doiCache.get(doi)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) { doiCache.delete(doi); return undefined }
  return entry.data
}

function setCache(doi: string, data: CrossrefWork | null, ttlMinutes: number) {
  doiCache.set(doi, { data, expiresAt: Date.now() + ttlMinutes * 60 * 1000 })
}

function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1
  const len1 = s1.length, len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0
  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)
  let matches = 0, transpositions = 0
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist)
    const end = Math.min(i + matchDist + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true; s2Matches[j] = true; matches++; break
    }
  }
  if (matches === 0) return 0
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
}

function textSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  return jaroSimilarity(normalize(a), normalize(b))
}

export function isValidDOIFormat(doi: string): boolean {
  return /^10\.\d{4,}\/\S+/.test(doi.trim())
}

function validateRequiredFields(ref: Referencia): ValidationError[] {
  const errors: ValidationError[] = []
  if (!ref.titulo || ref.titulo.trim().length < 3) errors.push('MISSING_REQUIRED_FIELDS')
  if (!ref.autores || ref.autores.length === 0) errors.push('MISSING_REQUIRED_FIELDS')
  if (!ref.ano) errors.push('MISSING_REQUIRED_FIELDS')
  if (ref.doi && !isValidDOIFormat(ref.doi)) errors.push('DOI_INVALID_FORMAT')
  return errors
}

async function fetchCrossref(doi: string, ttlMinutes: number): Promise<CrossrefWork | null> {
  const cached = getCached(doi)
  if (cached !== undefined) return cached
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CientificaAI/1.0 (mailto:contato@cientifica.ai)' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) { setCache(doi, null, ttlMinutes); return null }
    if (!res.ok) throw new Error(`Crossref HTTP ${res.status}`)
    const json = await res.json()
    const work = json?.message as CrossrefWork
    setCache(doi, work, ttlMinutes)
    return work
  } catch {
    return undefined as unknown as null
  }
}

function compareWithCrossref(ref: Referencia, work: CrossrefWork, config: ValidatorConfig) {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const crossrefTitle = work.title?.[0] ?? ''
  if (crossrefTitle && textSimilarity(ref.titulo, crossrefTitle) < config.titleSimilarityThreshold) {
    warnings.push('TITLE_MISMATCH')
  }
  if (ref.autores?.length && work.author?.length) {
    const localSurname = ref.autores[0].sobrenome.toLowerCase()
    const crossrefSurname = (work.author[0].family ?? '').toLowerCase()
    if (textSimilarity(localSurname, crossrefSurname) < config.authorSimilarityThreshold) {
      warnings.push('AUTHOR_MISMATCH')
    }
  }
  const crossrefYear = work.published?.['date-parts']?.[0]?.[0]
  if (crossrefYear && ref.ano && Math.abs(crossrefYear - ref.ano) > 1) {
    warnings.push('YEAR_MISMATCH')
  }
  return { errors, warnings }
}

export function extractCitations(text: string): string[] {
  const found: string[] = []
  const patterns = [/\[citation:([^\]]+)\]/g, /\[(\d+(?:,\s*\d+)*)\]/g]
  for (const pattern of patterns) {
    const matches = [...text.matchAll(new RegExp(pattern.source, 'g'))]
    matches.forEach(m => {
      const inner = m[1]
      if (inner.includes(',')) inner.split(',').map(s => s.trim()).forEach(c => found.push(c))
      else found.push(inner.trim())
    })
  }
  return [...new Set(found)]
}

export function validateCitations(text: string, references: Referencia[], citationFormat: FormatoCitacao): CitationError[] {
  const errors: CitationError[] = []
  if (citationFormat === 'vancouver') {
    const cited = extractCitations(text)
    const maxIndex = references.length
    cited.forEach(num => {
      const n = parseInt(num, 10)
      if (isNaN(n) || n < 1 || n > maxIndex) {
        errors.push({ citation: `[${num}]`, error: 'CITATION_WITHOUT_REFERENCE', message: `Citação [${num}] não corresponde a nenhuma referência (total: ${maxIndex}).` })
      }
    })
  } else {
    const pattern = /\[citation:([^\]]+)\]/g
    const matches = [...text.matchAll(pattern)]
    const refIds = new Set(references.map(r => r.id))
    matches.forEach(m => {
      const id = m[1].trim()
      if (!refIds.has(id)) {
        errors.push({ citation: `[citation:${id}]`, error: 'CITATION_WITHOUT_REFERENCE', message: `Citação [citation:${id}] não possui referência correspondente.` })
      }
    })
  }
  return errors
}

export async function validateReference(ref: Referencia, config: Partial<ValidatorConfig> = {}): Promise<ReferenceValidationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const localErrors = validateRequiredFields(ref)
  if (localErrors.includes('MISSING_REQUIRED_FIELDS') && !ref.titulo) {
    return { referenceId: ref.id, status: 'REJECTED', errors: localErrors, warnings: [], message: 'Campos obrigatórios ausentes.', checkedAt: new Date().toISOString() }
  }
  if (localErrors.includes('DOI_INVALID_FORMAT')) {
    return { referenceId: ref.id, status: 'REJECTED', errors: ['DOI_INVALID_FORMAT'], warnings: [], message: `DOI inválido: "${ref.doi}"`, checkedAt: new Date().toISOString() }
  }
  if (!ref.doi || !cfg.useExternalValidation) {
    return { referenceId: ref.id, status: localErrors.length === 0 ? 'UNVERIFIED' : 'PARTIALLY_VALIDATED', errors: localErrors, warnings: [], message: ref.doi ? 'Validação externa desabilitada.' : 'Sem DOI — não verificável externamente.', checkedAt: new Date().toISOString() }
  }
  let crossrefData: CrossrefWork | null = null
  let externalFailed = false
  try { crossrefData = await fetchCrossref(ref.doi, cfg.cacheTTLMinutes) } catch { externalFailed = true }
  if (externalFailed) {
    return { referenceId: ref.id, status: 'UNVERIFIED', errors: ['EXTERNAL_VALIDATION_FAILED'], warnings: [], message: 'Falha na conexão com Crossref.', checkedAt: new Date().toISOString() }
  }
  if (crossrefData === null) {
    return { referenceId: ref.id, status: 'REJECTED', errors: ['DOI_NOT_FOUND'], warnings: [], message: `DOI "${ref.doi}" não encontrado no Crossref.`, crossrefData: null, checkedAt: new Date().toISOString() }
  }
  const { errors: compErrors, warnings: compWarnings } = compareWithCrossref(ref, crossrefData, cfg)
  const allErrors = [...localErrors, ...compErrors]
  const status: ValidationStatus = allErrors.length === 0 && compWarnings.length === 0 ? 'VALIDATED' : allErrors.length > 0 ? 'REJECTED' : 'PARTIALLY_VALIDATED'
  return { referenceId: ref.id, status, errors: allErrors, warnings: compWarnings, message: status === 'VALIDATED' ? 'Validada com sucesso.' : status === 'PARTIALLY_VALIDATED' ? 'Parcialmente validada.' : 'Rejeitada.', crossrefData, checkedAt: new Date().toISOString() }
}

export async function validateAllReferences(references: Referencia[], text: string, citationFormat: FormatoCitacao, config: Partial<ValidatorConfig> = {}): Promise<ValidationReport> {
  const results: ReferenceValidationResult[] = []
  for (const ref of references) {
    const result = await validateReference(ref, config)
    results.push(result)
    if (ref.doi && config.useExternalValidation !== false) await new Promise(r => setTimeout(r, 100))
  }
  const citationErrors = validateCitations(text, references, citationFormat)
  return {
    totalReferences: references.length,
    validated: results.filter(r => r.status === 'VALIDATED').length,
    partiallyValidated: results.filter(r => r.status === 'PARTIALLY_VALIDATED').length,
    unverified: results.filter(r => r.status === 'UNVERIFIED').length,
    rejected: results.filter(r => r.status === 'REJECTED').length,
    criticalErrors: results.filter(r => r.status === 'REJECTED').map(r => ({ referenceId: r.referenceId, error: r.errors[0], message: r.message ?? '' })),
    warnings: results.filter(r => r.warnings.length > 0).flatMap(r => r.warnings.map(w => ({ referenceId: r.referenceId, error: w, message: `${r.referenceId}: ${w}` }))),
    citationErrors,
    generatedAt: new Date().toISOString(),
  }
}

export function buildReferenceGuardrail(references: Referencia[], results: ReferenceValidationResult[], strictMode = false): string {
  const allowedStatuses: ValidationStatus[] = strictMode ? ['VALIDATED', 'PARTIALLY_VALIDATED'] : ['VALIDATED', 'PARTIALLY_VALIDATED', 'UNVERIFIED']
  const allowed = references.filter(ref => {
    const result = results.find(r => r.referenceId === ref.id)
    return result ? allowedStatuses.includes(result.status) : !strictMode
  })
  const refList = allowed.map((r, i) => `[${i + 1}] ${r.titulo} — ${r.autores?.map(a => a.sobrenome).join('; ') ?? ''} (${r.ano ?? 'sem ano'})`).join('\n')
  return `BIBLIOTECA DE REFERÊNCIAS VALIDADAS (${allowed.length} referências):\n${refList}\n\nREGRA OBRIGATÓRIA: Use APENAS as referências listadas acima.\nNão invente autores, títulos, DOI, PMID, leis, normas ou fontes.\nQuando precisar de referência não disponível, escreva: [REFERÊNCIA NECESSÁRIA]`.trim()
}
