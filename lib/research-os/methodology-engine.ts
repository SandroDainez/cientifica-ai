import type { ResearchProjectState, StudyDesign } from './types'

export type VariableType = 'binaria' | 'categorica' | 'continua' | 'contagem' | 'tempo_ate_evento' | 'ordinal' | 'desconhecida'

export interface MethodologyInput {
  design: StudyDesign
  primaryOutcome?: {
    name: string
    type?: VariableType
    timepoint?: string
  }
  exposureOrIntervention?: string
  comparator?: string
  repeatedMeasures?: boolean
  clustering?: boolean
  censoring?: boolean
  expectedConfounders?: string[]
  covariates?: string[]
  expectedMissingData?: boolean
  multiplePrimaryOutcomes?: boolean
  targetSampleSize?: number
  allocationRatio?: number
}

export interface MethodologyPlan {
  design: StudyDesign
  designRationale: string
  requiredElements: string[]
  primaryAnalysis: string | null
  effectMeasure: string | null
  adjustmentStrategy: string | null
  missingDataStrategy: string | null
  multiplicityStrategy: string | null
  sampleSizeRequirements: string[]
  assumptionsToVerify: string[]
  prohibitedShortcuts: string[]
  unresolvedQuestions: string[]
  readiness: 'pendente' | 'parcial' | 'pronto'
}

const OBSERVATIONAL = new Set<StudyDesign>([
  'coorte_prospectiva', 'coorte_retrospectiva', 'caso_controle', 'transversal', 'ecologico',
])

function primaryAnalysisFor(input: MethodologyInput): { analysis: string | null; measure: string | null } {
  const type = input.primaryOutcome?.type ?? 'desconhecida'

  if (input.design === 'caso_controle') {
    return { analysis: 'Regressão logística, com ajuste pré-especificado para confundidores clinicamente plausíveis.', measure: 'odds ratio com IC95%' }
  }

  if (input.design === 'diagnostico') {
    return { analysis: 'Acurácia diagnóstica com tabela 2x2 e curvas ROC quando aplicável.', measure: 'sensibilidade, especificidade, razões de verossimilhança e AUC com IC95%' }
  }

  if (input.design === 'prognostico' || input.design === 'modelo_preditivo') {
    if (input.censoring || type === 'tempo_ate_evento') {
      return { analysis: 'Modelo de sobrevivência apropriado, com avaliação de calibração e discriminação quando houver predição.', measure: 'hazard ratio e/ou métricas de desempenho com IC95%' }
    }
    if (type === 'binaria') return { analysis: 'Regressão logística multivariável com avaliação de calibração e discriminação.', measure: 'odds ratio e métricas de desempenho com IC95%' }
    return { analysis: 'Modelo multivariável compatível com a distribuição do desfecho, com validação interna quando aplicável.', measure: 'estimativa de efeito e métricas de desempenho com IC95%' }
  }

  if (input.design === 'ensaio_clinico_randomizado' || input.design === 'ensaio_clinico_nao_randomizado') {
    if (input.censoring || type === 'tempo_ate_evento') return { analysis: 'Análise de tempo até evento, preservando o grupo de alocação quando randomizado.', measure: 'hazard ratio e curvas de sobrevivência com IC95%' }
    if (type === 'binaria') return { analysis: 'Comparação entre grupos por modelo binomial apropriado; em RCT, análise principal por intenção de tratar.', measure: 'risco relativo ou diferença absoluta de risco com IC95%' }
    if (type === 'continua') return { analysis: 'Modelo linear para comparação entre grupos, ajustando valor basal quando apropriado.', measure: 'diferença média com IC95%' }
    if (type === 'contagem') return { analysis: 'Modelo de Poisson ou binomial negativo conforme dispersão.', measure: 'razão de taxas com IC95%' }
  }

  if (OBSERVATIONAL.has(input.design)) {
    if (input.censoring || type === 'tempo_ate_evento') return { analysis: 'Modelo de sobrevivência com ajuste pré-especificado para confundidores.', measure: 'hazard ratio com IC95%' }
    if (type === 'binaria') return { analysis: 'Regressão multivariável compatível com desfecho binário, com ajuste para confundidores.', measure: 'risco relativo, razão de prevalências ou odds ratio conforme desenho e incidência' }
    if (type === 'continua') return { analysis: 'Regressão linear multivariável após avaliação dos pressupostos.', measure: 'diferença média ajustada ou coeficiente beta com IC95%' }
    if (type === 'contagem') return { analysis: 'Poisson ou binomial negativo, conforme dispersão e estrutura dos dados.', measure: 'razão de taxas com IC95%' }
  }

  return { analysis: null, measure: null }
}

