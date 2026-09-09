import type { StudyDesign } from './types'
import type { VariableType } from './methodology-engine'

export interface SampleSizeInput {
  design: StudyDesign
  outcomeType: VariableType
  alpha?: number
  power?: number
  allocationRatio?: number
  expectedLossFraction?: number
  clustering?: {
    enabled: boolean
    averageClusterSize?: number
    icc?: number
  }
  repeatedMeasures?: {
    enabled: boolean
    withinSubjectCorrelation?: number
  }
  binary?: {
    controlRisk?: number
    interventionRisk?: number
  }
  continuous?: {
    standardDeviation?: number
    clinicallyRelevantDifference?: number
  }
  prevalence?: {
    expectedProportion?: number
    absolutePrecision?: number
  }
  prediction?: {
    candidateParameters?: number
    expectedEventFraction?: number
    minimumEventsPerParameter?: number
  }
}

export interface SampleSizePlan {
  status: 'calculado' | 'parcial' | 'pendente'
  baseSampleSize: number | null
  adjustedSampleSize: number | null
  perGroup: number[] | null
  assumptions: string[]
  adjustments: string[]
  unresolvedQuestions: string[]
  warnings: string[]
  formulaFamily: string | null
}

function clampProbability(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0 || value >= 1) return null
  return value
}

function inverseNormalCdf(p: number): number {
  // Acklam rational approximation. Accurate enough for design planning.
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924]
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857]
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878]
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742]
  const plow = 0.02425
  const phigh = 1 - plow
  if (p <= 0 || p >= 1) throw new Error('p fora de (0,1)')
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

function zForAlpha(alpha: number): number {
  return inverseNormalCdf(1 - alpha / 2)
}

function zForPower(power: number): number {
  return inverseNormalCdf(power)
}

function ceilSafe(value: number): number {
  return Math.max(1, Math.ceil(value))
}

function twoIndependentProportions(input: SampleSizeInput, alpha: number, power: number, ratio: number) {
  const p1 = clampProbability(input.binary?.controlRisk)
  const p2 = clampProbability(input.binary?.interventionRisk)
  if (p1 === null || p2 === null || p1 === p2) return null
  const zA = zForAlpha(alpha)
  const zB = zForPower(power)
  const q1 = 1 - p1
  const q2 = 1 - p2
  const delta = Math.abs(p1 - p2)
  // Conservative normal approximation with unequal allocation ratio r=n2/n1.
  const n1 = ((zA * Math.sqrt(p1 * q1 * (1 + 1 / ratio)) + zB * Math.sqrt(p1 * q1 + (p2 * q2) / ratio)) ** 2) / (delta ** 2)
  const n2 = n1 * ratio
  return { n1: ceilSafe(n1), n2: ceilSafe(n2) }
}

function twoIndependentMeans(input: SampleSizeInput, alpha: number, power: number, ratio: number) {
  const sd = input.continuous?.standardDeviation
  const delta = input.continuous?.clinicallyRelevantDifference
  if (!sd || !delta || sd <= 0 || delta <= 0 || ratio <= 0) return null
  const z = zForAlpha(alpha) + zForPower(power)
  const n1 = ((1 + 1 / ratio) * (sd ** 2) * (z ** 2)) / (delta ** 2)
  const n2 = n1 * ratio
  return { n1: ceilSafe(n1), n2: ceilSafe(n2) }
}

function singleProportionPrecision(input: SampleSizeInput, alpha: number) {
  const p = clampProbability(input.prevalence?.expectedProportion)
  const d = input.prevalence?.absolutePrecision
  if (p === null || !d || d <= 0 || d >= 1) return null
  const z = zForAlpha(alpha)
  return ceilSafe((z ** 2) * p * (1 - p) / (d ** 2))
}

function predictionEvents(input: SampleSizeInput) {
  const parameters = input.prediction?.candidateParameters
  const eventFraction = clampProbability(input.prediction?.expectedEventFraction)
  const epp = input.prediction?.minimumEventsPerParameter ?? 20
  if (!parameters || parameters <= 0 || eventFraction === null || epp < 10) return null
  const events = ceilSafe(parameters * epp)
  const total = ceilSafe(events / eventFraction)
  return { events, total, epp }
}

