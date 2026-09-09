import type { ResultFactRegistry } from './result-fact-lock'
import type { ResearchProjectState } from './types'

export interface DiscussionGenerationViolation {
  kind: 'exploratorio_confirmatorio' | 'desvio_apagado' | 'causalidade_aumentada'
  factId?: string
  excerpt: string
  message: string
}

export interface DiscussionGenerationAudit {
  applied: boolean
  allowed: boolean
  reasons: string[]
  violations: DiscussionGenerationViolation[]
}

const OBSERVATIONAL_DESIGNS = new Set([
  'coorte_prospectiva', 'coorte_retrospectiva', 'caso_controle', 'transversal', 'ecologico',
  'diagnostico', 'prognostico', 'modelo_preditivo',
])

const EXPLORATORY_MARKERS = /\b(explorat[oó]ri[oa]s?|gerador(?:a)?s? de hip[oó]tese|gera(?:m|ndo)? hip[oó]tese|post[ -]?hoc|an[aá]lise adicional)\b/iu
const CONFIRMATORY_MARKERS = /\b(confirm(?:a|am|ou|amos|ado|ados)|comprov(?:a|am|ou|amos|ado|ados)|demonstr(?:a|am|ou|amos|ado|ados)|evidenci(?:a|am|ou|amos|ado|ados) de forma definitiva|estabelec(?:e|em|eu|emos|ido|idos))\b/iu
const DEVIATION_MARKERS = /\b(desvio|n[aã]o planej(?:ad[oa]s?)?|p[oó]s[- ]protocolo|amendment|emenda|altera[cç][aã]o do protocolo|mudan[cç]a do protocolo)\b/iu
const CAUSAL_MARKERS = /\b(caus(?:a|am|ou|aram|ado|ados)|provoc(?:a|am|ou|aram|ado|ados)|determin(?:a|am|ou|aram|ado|ados)|leva(?:m|va|ram)? a|result(?:a|am|ou|aram) em)\b/iu

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(part => part.trim())
    .filter(Boolean)
}

function meaningfulWords(text: string): string[] {
  const stop = new Set(['para', 'com', 'sem', 'que', 'dos', 'das', 'uma', 'um', 'foi', 'foram', 'entre', 'sobre', 'apresentou', 'apresentaram'])
  return [...new Set(normalize(text).match(/[a-z]{5,}/g) ?? [])]
    .filter(word => !stop.has(word))
    .slice(0, 8)
}

function sentenceMatchesFact(sentence: string, fact: ResultFactRegistry['facts'][number]): boolean {
  const normalizedSentence = normalize(sentence)
  const words = meaningfulWords(fact.text)
  const lexicalHits = words.filter(word => normalizedSentence.includes(word)).length
  const numericHits = fact.numericTokens.filter(token => normalizedSentence.includes(token.replace('%', ''))).length
  return lexicalHits >= 2 || (numericHits >= 1 && lexicalHits >= 1)
}

function registryFromState(state: unknown): ResultFactRegistry | null {
  if (!state || typeof state !== 'object') return null
  const candidate = (state as Record<string, unknown>)._result_fact_registry
  if (!candidate || typeof candidate !== 'object') return null
  const registry = candidate as Partial<ResultFactRegistry>
  return registry.status === 'congelado' && Array.isArray(registry.facts)
    ? candidate as ResultFactRegistry
    : null
}

export function isDiscussionSection(sectionKey: string): boolean {
  return sectionKey === 'discussao' || sectionKey === 'discussao_grade'
}

export function auditGeneratedDiscussion(params: {
  sectionKey: string
  text: string
  researchProjectState: unknown
}): DiscussionGenerationAudit {
  if (!isDiscussionSection(params.sectionKey) || !params.researchProjectState) {
    return { applied: false, allowed: true, reasons: [], violations: [] }
  }

  const registry = registryFromState(params.researchProjectState)
  if (!registry) {
    return {
      applied: true,
      allowed: false,
      reasons: ['Discussão sem Result Fact Lock congelado para auditoria pós-geração.'],
      violations: [],
    }
  }

  const state = params.researchProjectState as Partial<ResearchProjectState>
  const observational = typeof state.studyDesign === 'string' && OBSERVATIONAL_DESIGNS.has(state.studyDesign)
  const violations: DiscussionGenerationViolation[] = []
  const sentences = splitSentences(params.text)

  for (const fact of registry.facts) {
    const matched = sentences.filter(sentence => sentenceMatchesFact(sentence, fact))
    if (!matched.length) continue

    for (const sentence of matched) {
      if (fact.provenance === 'exploratorio') {
        if (CONFIRMATORY_MARKERS.test(sentence) && !EXPLORATORY_MARKERS.test(sentence)) {
          violations.push({
            kind: 'exploratorio_confirmatorio',
            factId: fact.id,
            excerpt: sentence.slice(0, 500),
            message: `O achado exploratório ${fact.id} foi apresentado com linguagem confirmatória sem qualificação exploratória.`,
          })
        }
      }

      if (fact.provenance === 'desvio_documentado' && !DEVIATION_MARKERS.test(sentence)) {
        violations.push({
          kind: 'desvio_apagado',
          factId: fact.id,
          excerpt: sentence.slice(0, 500),
          message: `O achado ${fact.id} decorre de desvio documentado, mas a redação não preservou essa condição.`,
        })
      }

      if (observational && CAUSAL_MARKERS.test(sentence)) {
        violations.push({
          kind: 'causalidade_aumentada',
          factId: fact.id,
          excerpt: sentence.slice(0, 500),
          message: `A redação usou linguagem causal para o achado ${fact.id} em desenho observacional.`,
        })
      }
    }
  }

  const reasons = [...new Set(violations.map(v => v.message))]
  return { applied: true, allowed: violations.length === 0, reasons, violations }
}

export function discussionAuditMetadata(audit: DiscussionGenerationAudit) {
  return {
    applied: audit.applied,
    allowed: audit.allowed,
    reasons: audit.reasons,
    violations: audit.violations.map(v => ({ kind: v.kind, factId: v.factId })),
  }
}