export function buildMethodologyPlan(input: MethodologyInput): MethodologyPlan {
  const unresolvedQuestions: string[] = []
  const requiredElements: string[] = []
  const sampleSizeRequirements: string[] = []
  const assumptionsToVerify: string[] = []
  const prohibitedShortcuts: string[] = []

  if (!input.primaryOutcome?.name) unresolvedQuestions.push('Definir o desfecho primário antes do plano estatístico.')
  if (!input.primaryOutcome?.type || input.primaryOutcome.type === 'desconhecida') unresolvedQuestions.push('Classificar o tipo da variável do desfecho primário.')

  requiredElements.push('Definir população-fonte, critérios de inclusão/exclusão e período do estudo.')
  requiredElements.push('Definir operacionalmente exposição/intervenção, comparador e desfechos antes da análise.')
  requiredElements.push('Pré-especificar análise principal e análises secundárias.')

  if (OBSERVATIONAL.has(input.design)) {
    requiredElements.push('Construir um conjunto de confundidores com justificativa clínica/causal; evitar seleção baseada apenas em p-valor univariado.')
    prohibitedShortcuts.push('Não escolher covariáveis apenas por significância univariada.')
    prohibitedShortcuts.push('Não interpretar associação observacional como causalidade sem desenho e pressupostos apropriados.')
  }

  if (input.design === 'ensaio_clinico_randomizado') {
    requiredElements.push('Descrever sequência de randomização, ocultação da alocação, cegamento e análise por intenção de tratar.')
    prohibitedShortcuts.push('Não excluir participantes da análise principal apenas por desvio de protocolo; prever análise por intenção de tratar.')
  }

  if (input.design === 'modelo_preditivo' || input.design === 'prognostico') {
    requiredElements.push('Separar desenvolvimento de modelo, validação interna e, quando possível, validação externa.')
    requiredElements.push('Avaliar calibração e discriminação; não reportar apenas AUC.')
    prohibitedShortcuts.push('Não selecionar preditores apenas por p-valor univariado.')
  }

  if (input.repeatedMeasures) {
    requiredElements.push('Modelar correlação intraindivíduo com modelo misto, GEE ou abordagem equivalente.')
    assumptionsToVerify.push('Estrutura de correlação intraindivíduo das medidas repetidas.')
  }

  if (input.clustering) {
    requiredElements.push('Considerar efeito de cluster no desenho, tamanho amostral e análise.')
    assumptionsToVerify.push('Coeficiente de correlação intraclasse (ICC) ou parâmetro equivalente.')
  }

  if (input.censoring) requiredElements.push('Definir origem do tempo, evento, censura e horizonte temporal.')

  if (input.expectedMissingData) {
    requiredElements.push('Descrever quantidade, padrão e mecanismo plausível de dados ausentes.')
  }

  if (input.multiplePrimaryOutcomes) {
    requiredElements.push('Definir estratégia de multiplicidade para múltiplos desfechos primários.')
  }

  sampleSizeRequirements.push('Basear o cálculo no desfecho primário e na estimativa de efeito clinicamente relevante.')
  sampleSizeRequirements.push('Documentar alfa, poder, alocação, perdas previstas e pressupostos usados.')
  if (input.clustering) sampleSizeRequirements.push('Aplicar efeito de desenho por cluster no tamanho amostral.')
  if (input.repeatedMeasures) sampleSizeRequirements.push('Incorporar correlação intraindivíduo quando o cálculo depender de medidas repetidas.')
  if (input.design === 'modelo_preditivo' || input.design === 'prognostico') sampleSizeRequirements.push('Justificar tamanho amostral com base em número de parâmetros/eventos e risco de overfitting, não por regra fixa simplista.')

  const { analysis, measure } = primaryAnalysisFor(input)

  let adjustmentStrategy: string | null = null
  if (OBSERVATIONAL.has(input.design)) {
    adjustmentStrategy = 'Ajuste multivariável pré-especificado com confundidores definidos por conhecimento clínico/causal; documentar racional de inclusão.'
  } else if (input.design === 'ensaio_clinico_randomizado') {
    adjustmentStrategy = 'Ajuste opcional por covariáveis prognósticas pré-especificadas e/ou valor basal, sem substituir a comparação randomizada principal.'
  }

  const missingDataStrategy = input.expectedMissingData
    ? 'Quantificar dados ausentes por variável e grupo; investigar padrão/mecanismo; usar análise completa apenas se defensável e considerar imputação múltipla/análises de sensibilidade quando apropriado.'
    : 'Mesmo sem perda esperada, pré-especificar como dados ausentes serão quantificados e tratados.'

  const multiplicityStrategy = input.multiplePrimaryOutcomes
    ? 'Definir controle de erro tipo I (por exemplo, hierarquia, Holm ou outra estratégia justificável) antes da análise.'
    : 'Sem ajuste automático para múltiplos desfechos exploratórios; distinguir claramente análises confirmatórias de exploratórias.'

  const readiness: MethodologyPlan['readiness'] = unresolvedQuestions.length === 0 && analysis
    ? 'pronto'
    : unresolvedQuestions.length <= 1
      ? 'parcial'
      : 'pendente'

  return {
    design: input.design,
    designRationale: designRationale(input.design),
    requiredElements,
    primaryAnalysis: analysis,
    effectMeasure: measure,
    adjustmentStrategy,
    missingDataStrategy,
    multiplicityStrategy,
    sampleSizeRequirements,
    assumptionsToVerify,
    prohibitedShortcuts,
    unresolvedQuestions,
    readiness,
  }
}

