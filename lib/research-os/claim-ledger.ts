import type { EvidenceMapResult } from './evidence-engine'
import { auditManuscriptClaims, type ManuscriptClaimFinding } from './manuscript-claim-audit'

export interface ClaimLedgerSectionInput {
  sectionKey: string
  sectionName: string
  text: string
}

export interface ClaimLedgerEntry extends ManuscriptClaimFinding {
  sectionKey: string
  sectionName: string
  status: 'ok' | 'alerta' | 'bloqueado'
}

export interface ClaimLedgerSummary {
  entries: ClaimLedgerEntry[]
  totalClaims: number
  ownResults: number
  externalEvidence: number
  unsupported: number
  violations: number
  sectionsAudited: number
  ready: boolean
}

export function buildClaimLedger(params: {
  sections: ClaimLedgerSectionInput[]
  researchProjectState: unknown
  evidenceMap: EvidenceMapResult | null | undefined
}): ClaimLedgerSummary {
  const entries: ClaimLedgerEntry[] = []
  const auditedSections = new Set<string>()

  for (const section of params.sections) {
    if (!section.text?.trim()) continue
    const audit = auditManuscriptClaims({
      sectionKey: section.sectionKey,
      text: section.text,
      researchProjectState: params.researchProjectState,
      evidenceMap: params.evidenceMap,
    })
    if (!audit.applies) continue
    auditedSections.add(section.sectionKey)
    for (const finding of audit.findings) {
      entries.push({
        ...finding,
        sectionKey: section.sectionKey,
        sectionName: section.sectionName,
        status: finding.issue ? 'bloqueado' : finding.source === 'nao_suportado' ? 'alerta' : 'ok',
      })
    }
  }

  const ownResults = entries.filter(entry => entry.source === 'resultado_proprio').length
  const externalEvidence = entries.filter(entry => entry.source === 'evidencia_externa').length
  const unsupported = entries.filter(entry => entry.source === 'nao_suportado').length
  const violations = entries.filter(entry => Boolean(entry.issue)).length

  return {
    entries,
    totalClaims: entries.length,
    ownResults,
    externalEvidence,
    unsupported,
    violations,
    sectionsAudited: auditedSections.size,
    ready: entries.length > 0 && unsupported === 0 && violations === 0,
  }
}
