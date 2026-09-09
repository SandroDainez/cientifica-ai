import type { EvidenceMapResult } from './evidence-engine'

export type EvidenceGateSection = 'introducao' | 'discussao' | 'conclusao' | 'outro'

export interface EvidenceGateDecision {
  allowed: boolean
  level: 'bloquear' | 'alertar' | 'liberar'
  reasons: string[]
}

const HIGH_IMPACT_SECTIONS = new Set<EvidenceGateSection>(['introducao', 'discussao'])

export function evaluateEvidenceGate(section: EvidenceGateSection, map: EvidenceMapResult | null | undefined): EvidenceGateDecision {
  const reasons: string[] = []

  if (!HIGH_IMPACT_SECTIONS.has(section)) {
    return { allowed: true, level: 'liberar', reasons: ['Seção fora do gate estrito de evidência v1.'] }
  }

  if (!map) {
    return {
      allowed: false,
      level: 'bloquear',
      reasons: ['Research OS ativo sem Evidence Map construído para seção de alto impacto factual.'],
    }
  }

  const highClaims = map.claims.filter(c => c.importance === 'alta')
  if (highClaims.length === 0) {
    return {
      allowed: false,
      level: 'bloquear',
      reasons: ['O mapa não contém claims de alta importância; a base argumentativa ainda não foi auditada.'],
    }
  }

  const confirmedDirect = new Set(
    map.links
      .filter(link => link.supportStatus === 'confirmado' && link.directness === 'direta')
      .map(link => link.claimId),
  )

  const uncoveredHigh = highClaims.filter(claim => !confirmedDirect.has(claim.id))
  if (uncoveredHigh.length > 0) {
    reasons.push(`${uncoveredHigh.length} claim(s) de alta importância sem suporte direto confirmado: ${uncoveredHigh.map(c => c.id).join(', ')}.`)
    return { allowed: false, level: 'bloquear', reasons }
  }

  const contradictoryHigh = map.links.filter(
    link => highClaims.some(c => c.id === link.claimId) && link.supportStatus === 'contraditorio',
  )
  if (contradictoryHigh.length > 0) {
    reasons.push('Há evidência contraditória associada a claim(s) de alta importância; requer revisão antes da geração.')
    return { allowed: false, level: 'bloquear', reasons }
  }

  if (map.warnings.length > 0 || map.readiness !== 'pronto') {
    reasons.push('A cobertura central está confirmada, mas permanecem warnings ou prontidão parcial no Evidence Map.')
    return { allowed: true, level: 'alertar', reasons }
  }

  return { allowed: true, level: 'liberar', reasons: ['Todos os claims de alta importância possuem suporte direto confirmado.'] }
}
