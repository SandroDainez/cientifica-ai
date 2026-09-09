import type { EvidenceMapResult } from './evidence-engine'
import type { ResultFactRegistry } from './result-fact-lock'

export type ManuscriptClaimSource = 'resultado_proprio' | 'evidencia_externa' | 'nao_suportado'

export interface ManuscriptClaimFinding {
  sentence: string
  source: ManuscriptClaimSource
  sourceId?: string
  issue?: 'claim_sem_suporte' | 'causalidade_externa_aumentada' | 'exploratorio_confirmatorio'
  message?: string
}

export interface ManuscriptClaimAudit {
  applies: boolean
  allowed: boolean
  reasons: string[]
  findings: ManuscriptClaimFinding[]
}

const AUDITED_SECTIONS = new Set(['discussao', 'discussao_grade', 'conclusao', 'consideracoes_finais'])
const CONCLUSION_SECTIONS = new Set(['conclusao', 'consideracoes_finais'])
const CLAIM_MARKERS = /\b(associa(?:d[oa]s?|cao|ções)|aument(?:a|ou|aram|o)|reduz(?:iu|iram|ido|ida)|maior|menor|risco|mortalidade|preval[eê]ncia|incid[eê]ncia|efeito|diferen[cç]a|odds|hazard|raz[aã]o|sensibilidade|especificidade|predi[cç][aã]o|caus(?:a|ou|aram)|provoc(?:a|ou|aram)|determin(?:a|ou|aram)|result(?:a|ou|aram) em|leva(?:m|ram)? a|confirm(?:a|ou|aram|amos))\b/iu
const CAUSAL_MARKERS = /\b(caus(?:a|ou|aram|ado|ada)|provoc(?:a|ou|aram|ado|ada)|determin(?:a|ou|aram|ado|ada)|result(?:a|ou|aram) em|leva(?:m|ram)? a)\b/iu
const CONFIRMATORY_MARKERS = /\b(confirm(?:a|ou|aram|amos|ado|ada)|comprov(?:a|ou|aram|ado|ada)|estabelec(?:e|eu|eram|ido|ida))\b/iu
const EXPLORATORY_MARKERS = /\b(explorat[oó]ri[oa]s?|gerador(?:a)?s? de hip[oó]tese|post[ -]?hoc|an[aá]lise adicional)\b/iu

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(part => part.trim())
    .filter(part => part.length >= 20 && !/^#{1,6}\s/.test(part))
}

function words(text: string): string[] {
  const stop = new Set([
    'entre', 'sobre', 'foram', 'apenas', 'neste', 'nessa', 'esses', 'essas', 'deste', 'desta',
    'resultados', 'estudo', 'dados', 'achados', 'observou', 'observada', 'observado', 'mostrou', 'mostraram',
  ])
  return [...new Set(normalize(text).match(/[a-z]{5,}/g) ?? [])]
    .filter(word => !stop.has(word))
    .slice(0, 10)
}

function numericTokens(text: string): string[] {
  return [...new Set((normalize(text).match(/\b\d+(?:[.,]\d+)?\s*%?/g) ?? []).map(token => token.replace(/\s+/g, '').replace(',', '.')))]
}

function lexicalMatch(sentence: string, sourceText: string, sourceNumbers: string[] = []): boolean {
  const normalizedSentence = normalize(sentence)
  const sourceWords = words(sourceText)
  const lexicalHits = sourceWords.filter(word => normalizedSentence.includes(word)).length
  const numberHits = sourceNumbers.filter(token => normalizedSentence.includes(token.replace('%', ''))).length
  return lexicalHits >= 2 || (numberHits >= 1 && lexicalHits >= 1)
}

function resultRegistryFromState(state: unknown): ResultFactRegistry | null {
  if (!state || typeof state !== 'object') return null
  const candidate = (state as Record<string, unknown>)._result_fact_registry
  if (!candidate || typeof candidate !== 'object') return null
  const registry = candidate as Partial<ResultFactRegistry>
  return registry.status === 'congelado' && Array.isArray(registry.facts)
    ? candidate as ResultFactRegistry
    : null
}

