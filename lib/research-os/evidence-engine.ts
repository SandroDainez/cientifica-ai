import type { Referencia } from '@/types'

export type EvidenceSupportStatus = 'nao_avaliado' | 'insuficiente' | 'parcial' | 'confirmado' | 'contraditorio'
export type EvidenceDirectness = 'direta' | 'indireta' | 'incerta'
export type EvidenceSourceTier = 'sintese_alta' | 'ensaio' | 'observacional' | 'diagnostico_prognostico' | 'qualitativo' | 'preclinico' | 'diretriz' | 'outra' | 'incerta'

export interface ClaimCandidate {
  id: string
  text: string
  importance: 'alta' | 'media' | 'baixa'
  kind: 'efeito' | 'associacao' | 'frequencia' | 'diagnostico' | 'prognostico' | 'metodologia' | 'definicao' | 'outro'
}

export interface EvidenceLinkAssessment {
  claimId: string
  referenceId: string
  supportStatus: EvidenceSupportStatus
  directness: EvidenceDirectness
  sourceTier: EvidenceSourceTier
  populationMatch: 'alta' | 'parcial' | 'baixa' | 'incerta'
  outcomeMatch: 'alta' | 'parcial' | 'baixa' | 'incerta'
  numericSupport: 'nao_aplicavel' | 'confirmado' | 'nao_encontrado' | 'incerto'
  rationale: string
  supportingExcerpt?: string
}

export interface EvidenceMapResult {
  claims: ClaimCandidate[]
  links: EvidenceLinkAssessment[]
  uncoveredClaims: string[]
  warnings: string[]
  readiness: 'pendente' | 'parcial' | 'pronto'
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNumericTokens(text: string): string[] {
  const normalized = text.replace(',', '.')
  return [...normalized.matchAll(/\b\d+(?:\.\d+)?\s*%?/g)].map(m => m[0].replace(/\s+/g, ''))
}

function referenceText(ref: Referencia): string {
  return [ref.titulo, ref.abstract].filter(Boolean).join(' ')
}

export function validateEvidenceAssessment(
  claims: ClaimCandidate[],
  references: Referencia[],
  rawLinks: EvidenceLinkAssessment[],
): { links: EvidenceLinkAssessment[]; warnings: string[] } {
  const claimById = new Map(claims.map(c => [c.id, c]))
  const refById = new Map(references.map(r => [r.id, r]))
  const warnings: string[] = []
  const links: EvidenceLinkAssessment[] = []

  for (const raw of rawLinks) {
    const claim = claimById.get(raw.claimId)
    const ref = refById.get(raw.referenceId)
    if (!claim || !ref) {
      warnings.push(`Ligação descartada por claim/reference desconhecida: ${raw.claimId} -> ${raw.referenceId}`)
      continue
    }

    const link: EvidenceLinkAssessment = { ...raw }
    const source = referenceText(ref)
    const hasAbstract = Boolean(ref.abstract?.trim())

    // Uma fonte sem abstract/texto não pode ser marcada como suporte confirmado.
    if (!hasAbstract && link.supportStatus === 'confirmado') {
      link.supportStatus = 'nao_avaliado'
      link.directness = 'incerta'
      link.rationale = 'A fonte existe, mas não há abstract/texto disponível para confirmar semanticamente a afirmação.'
      warnings.push(`Suporte rebaixado: ${ref.id} não possui abstract para confirmar ${claim.id}.`)
    }

    const numbers = extractNumericTokens(claim.text)
    if (numbers.length > 0 && hasAbstract) {
      const normalizedSource = normalizeText(source)
      const allNumbersPresent = numbers.every(n => normalizedSource.includes(n.toLowerCase()))
      if (!allNumbersPresent) {
        link.numericSupport = 'nao_encontrado'
        if (link.supportStatus === 'confirmado') link.supportStatus = 'parcial'
        warnings.push(`Número do claim ${claim.id} não foi localizado no abstract da referência ${ref.id}.`)
      } else {
        link.numericSupport = 'confirmado'
      }
    }

    // Evita racional vazio em avaliações aparentemente fortes.
    if ((link.supportStatus === 'confirmado' || link.supportStatus === 'contraditorio') && !link.rationale.trim()) {
      link.supportStatus = 'parcial'
      link.rationale = 'Avaliação sem justificativa suficiente; requer revisão.'
    }

    // Excertos precisam realmente existir no material fornecido.
    if (link.supportingExcerpt?.trim()) {
      const excerpt = normalizeText(link.supportingExcerpt)
      const sourceNorm = normalizeText(source)
      if (!sourceNorm.includes(excerpt)) {
        delete link.supportingExcerpt
        warnings.push(`Excerto removido: não foi localizado na referência ${ref.id}.`)
      }
    }

    links.push(link)
  }

  return { links, warnings }
}

export function buildEvidenceMapResult(
  claims: ClaimCandidate[],
  references: Referencia[],
  rawLinks: EvidenceLinkAssessment[],
): EvidenceMapResult {
  const validated = validateEvidenceAssessment(claims, references, rawLinks)
  const strongByClaim = new Map<string, boolean>()

  for (const claim of claims) strongByClaim.set(claim.id, false)
  for (const link of validated.links) {
    if (link.supportStatus === 'confirmado' && link.directness === 'direta') strongByClaim.set(link.claimId, true)
  }

  const uncoveredClaims = claims
    .filter(c => c.importance === 'alta' && !strongByClaim.get(c.id))
    .map(c => c.id)

  const warnings = [...validated.warnings]
  if (references.length === 0) warnings.push('Nenhuma referência disponível para o mapa de evidência.')
  if (uncoveredClaims.length > 0) warnings.push(`${uncoveredClaims.length} claim(s) de alta importância seguem sem suporte direto confirmado.`)

  const highImportance = claims.filter(c => c.importance === 'alta').length
  const coveredHigh = highImportance - uncoveredClaims.length
  const readiness: EvidenceMapResult['readiness'] =
    claims.length === 0 || references.length === 0 ? 'pendente'
      : highImportance === 0 || coveredHigh === highImportance ? 'pronto'
        : coveredHigh > 0 ? 'parcial'
          : 'pendente'

  return { claims, links: validated.links, uncoveredClaims, warnings, readiness }
}
