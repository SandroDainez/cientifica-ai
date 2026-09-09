import type { EthicsRoute, ResearchProjectState } from './types'
import { routeEthics } from './ethics-router'

export type RegulatoryEvidenceStatus = 'registrado' | 'verificado' | 'revogado'

export interface RegulatoryDocumentIntegrity {
  bucket: string
  path: string
  fileName: string
  mimeType: string
  size: number
  sha256: string
  uploadedAt: string
}

export interface RegulatoryEvidenceEntry {
  id: string
  route: EthicsRoute
  status: RegulatoryEvidenceStatus
  identifier: string
  issuer?: string
  documentReference?: string
  document?: RegulatoryDocumentIntegrity
  issuedAt?: string
  expiresAt?: string
  verifiedAt?: string
  notes?: string
}

export interface RegulatoryEvidenceRegistry {
  version: 1
  updatedAt: string
  entries: RegulatoryEvidenceEntry[]
}

export interface RegulatoryEvidenceValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const ROUTES_REQUIRING_EVIDENCE = new Set<EthicsRoute>([
  'cep_conep_plataforma_brasil',
  'ceua_concea',
  'registro_ensaio_clinico',
  'consentimento_publicacao_caso',
])

const SHA256_RE = /^[a-f0-9]{64}$/i

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text || undefined
}

function validDocument(document: RegulatoryDocumentIntegrity | undefined): boolean {
  return Boolean(
    document
      && clean(document.bucket)
      && clean(document.path)
      && clean(document.fileName)
      && clean(document.mimeType)
      && Number.isFinite(document.size)
      && document.size > 0
      && SHA256_RE.test(document.sha256)
      && clean(document.uploadedAt),
  )
}

export function requiredRegulatoryEvidenceRoutes(state: ResearchProjectState): EthicsRoute[] {
  const decision = routeEthics(state.regulatory, state.studyDesign)
  if (decision.blockers.length > 0) return []
  return decision.routes.filter(route => ROUTES_REQUIRING_EVIDENCE.has(route))
}

export function validateRegulatoryEvidenceEntry(
  entry: RegulatoryEvidenceEntry,
  state: ResearchProjectState,
): RegulatoryEvidenceValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const allowedRoutes = new Set(requiredRegulatoryEvidenceRoutes(state))

  if (!allowedRoutes.has(entry.route)) {
    errors.push(`A rota ${entry.route} não é exigida pelo estado científico/regulatório atual do projeto.`)
  }
  if (!clean(entry.identifier)) errors.push('Informe um identificador real da aprovação/registro/consentimento.')
  if (entry.status === 'verificado' && !clean(entry.verifiedAt)) {
    errors.push('Evidência marcada como verificada precisa registrar verifiedAt.')
  }
  if (entry.status === 'verificado' && !validDocument(entry.document)) {
    errors.push('Evidência regulatória só pode ser verificada quando houver documento privado com SHA-256, tamanho, tipo e caminho de storage registrados.')
  }
  if (entry.status === 'verificado' && entry.document && entry.documentReference !== entry.document.path) {
    errors.push('A referência documental precisa apontar exatamente para o documento íntegro registrado no storage.')
  }
  if (entry.expiresAt && entry.issuedAt && entry.expiresAt < entry.issuedAt) {
    errors.push('A data de expiração não pode ser anterior à data de emissão.')
  }
  if (entry.status === 'registrado' && validDocument(entry.document) && !clean(entry.verifiedAt)) {
    warnings.push('Documento íntegro registrado, mas a evidência ainda não foi marcada como verificada.')
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function sanitizeRegulatoryEvidenceEntry(
  raw: Partial<RegulatoryEvidenceEntry>,
  state: ResearchProjectState,
  now = new Date().toISOString(),
): RegulatoryEvidenceEntry {
  const route = raw.route as EthicsRoute
  const status: RegulatoryEvidenceStatus = raw.status === 'verificado' || raw.status === 'revogado' ? raw.status : 'registrado'
  const document = raw.document && typeof raw.document === 'object'
    ? {
        bucket: clean(raw.document.bucket) ?? '',
        path: clean(raw.document.path) ?? '',
        fileName: clean(raw.document.fileName) ?? '',
        mimeType: clean(raw.document.mimeType) ?? '',
        size: Number(raw.document.size),
        sha256: clean(raw.document.sha256)?.toLowerCase() ?? '',
        uploadedAt: clean(raw.document.uploadedAt) ?? '',
      }
    : undefined
  const entry: RegulatoryEvidenceEntry = {
    id: clean(raw.id) ?? `reg-${Date.now().toString(36)}`,
    route,
    status,
    identifier: clean(raw.identifier) ?? '',
    issuer: clean(raw.issuer),
    documentReference: document?.path ?? clean(raw.documentReference),
    document,
    issuedAt: clean(raw.issuedAt),
    expiresAt: clean(raw.expiresAt),
    verifiedAt: status === 'verificado' ? (clean(raw.verifiedAt) ?? now) : clean(raw.verifiedAt),
    notes: clean(raw.notes),
  }
  const validation = validateRegulatoryEvidenceEntry(entry, state)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  return entry
}

export function verifiedRegulatoryRoutes(
  registry: RegulatoryEvidenceRegistry | null | undefined,
  state: ResearchProjectState,
  now = new Date().toISOString(),
): EthicsRoute[] {
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) return []
  const required = new Set(requiredRegulatoryEvidenceRoutes(state))
  const routes = new Set<EthicsRoute>()

  for (const entry of registry.entries) {
    if (!required.has(entry.route) || entry.status !== 'verificado') continue
    const validation = validateRegulatoryEvidenceEntry(entry, state)
    if (!validation.valid) continue
    if (entry.expiresAt && entry.expiresAt < now.slice(0, 10)) continue
    routes.add(entry.route)
  }
  return [...routes]
}

export function upsertRegulatoryEvidence(params: {
  registry?: RegulatoryEvidenceRegistry | null
  state: ResearchProjectState
  entry: Partial<RegulatoryEvidenceEntry>
  now?: string
}): RegulatoryEvidenceRegistry {
  const now = params.now ?? new Date().toISOString()
  const entry = sanitizeRegulatoryEvidenceEntry(params.entry, params.state, now)
  const current = params.registry?.version === 1 && Array.isArray(params.registry.entries)
    ? params.registry.entries
    : []
  return {
    version: 1,
    updatedAt: now,
    entries: [...current.filter(item => item.id !== entry.id), entry],
  }
}
