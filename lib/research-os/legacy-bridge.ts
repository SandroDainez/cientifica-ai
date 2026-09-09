import type { TipoTrabalho } from '@/types'
import type { AcademicPurpose, ResearchProjectState, StudyDesign } from './types'
import { createEmptyResearchProjectState } from './types'
import { getReportingGuidelines } from './reporting-guidelines'

const PURPOSE_BY_LEGACY_TYPE: Partial<Record<TipoTrabalho, AcademicPurpose>> = {
  tcc: 'tcc',
  monografia: 'especializacao',
  dissertacao_mestrado: 'mestrado',
  tese_doutorado: 'doutorado',
  relatorio_ic: 'iniciacao_cientifica',
  artigo_original: 'artigo_independente',
  artigo_revisao: 'artigo_independente',
  revisao_sistematica: 'artigo_independente',
  relato_caso: 'artigo_independente',
}

const DESIGN_BY_UNAMBIGUOUS_LEGACY_TYPE: Partial<Record<TipoTrabalho, StudyDesign>> = {
  artigo_revisao: 'revisao_narrativa',
  revisao_sistematica: 'revisao_sistematica',
  relato_caso: 'relato_caso',
}

/**
 * Compatibilidade não destrutiva com trabalhos antigos.
 * Regra central: TCC/mestrado/doutorado/projeto de pesquisa NÃO determinam desenho.
 * Quando o legado não é metodologicamente inequívoco, o desenho fica indefinido
 * para ser classificado a partir da pergunta e dos dados reais do projeto.
 */
export function researchStateFromLegacyWorkType(tipo: TipoTrabalho): ResearchProjectState {
  const state = createEmptyResearchProjectState(PURPOSE_BY_LEGACY_TYPE[tipo] ?? 'outro')
  const design = DESIGN_BY_UNAMBIGUOUS_LEGACY_TYPE[tipo] ?? 'indefinido'

  state.legacyWorkType = tipo
  state.studyDesign = design
  state.reportingGuidelines = design === 'indefinido' ? [] : getReportingGuidelines(design)

  if (design === 'indefinido') {
    state.unresolvedIssues.push('Definir o desenho científico a partir da pergunta, fonte de dados, temporalidade e existência de intervenção/comparador.')
  } else {
    state.readiness.design = 'parcial'
  }

  return state
}
