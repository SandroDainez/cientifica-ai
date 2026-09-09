import type { StudyDesign } from './types'

export interface StudyDesignFacts {
  literatureOnly?: boolean
  systematicSearch?: boolean
  metaAnalysisPlanned?: boolean
  caseCount?: number
  animalExperiment?: boolean
  qualitativeData?: boolean
  quantitativeData?: boolean
  investigatorAssignsIntervention?: boolean
  randomized?: boolean
  startsFromOutcome?: boolean
  followsForwardInTime?: boolean
  historicalDataOnly?: boolean
  singleTimePoint?: boolean
  diagnosticAccuracyQuestion?: boolean
  prognosticQuestion?: boolean
  predictionModelQuestion?: boolean
  qualityImprovement?: boolean
  economicEvaluation?: boolean
}

export interface StudyDesignClassification {
  design: StudyDesign
  confidence: 'alta' | 'moderada' | 'baixa'
  rationale: string[]
  unresolved: string[]
}

export function classifyStudyDesign(facts: StudyDesignFacts): StudyDesignClassification {
  const rationale: string[] = []
  const unresolved: string[] = []

  if (facts.animalExperiment) {
    return { design: 'experimental_animal', confidence: 'alta', rationale: ['Há experimentação animal.'], unresolved }
  }
  if (facts.economicEvaluation) {
    return { design: 'avaliacao_economica', confidence: 'alta', rationale: ['A pergunta principal é econômica.'], unresolved }
  }
  if (facts.qualityImprovement) {
    return { design: 'melhoria_qualidade', confidence: 'alta', rationale: ['O objetivo declarado é melhoria de qualidade.'], unresolved }
  }
  if (facts.literatureOnly) {
    if (facts.systematicSearch && facts.metaAnalysisPlanned) {
      return { design: 'metanalise', confidence: 'alta', rationale: ['Pesquisa exclusivamente bibliográfica, busca sistemática e meta-análise planejada.'], unresolved }
    }
    if (facts.systematicSearch) {
      return { design: 'revisao_sistematica', confidence: 'alta', rationale: ['Pesquisa exclusivamente bibliográfica com busca sistemática.'], unresolved }
    }
    return { design: 'revisao_narrativa', confidence: 'moderada', rationale: ['Pesquisa exclusivamente bibliográfica sem busca sistemática informada.'], unresolved: ['Confirmar se haverá protocolo e estratégia de busca reprodutível.'] }
  }
  if (facts.caseCount === 1) {
    return { design: 'relato_caso', confidence: 'alta', rationale: ['A unidade analítica é um único caso.'], unresolved }
  }
  if (typeof facts.caseCount === 'number' && facts.caseCount > 1 && facts.caseCount <= 20 && !facts.quantitativeData) {
    return { design: 'serie_casos', confidence: 'moderada', rationale: ['Há poucos casos e não foi informado desenho analítico quantitativo.'], unresolved: ['Confirmar se existe grupo comparador ou hipótese analítica.'] }
  }
  if (facts.qualitativeData && !facts.quantitativeData) {
    return { design: 'qualitativo', confidence: 'alta', rationale: ['Os dados informados são exclusivamente qualitativos.'], unresolved }
  }
  if (facts.qualitativeData && facts.quantitativeData) {
    return { design: 'metodos_mistos', confidence: 'alta', rationale: ['Há componentes qualitativos e quantitativos.'], unresolved }
  }
  if (facts.diagnosticAccuracyQuestion) {
    return { design: 'diagnostico', confidence: 'alta', rationale: ['A pergunta avalia desempenho/acurácia diagnóstica.'], unresolved }
  }
  if (facts.predictionModelQuestion) {
    return { design: 'modelo_preditivo', confidence: 'alta', rationale: ['A pergunta envolve desenvolvimento ou validação de modelo preditivo.'], unresolved }
  }
  if (facts.prognosticQuestion) {
    return { design: 'prognostico', confidence: 'alta', rationale: ['A pergunta principal é prognóstica.'], unresolved }
  }
  if (facts.investigatorAssignsIntervention) {
    if (facts.randomized) {
      return { design: 'ensaio_clinico_randomizado', confidence: 'alta', rationale: ['O pesquisador atribui a intervenção e há randomização.'], unresolved }
    }
    return { design: 'ensaio_clinico_nao_randomizado', confidence: 'alta', rationale: ['O pesquisador atribui a intervenção sem randomização informada.'], unresolved }
  }
  if (facts.startsFromOutcome) {
    return { design: 'caso_controle', confidence: 'alta', rationale: ['A seleção parte do desfecho e reconstrói exposições anteriores.'], unresolved }
  }
  if (facts.historicalDataOnly) {
    return { design: 'coorte_retrospectiva', confidence: 'moderada', rationale: ['A exposição e o seguimento já ocorreram em dados históricos.'], unresolved: ['Confirmar que os grupos são definidos por exposição e não pelo desfecho.'] }
  }
  if (facts.followsForwardInTime) {
    return { design: 'coorte_prospectiva', confidence: 'alta', rationale: ['Os participantes são acompanhados prospectivamente sem atribuição de intervenção.'], unresolved }
  }
  if (facts.singleTimePoint) {
    return { design: 'transversal', confidence: 'alta', rationale: ['Exposição e desfecho são avaliados em um recorte temporal único.'], unresolved }
  }

  unresolved.push('Informar se há intervenção atribuída pelo pesquisador, temporalidade, forma de seleção da amostra e origem dos dados.')
  return { design: 'indefinido', confidence: 'baixa', rationale, unresolved }
}