function isMaterialClaim(sentence: string): boolean {
  return CLAIM_MARKERS.test(sentence) || numericTokens(sentence).length > 0
}

export function isManuscriptClaimAuditSection(sectionKey: string): boolean {
  return AUDITED_SECTIONS.has(sectionKey)
}

export function auditManuscriptClaims(params: {
  sectionKey: string
  text: string
  researchProjectState: unknown
  evidenceMap: EvidenceMapResult | null | undefined
}): ManuscriptClaimAudit {
  if (!isManuscriptClaimAuditSection(params.sectionKey) || !params.researchProjectState) {
    return { applies: false, allowed: true, reasons: [], findings: [] }
  }

  const registry = resultRegistryFromState(params.researchProjectState)
  const confirmedEvidence = (params.evidenceMap?.links ?? [])
    .filter(link => link.supportStatus === 'confirmado' && link.directness === 'direta')
  const evidenceClaims = new Map((params.evidenceMap?.claims ?? []).map(claim => [claim.id, claim]))
  const findings: ManuscriptClaimFinding[] = []

  for (const sentence of splitSentences(params.text).filter(isMaterialClaim)) {
    const ownFact = registry?.facts.find(fact => lexicalMatch(sentence, fact.text, fact.numericTokens))
    if (ownFact) {
      if (ownFact.provenance === 'exploratorio'
        && CONFIRMATORY_MARKERS.test(sentence)
        && !EXPLORATORY_MARKERS.test(sentence)) {
        findings.push({
          sentence,
          source: 'resultado_proprio',
          sourceId: ownFact.id,
          issue: 'exploratorio_confirmatorio',
          message: `O claim vinculado ao achado exploratório ${ownFact.id} foi apresentado como confirmatório.`,
        })
      } else if (CONCLUSION_SECTIONS.has(params.sectionKey)
        && ownFact.provenance === 'exploratorio'
        && !EXPLORATORY_MARKERS.test(sentence)) {
        findings.push({
          sentence,
          source: 'resultado_proprio',
          sourceId: ownFact.id,
          issue: 'exploratorio_confirmatorio',
          message: `A Conclusão incorporou o achado exploratório ${ownFact.id} sem qualificá-lo como exploratório/gerador de hipótese.`,
        })
      } else {
        findings.push({ sentence, source: 'resultado_proprio', sourceId: ownFact.id })
      }
      continue
    }

    const externalLink = confirmedEvidence.find(link => {
      const claim = evidenceClaims.get(link.claimId)
      return claim ? lexicalMatch(sentence, claim.text, numericTokens(claim.text)) : false
    })

    if (externalLink) {
      const claim = evidenceClaims.get(externalLink.claimId)!
      if (claim.kind === 'associacao' && CAUSAL_MARKERS.test(sentence)) {
        findings.push({
          sentence,
          source: 'evidencia_externa',
          sourceId: claim.id,
          issue: 'causalidade_externa_aumentada',
          message: `O claim ${claim.id} é de associação, mas a redação aumentou a força para causalidade.`,
        })
      } else {
        findings.push({ sentence, source: 'evidencia_externa', sourceId: claim.id })
      }
      continue
    }

    findings.push({
      sentence,
      source: 'nao_suportado',
      issue: 'claim_sem_suporte',
      message: 'A redação introduziu um claim científico material que não pôde ser vinculado a resultado próprio aprovado nem a claim confirmado do Evidence Map.',
    })
  }

  const violations = findings.filter(finding => finding.issue)
  const reasons = [...new Set(violations.map(finding => finding.message!).filter(Boolean))]
  return { applies: true, allowed: violations.length === 0, reasons, findings }
}

export function manuscriptClaimAuditMetadata(audit: ManuscriptClaimAudit) {
  if (!audit.applies) return undefined
  return {
    applied: true,
    allowed: audit.allowed,
    reasons: audit.reasons,
    claims_checked: audit.findings.length,
    unsupported_claims: audit.findings.filter(f => f.issue === 'claim_sem_suporte').length,
    findings: audit.findings.map(f => ({ source: f.source, sourceId: f.sourceId, issue: f.issue })),
  }
}