function designRationale(design: StudyDesign): string {
  const map: Partial<Record<StudyDesign, string>> = {
    ensaio_clinico_randomizado: 'Adequado para estimar efeito causal de uma intervenção quando randomização é ética e viável.',
    coorte_prospectiva: 'Adequada para estimar incidência e associação temporal entre exposição e desfecho acompanhados prospectivamente.',
    coorte_retrospectiva: 'Adequada quando exposição e seguimento já estão registrados e é possível reconstruir temporalidade entre exposição e desfecho.',
    caso_controle: 'Adequado para desfechos raros ou longos períodos de latência, comparando exposições prévias entre casos e controles.',
    transversal: 'Adequado para estimar prevalência e associações em um ponto/período definido, sem inferir temporalidade causal.',
    diagnostico: 'Adequado para avaliar desempenho de teste índice contra padrão de referência.',
    prognostico: 'Adequado para estimar risco futuro ou associação prognóstica a partir de um ponto de partida definido.',
    modelo_preditivo: 'Adequado para desenvolver ou validar ferramenta de predição individual, exigindo calibração, discriminação e validação.',
    revisao_sistematica: 'Adequada para sintetizar evidência de estudos elegíveis com protocolo e critérios reprodutíveis.',
    experimental_animal: 'Adequado para investigação experimental pré-clínica quando a pergunta exige modelo animal e os 3Rs são atendidos.',
  }
  return map[design] ?? 'O desenho deve ser justificado pela pergunta, temporalidade, fonte de dados e estimando pretendido.'
}

export function applyMethodologyPlanToProjectState(
  state: ResearchProjectState,
  plan: MethodologyPlan,
): ResearchProjectState {
  return {
    ...state,
    statisticalPlan: {
      ...state.statisticalPlan,
      primaryAnalysis: plan.primaryAnalysis ?? state.statisticalPlan.primaryAnalysis,
      missingDataStrategy: plan.missingDataStrategy ?? state.statisticalPlan.missingDataStrategy,
      multiplicityStrategy: plan.multiplicityStrategy ?? state.statisticalPlan.multiplicityStrategy,
    },
    unresolvedIssues: [...new Set([...state.unresolvedIssues, ...plan.unresolvedQuestions])],
    readiness: {
      ...state.readiness,
      statistics: plan.readiness,
    },
  }
}