export function buildSampleSizePlan(input: SampleSizeInput): SampleSizePlan {
  const alpha = input.alpha ?? 0.05
  const power = input.power ?? 0.8
  const ratio = input.allocationRatio ?? 1
  const loss = input.expectedLossFraction ?? 0
  const assumptions: string[] = [`Alfa bicaudal=${alpha}.`, `Poder=${power}.`]
  const adjustments: string[] = []
  const unresolvedQuestions: string[] = []
  const warnings: string[] = []

  if (!(alpha > 0 && alpha < 0.2)) unresolvedQuestions.push('Definir alfa válido entre 0 e 0,20.')
  if (!(power > 0.5 && power < 1)) unresolvedQuestions.push('Definir poder estatístico válido entre 0,50 e 1,00.')
  if (!(ratio > 0)) unresolvedQuestions.push('Definir razão de alocação válida.')
  if (!(loss >= 0 && loss < 0.8)) unresolvedQuestions.push('Definir fração de perdas entre 0 e 0,80.')

  let baseSampleSize: number | null = null
  let perGroup: number[] | null = null
  let formulaFamily: string | null = null

  const isComparative = new Set<StudyDesign>([
    'ensaio_clinico_randomizado', 'ensaio_clinico_nao_randomizado',
    'coorte_prospectiva', 'coorte_retrospectiva', 'caso_controle',
  ]).has(input.design)

  if (input.design === 'modelo_preditivo' || input.design === 'prognostico') {
    const pred = predictionEvents(input)
    formulaFamily = 'eventos por parâmetro + fração esperada de eventos'
    if (pred) {
      baseSampleSize = pred.total
      assumptions.push(`Parâmetros candidatos=${input.prediction?.candidateParameters}.`)
      assumptions.push(`Meta mínima=${pred.epp} eventos por parâmetro; eventos necessários≈${pred.events}.`)
      warnings.push('Esta é uma regra conservadora de planejamento inicial; modelos preditivos maduros devem usar cálculo específico para shrinkage, R² esperado e calibração quando disponível.')
    } else {
      unresolvedQuestions.push('Informar número de parâmetros candidatos e fração esperada do evento para planejamento preditivo.')
    }
  } else if (isComparative && input.outcomeType === 'binaria') {
    const result = twoIndependentProportions(input, alpha, power, ratio)
    formulaFamily = 'comparação de duas proporções independentes'
    if (result) {
      perGroup = [result.n1, result.n2]
      baseSampleSize = result.n1 + result.n2
      assumptions.push(`Risco controle=${input.binary?.controlRisk}; risco alvo=${input.binary?.interventionRisk}.`)
    } else {
      unresolvedQuestions.push('Informar risco esperado no controle e risco esperado/clinicamente relevante no grupo comparador.')
    }
  } else if (isComparative && input.outcomeType === 'continua') {
    const result = twoIndependentMeans(input, alpha, power, ratio)
    formulaFamily = 'comparação de duas médias independentes'
    if (result) {
      perGroup = [result.n1, result.n2]
      baseSampleSize = result.n1 + result.n2
      assumptions.push(`DP=${input.continuous?.standardDeviation}; diferença clinicamente relevante=${input.continuous?.clinicallyRelevantDifference}.`)
    } else {
      unresolvedQuestions.push('Informar desvio-padrão esperado e diferença mínima clinicamente relevante.')
    }
  } else if ((input.design === 'transversal' || input.design === 'ecologico') && input.outcomeType === 'binaria') {
    baseSampleSize = singleProportionPrecision(input, alpha)
    formulaFamily = 'estimativa de uma proporção com precisão absoluta'
    if (baseSampleSize) {
      assumptions.push(`Proporção esperada=${input.prevalence?.expectedProportion}; precisão absoluta=${input.prevalence?.absolutePrecision}.`)
    } else {
      unresolvedQuestions.push('Informar prevalência/proporção esperada e precisão absoluta desejada.')
    }
  } else {
    unresolvedQuestions.push('O desenho/desfecho ainda não possui cálculo numérico automático nesta versão; manter justificativa metodológica explícita e cálculo específico antes do protocolo final.')
  }

  let adjustedSampleSize = baseSampleSize
  if (adjustedSampleSize && input.clustering?.enabled) {
    const m = input.clustering.averageClusterSize
    const icc = input.clustering.icc
    if (m && m > 1 && icc !== undefined && icc >= 0 && icc < 1) {
      const deff = 1 + (m - 1) * icc
      adjustedSampleSize = ceilSafe(adjustedSampleSize * deff)
      adjustments.push(`Efeito de desenho por cluster=${deff.toFixed(3)} (m=${m}, ICC=${icc}).`)
    } else {
      unresolvedQuestions.push('Para cluster, informar tamanho médio do cluster e ICC.')
    }
  }

  if (adjustedSampleSize && input.repeatedMeasures?.enabled) {
    const rho = input.repeatedMeasures.withinSubjectCorrelation
    if (rho !== undefined && rho >= 0 && rho < 1) {
      assumptions.push(`Correlação intraindivíduo esperada=${rho}.`)
      warnings.push('A correlação de medidas repetidas foi registrada, mas não reduz automaticamente n nesta versão porque o ganho depende do número de medidas, modelo e estrutura temporal.')
    } else {
      unresolvedQuestions.push('Para medidas repetidas, informar correlação intraindivíduo esperada.')
    }
  }

  if (adjustedSampleSize && loss > 0) {
    const before = adjustedSampleSize
    adjustedSampleSize = ceilSafe(adjustedSampleSize / (1 - loss))
    adjustments.push(`Inflação por perdas=${loss}; n ${before} → ${adjustedSampleSize}.`)
  }

  if (perGroup && adjustedSampleSize && adjustedSampleSize !== baseSampleSize) {
    const totalBase = perGroup[0] + perGroup[1]
    const factor = adjustedSampleSize / totalBase
    perGroup = [ceilSafe(perGroup[0] * factor), ceilSafe(perGroup[1] * factor)]
  }

  const status: SampleSizePlan['status'] = adjustedSampleSize && unresolvedQuestions.length === 0
    ? 'calculado'
    : adjustedSampleSize
      ? 'parcial'
      : 'pendente'

  if (input.design === 'caso_controle' && input.outcomeType === 'binaria') {
    warnings.push('Caso-controle requer cálculo específico por prevalência de exposição, OR alvo e razão caso:controle; o cálculo por duas proporções serve apenas como aproximação inicial se os parâmetros forem interpretados adequadamente.')
  }

  return {
    status,
    baseSampleSize,
    adjustedSampleSize,
    perGroup,
    assumptions,
    adjustments,
    unresolvedQuestions,
    warnings,
    formulaFamily,
  }
}
