import type { EvidenceMapResult } from './evidence-engine'
import { evaluateEvidenceGate, type EvidenceGateDecision, type EvidenceGateSection } from './evidence-gate'
import { evaluateMethodologyGate, isMethodologySection } from './methodology-gate'
import type { ResearchProjectState } from './types'

const SECTION_MAP: Record<string, EvidenceGateSection> = {
  introducao: 'introducao',
  discussao: 'discussao',
  conclusao: 'conclusao',
}

export interface GenerationEvidencePolicy {
  researchOsActive: boolean
  decision: EvidenceGateDecision
  promptGuardrail: string
}

function asResearchProjectState(value: unknown): ResearchProjectState | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ResearchProjectState>
  if (v.schemaVersion !== 2 || !v.readiness || !v.statisticalPlan || !v.question || typeof v.studyDesign !== 'string') return null
  return value as ResearchProjectState
}

export function buildGenerationEvidencePolicy(params: {
  sectionKey: string
  researchProjectState: unknown
  evidenceMap: EvidenceMapResult | null | undefined
  currentReferenceIds?: string[]
}): GenerationEvidencePolicy {
  const researchOsActive = Boolean(params.researchProjectState)
  const section = SECTION_MAP[params.sectionKey] ?? 'outro'

  if (!researchOsActive) {
    return {
      researchOsActive: false,
      decision: { allowed: true, level: 'liberar', reasons: ['Projeto legado sem Research OS ativo.'] },
      promptGuardrail: '',
    }
  }

  if (isMethodologySection(params.sectionKey)) {
    const methodologyState = asResearchProjectState(params.researchProjectState)
    const methodologyDecision = methodologyState
      ? evaluateMethodologyGate(params.sectionKey, methodologyState)
      : {
          allowed: false,
          level: 'bloquear' as const,
          reasons: ['O estado metodológico do Research OS está incompleto ou desatualizado. Reconstrua o plano metodológico antes de gerar Métodos.'],
        }

    const promptGuardrail = methodologyDecision.allowed && methodologyState
      ? [
          '## RESEARCH OS — METHODOLOGY GATE',
          'A seção de Métodos deve refletir o plano metodológico estruturado e não inventar decisões novas.',
          `- desenho: ${methodologyState.studyDesign}`,
          `- desfecho primário: ${methodologyState.question.primaryOutcome ?? '(não definido)'}`,
          `- análise primária: ${methodologyState.statisticalPlan.primaryAnalysis ?? '(não definida)'}`,
          `- dados ausentes: ${methodologyState.statisticalPlan.missingDataStrategy ?? '(não definido)'}`,
          `- multiplicidade: ${methodologyState.statisticalPlan.multiplicityStrategy ?? '(não definida)'}`,
          'Se algum detalhe necessário não estiver estruturado, sinalize a pendência; não complete por suposição.',
        ].join('\n')
      : ''

    return {
      researchOsActive: true,
      decision: methodologyDecision,
      promptGuardrail,
    }
  }

  const map = params.currentReferenceIds === undefined
    ? params.evidenceMap
    : sanitizeEvidenceMapAgainstCurrentReferences(params.evidenceMap, params.currentReferenceIds)
  const decision = evaluateEvidenceGate(section, map)

  if (!map || !decision.allowed) {
    return { researchOsActive: true, decision, promptGuardrail: '' }
  }

  const confirmedDirect = map.links.filter(link => link.supportStatus === 'confirmado' && link.directness === 'direta')
  const claimsById = new Map(map.claims.map(claim => [claim.id, claim]))
  const allowedClaims = confirmedDirect
    .map(link => {
      const claim = claimsById.get(link.claimId)
      if (!claim) return null
      return `- [${claim.id}] ${claim.text} | referência_id=${link.referenceId} | suporte=${link.supportStatus} | directness=${link.directness}`
    })
    .filter(Boolean)
    .join('\n')

  const promptGuardrail = [
    '## RESEARCH OS — EVIDENCE GATE',
    'Este projeto usa um mapa de evidência auditado. Para afirmações factuais centrais nesta seção:',
    '1. Use como base prioritária apenas os claims confirmados e diretamente sustentados abaixo.',
    '2. Não transforme associação em causalidade, não aumente magnitude de efeito e não invente números.',
    '3. Se precisar de uma afirmação central que não esteja coberta, formule-a como incerteza/lacuna ou omita-a.',
    '4. Não use uma referência para sustentar claim diferente daquele ao qual ela foi vinculada sem nova verificação.',
    '',
    allowedClaims || '- Nenhum claim confirmado disponível.',
  ].join('\n')

  return { researchOsActive: true, decision, promptGuardrail }
}

export function sanitizeEvidenceMapAgainstCurrentReferences(
  map: EvidenceMapResult | null | undefined,
  currentReferenceIds: string[],
): EvidenceMapResult | null | undefined {
  if (!map) return map
  const validIds = new Set(currentReferenceIds)
  const links = map.links.filter(link => validIds.has(link.referenceId))
  const warnings = [...map.warnings]
  if (links.length !== map.links.length) {
    warnings.push('O Evidence Map continha vínculos para referências que não existem mais no trabalho; eles foram ignorados para esta geração.')
  }
  return { ...map, links, warnings }
}
