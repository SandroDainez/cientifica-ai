import { classifyStudyDesign, type StudyDesignFacts } from './study-design-classifier'
import { routeEthics } from './ethics-router'
import { getReportingGuidelines } from './reporting-guidelines'
import { createEmptyResearchProjectState, type AcademicPurpose, type HumanDataSource, type ResearchProjectState } from './types'

export interface ScientificIntakeInput {
  description: string
  academicPurpose?: AcademicPurpose
  area?: string
  facts?: StudyDesignFacts & {
    involvesHumans?: boolean
    involvesAnimals?: boolean
    humanDataSource?: HumanDataSource
    vulnerablePopulation?: boolean
    multicenter?: boolean
  }
}

export interface IntakeQuestion {
  id: string
  question: string
  reason: string
  required: boolean
}

export interface ScientificIntakeResult {
  state: ResearchProjectState
  questions: IntakeQuestion[]
  classification: ReturnType<typeof classifyStudyDesign>
  ethics: ReturnType<typeof routeEthics>
  warnings: string[]
}

function inferHumanDataSource(facts: ScientificIntakeInput['facts']): HumanDataSource {
  if (facts?.humanDataSource) return facts.humanDataSource
  if (facts?.investigatorAssignsIntervention) return 'intervencao_prospectiva'
  if (facts?.historicalDataOnly) return 'prontuario_retrospectivo'
  if (facts?.followsForwardInTime) return 'observacional_prospectiva'
  return 'nenhum'
}

export function buildIntakeQuestions(input: ScientificIntakeInput, classification: ReturnType<typeof classifyStudyDesign>): IntakeQuestion[] {
  const facts = input.facts ?? {}
  const questions: IntakeQuestion[] = []

  const push = (id: string, question: string, reason: string, required = true) => {
    if (!questions.some(q => q.id === id)) questions.push({ id, question, reason, required })
  }

  if (classification.design === 'indefinido') {
    if (facts.investigatorAssignsIntervention === undefined) {
      push('intervention_assignment', 'O pesquisador vai decidir qual intervenção cada participante recebe?', 'Diferencia estudo experimental de observacional.')
    }
    if (facts.historicalDataOnly === undefined && facts.followsForwardInTime === undefined && facts.singleTimePoint === undefined) {
      push('temporality', 'Os dados já existem, serão acompanhados para frente, ou serão coletados em um único momento?', 'A temporalidade separa coorte retrospectiva, prospectiva e transversal.')
    }
    if (facts.startsFromOutcome === undefined) {
      push('sampling_origin', 'Os participantes serão selecionados porque já têm o desfecho, ou por exposição/população antes do desfecho?', 'Selecionar pelo desfecho sugere caso-controle.')
    }
  }

  if (facts.involvesHumans === undefined && facts.involvesAnimals === undefined) {
    push('participants', 'O projeto envolve seres humanos, animais, material biológico ou apenas literatura/dados secundários?', 'Define a trilha ética e regulatória.')
  }

  if (facts.involvesHumans && !facts.humanDataSource) {
    push('human_data_source', 'De onde virão os dados humanos: intervenção, seguimento observacional, prontuários, entrevistas/questionários, material biológico, imagens ou base de dados?', 'A origem dos dados altera consentimento, CEP e manejo de privacidade.')
  }

  if (!facts.literatureOnly && !facts.caseCount && !facts.animalExperiment && facts.quantitativeData === undefined && facts.qualitativeData === undefined) {
    push('data_kind', 'Os dados serão quantitativos, qualitativos ou ambos?', 'Diferencia estudo quantitativo, qualitativo e métodos mistos.')
  }

  if (!facts.literatureOnly && facts.caseCount !== 1 && !facts.animalExperiment) {
    push('primary_outcome', 'Qual é o desfecho principal que você quer explicar, comparar ou prever?', 'Sem um desfecho primário claro não é seguro fechar desenho, amostra ou análise.', false)
  }

  return questions
}

export function runScientificIntake(input: ScientificIntakeInput): ScientificIntakeResult {
  const facts = input.facts ?? {}
  const classification = classifyStudyDesign(facts)

  const involvesAnimals = Boolean(facts.involvesAnimals || facts.animalExperiment)
  const involvesHumans = Boolean(facts.involvesHumans)
  const clinicalTrial = classification.design === 'ensaio_clinico_randomizado' || classification.design === 'ensaio_clinico_nao_randomizado'
  const humanDataSource = involvesHumans ? inferHumanDataSource(facts) : 'nenhum'

  const regulatory = {
    involvesHumans,
    involvesAnimals,
    humanDataSource,
    vulnerablePopulation: facts.vulnerablePopulation,
    multicenter: facts.multicenter,
    clinicalTrial,
  } as const

  const ethics = routeEthics(regulatory, classification.design)
  const state = createEmptyResearchProjectState(input.academicPurpose ?? 'outro')
  state.studyDesign = classification.design
  state.question.freeText = input.description.trim()
  state.regulatory = regulatory
  state.ethicsRoutes = ethics.routes
  state.reportingGuidelines = getReportingGuidelines(classification.design)
  state.unresolvedIssues = [...classification.unresolved, ...ethics.blockers]

  state.readiness.design = classification.design === 'indefinido' ? 'pendente' : classification.unresolved.length ? 'parcial' : 'pronto'
  state.readiness.ethics = ethics.blockers.length ? 'parcial' : ethics.routes.includes('sem_fluxo_etico_especifico') ? 'nao_aplicavel' : 'pronto'

  const questions = buildIntakeQuestions(input, classification)
  const warnings: string[] = []

  if (!input.description.trim()) warnings.push('Descrição da ideia de pesquisa vazia.')
  if (classification.confidence === 'baixa') warnings.push('Desenho ainda não pode ser inferido com segurança; faça as perguntas de esclarecimento antes de gerar metodologia.')
  if (classification.design === 'coorte_retrospectiva' && facts.startsFromOutcome) warnings.push('Conflito lógico: dados históricos com seleção pelo desfecho podem indicar caso-controle, não coorte retrospectiva.')
  if (clinicalTrial && !involvesHumans) warnings.push('Ensaio clínico exige contexto humano coerente; não prossiga até corrigir os fatos do projeto.')

  return { state, questions, classification, ethics, warnings }
}
