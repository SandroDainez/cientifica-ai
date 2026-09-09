import type { TipoTrabalho } from '@/types'

export type AcademicPurpose =
  | 'disciplina'
  | 'iniciacao_cientifica'
  | 'tcc'
  | 'especializacao'
  | 'mestrado'
  | 'doutorado'
  | 'artigo_independente'
  | 'outro'

export type StudyDesign =
  | 'ensaio_clinico_randomizado'
  | 'ensaio_clinico_nao_randomizado'
  | 'coorte_prospectiva'
  | 'coorte_retrospectiva'
  | 'caso_controle'
  | 'transversal'
  | 'ecologico'
  | 'diagnostico'
  | 'prognostico'
  | 'modelo_preditivo'
  | 'qualitativo'
  | 'metodos_mistos'
  | 'revisao_sistematica'
  | 'metanalise'
  | 'revisao_escopo'
  | 'revisao_narrativa'
  | 'relato_caso'
  | 'serie_casos'
  | 'experimental_animal'
  | 'in_vitro'
  | 'avaliacao_economica'
  | 'melhoria_qualidade'
  | 'outro'
  | 'indefinido'

export type HumanDataSource =
  | 'intervencao_prospectiva'
  | 'observacional_prospectiva'
  | 'prontuario_retrospectivo'
  | 'questionario_entrevista'
  | 'material_biologico'
  | 'imagem_audio_video'
  | 'base_publica_anonimizada'
  | 'base_privada_anonimizada'
  | 'dados_identificaveis'
  | 'nenhum'

export interface RegulatoryContext {
  involvesHumans: boolean
  involvesAnimals: boolean
  humanDataSource: HumanDataSource
  vulnerablePopulation?: boolean
  multicenter?: boolean
  clinicalTrial?: boolean
}

export type EthicsRoute =
  | 'cep_conep_plataforma_brasil'
  | 'ceua_concea'
  | 'registro_ensaio_clinico'
  | 'consentimento_publicacao_caso'
  | 'sem_fluxo_etico_especifico'
  | 'avaliacao_institucional_necessaria'

export type ReportingGuideline =
  | 'CONSORT'
  | 'SPIRIT'
  | 'STROBE'
  | 'PRISMA'
  | 'PRISMA-ScR'
  | 'STARD'
  | 'TRIPOD'
  | 'CARE'
  | 'COREQ'
  | 'SRQR'
  | 'ARRIVE'
  | 'SQUIRE'
  | 'CHEERS'
  | 'nenhuma_mapeada'

export interface ResearchQuestionState {
  freeText?: string
  structuredQuestion?: string
  population?: string
  interventionOrExposure?: string
  comparator?: string
  primaryOutcome?: string
  secondaryOutcomes: string[]
  hypothesis?: string
}

export interface StatisticalPlanState {
  estimand?: string
  sampleSize?: number
  sampleSizeRationale?: string
  primaryAnalysis?: string
  covariates: string[]
  confounders: string[]
  missingDataStrategy?: string
  multiplicityStrategy?: string
}

export interface EvidenceClaim {
  id: string
  claim: string
  referenceIds: string[]
  supportStatus: 'nao_avaliado' | 'parcial' | 'confirmado' | 'refutado'
  evidenceLevel?: string
  notes?: string
}

export interface ResearchProjectState {
  schemaVersion: 2
  legacyWorkType?: TipoTrabalho
  academicPurpose: AcademicPurpose
  studyDesign: StudyDesign
  question: ResearchQuestionState
  regulatory: RegulatoryContext
  ethicsRoutes: EthicsRoute[]
  reportingGuidelines: ReportingGuideline[]
  statisticalPlan: StatisticalPlanState
  evidenceMap: EvidenceClaim[]
  unresolvedIssues: string[]
  readiness: {
    design: 'pendente' | 'parcial' | 'pronto'
    ethics: 'pendente' | 'parcial' | 'pronto' | 'nao_aplicavel'
    statistics: 'pendente' | 'parcial' | 'pronto' | 'nao_aplicavel'
    evidence: 'pendente' | 'parcial' | 'pronto'
    manuscript: 'pendente' | 'parcial' | 'pronto'
  }
}

export function createEmptyResearchProjectState(academicPurpose: AcademicPurpose = 'outro'): ResearchProjectState {
  return {
    schemaVersion: 2,
    academicPurpose,
    studyDesign: 'indefinido',
    question: { secondaryOutcomes: [] },
    regulatory: { involvesHumans: false, involvesAnimals: false, humanDataSource: 'nenhum' },
    ethicsRoutes: [],
    reportingGuidelines: [],
    statisticalPlan: { covariates: [], confounders: [] },
    evidenceMap: [],
    unresolvedIssues: [],
    readiness: {
      design: 'pendente',
      ethics: 'pendente',
      statistics: 'pendente',
      evidence: 'pendente',
      manuscript: 'pendente',
    },
  }
}
