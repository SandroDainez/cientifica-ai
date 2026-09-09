import type { ReportingGuideline, StudyDesign } from './types'

const GUIDELINES_BY_DESIGN: Partial<Record<StudyDesign, ReportingGuideline[]>> = {
  ensaio_clinico_randomizado: ['SPIRIT', 'CONSORT'],
  ensaio_clinico_nao_randomizado: ['STROBE'],
  coorte_prospectiva: ['STROBE'],
  coorte_retrospectiva: ['STROBE'],
  caso_controle: ['STROBE'],
  transversal: ['STROBE'],
  ecologico: ['STROBE'],
  diagnostico: ['STARD'],
  prognostico: ['TRIPOD'],
  modelo_preditivo: ['TRIPOD'],
  revisao_sistematica: ['PRISMA'],
  metanalise: ['PRISMA'],
  revisao_escopo: ['PRISMA-ScR'],
  relato_caso: ['CARE'],
  serie_casos: ['CARE'],
  qualitativo: ['COREQ', 'SRQR'],
  experimental_animal: ['ARRIVE'],
  melhoria_qualidade: ['SQUIRE'],
  avaliacao_economica: ['CHEERS'],
}

export function getReportingGuidelines(design: StudyDesign): ReportingGuideline[] {
  return GUIDELINES_BY_DESIGN[design] ?? ['nenhuma_mapeada']
}
