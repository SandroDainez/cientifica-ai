/**
 * lib/tipos/workTypeSchemas.ts
 *
 * Sistema CENTRALIZADO que controla, por TIPO de trabalho:
 *  - quais campos aparecem na tela de Projeto (projectFields / hiddenFields)
 *  - quais seções aparecem no Editor (editorSections — chaves exatas de fluxo)
 *  - se o tipo, por padrão, envolve seres humanos (envolveSeresHumanos)
 *
 * As chaves de TipoTrabalho são as exatas de types/index.ts; as de seção são as
 * exatas dos fluxos (lib/tipos/fluxos-trabalho.ts), coerentes com fases-efetivas.ts.
 * O controle de ética usa os campos já existentes de DadosProjeto
 * (precisa_cep, precisa_carta_anuencia, precisa_tcle) — não há flag nova.
 */

import type { TipoTrabalho } from '@/types'

export interface WorkTypeSchema {
  tipoTrabalho: TipoTrabalho
  label: string
  envolveSeresHumanos: boolean
  projectFields: string[]
  editorSections: string[]
  hiddenFields: string[]
}

// Campos básicos sempre disponíveis (também usados no fallback seguro)
const BASIC_FIELDS = [
  'titulo', 'tema', 'problema', 'justificativa',
  'objetivo_geral', 'objetivos_especificos', 'palavras_chave', 'formato_citacao',
]

// Campos de ÉTICA em pesquisa com seres humanos (CEP/Plataforma Brasil/TCLE)
const ETHICS_FIELDS = [
  'precisa_cep', 'plataforma_brasil', 'caae', 'tcle', 'precisa_tcle', 'precisa_carta_anuencia',
  'riscos_participantes', 'beneficios_participantes',
  'criterios_inclusao_participantes', 'criterios_exclusao_participantes',
]

// Campos de COLETA PRIMÁRIA (amostra/instrumentos) — não fazem sentido em revisões
const COLLECTION_FIELDS = [
  'populacao_alvo', 'amostra_estimada', 'instrumentos_previstos',
  'local_previsto', 'periodo_previsto', 'delineamento', 'analise_prevista', 'calculo_amostral',
]

const SCHEMAS: Record<TipoTrabalho, WorkTypeSchema> = {
  tcc: {
    tipoTrabalho: 'tcc',
    label: 'TCC',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, ...COLLECTION_FIELDS, ...ETHICS_FIELDS],
    editorSections: ['tema', 'problema', 'objetivos', 'justificativa', 'revisao_literatura', 'referencial_teorico', 'metodologia', 'aspectos_eticos', 'resultados', 'discussao', 'conclusao', 'resumo', 'introducao', 'referencias'],
    hiddenFields: [],
  },
  artigo_original: {
    tipoTrabalho: 'artigo_original',
    label: 'Artigo Original',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, ...COLLECTION_FIELDS, ...ETHICS_FIELDS],
    editorSections: ['pico', 'titulo', 'introducao', 'objetivos', 'metodos_delineamento', 'metodos_coleta', 'aspectos_eticos', 'resultados', 'discussao', 'conclusao', 'resumo', 'carta_submissao', 'referencias'],
    hiddenFields: [],
  },
  artigo_revisao: {
    tipoTrabalho: 'artigo_revisao',
    label: 'Artigo de Revisão',
    envolveSeresHumanos: false,
    projectFields: [...BASIC_FIELDS],
    editorSections: ['titulo', 'introducao', 'objetivos', 'metodologia', 'desenvolvimento', 'consideracoes_finais', 'resumo', 'referencias'],
    hiddenFields: [...ETHICS_FIELDS, ...COLLECTION_FIELDS],
  },
  relato_caso: {
    tipoTrabalho: 'relato_caso',
    label: 'Relato de Caso',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, 'precisa_tcle', 'tcle', 'consentimento_paciente'],
    editorSections: ['titulo', 'justificativa', 'introducao', 'objetivos', 'apresentacao_caso', 'investigacao_diagnostica', 'conduta_tratamento', 'evolucao_desfecho', 'consentimento_paciente', 'discussao', 'conclusao', 'resumo', 'referencias'],
    hiddenFields: ['calculo_amostral', 'amostra_estimada', 'populacao_alvo'],
  },
  monografia: {
    tipoTrabalho: 'monografia',
    label: 'Monografia',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, ...COLLECTION_FIELDS, ...ETHICS_FIELDS],
    editorSections: ['tema', 'introducao', 'objetivos', 'revisao_literatura', 'metodologia', 'aspectos_eticos', 'desenvolvimento', 'conclusao', 'resumo', 'referencias'],
    hiddenFields: [],
  },
  dissertacao_mestrado: {
    tipoTrabalho: 'dissertacao_mestrado',
    label: 'Dissertação (Mestrado)',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, ...COLLECTION_FIELDS, ...ETHICS_FIELDS],
    editorSections: ['tema', 'problema', 'objetivos', 'justificativa', 'revisao_literatura', 'referencial_teorico', 'metodologia', 'aspectos_eticos', 'resultados', 'discussao', 'conclusao', 'limitacoes', 'resumo', 'referencias'],
    hiddenFields: [],
  },
  tese_doutorado: {
    tipoTrabalho: 'tese_doutorado',
    label: 'Tese (Doutorado)',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, ...COLLECTION_FIELDS, ...ETHICS_FIELDS],
    editorSections: ['tema_originalidade', 'problema', 'objetivos', 'justificativa', 'revisao_estado_arte', 'referencial_teorico', 'metodologia', 'aspectos_eticos', 'resultados', 'discussao', 'conclusao', 'limitacoes', 'introducao', 'resumo', 'referencias'],
    hiddenFields: [],
  },
  revisao_sistematica: {
    tipoTrabalho: 'revisao_sistematica',
    label: 'Revisão Sistemática',
    envolveSeresHumanos: false,
    projectFields: [...BASIC_FIELDS],
    editorSections: ['protocolo', 'pergunta_pico', 'objetivos', 'estrategia_busca', 'criterios', 'triagem_prisma', 'extracao_dados', 'risco_vies', 'sintese', 'metanalise', 'discussao', 'conclusao', 'resumo', 'referencias'],
    hiddenFields: [...ETHICS_FIELDS, 'calculo_amostral', 'amostra_estimada', 'instrumentos_previstos', 'populacao_alvo'],
  },
  projeto_pesquisa: {
    tipoTrabalho: 'projeto_pesquisa',
    label: 'Projeto de Pesquisa',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, ...COLLECTION_FIELDS, ...ETHICS_FIELDS],
    editorSections: ['tema', 'objetivos', 'justificativa', 'revisao_literatura', 'metodologia', 'aspectos_eticos', 'tcle_modelo', 'cronograma', 'orcamento', 'resultados_esperados', 'referencias'],
    hiddenFields: [],
  },
  relatorio_ic: {
    tipoTrabalho: 'relatorio_ic',
    label: 'Relatório de IC',
    envolveSeresHumanos: true,
    projectFields: [...BASIC_FIELDS, ...COLLECTION_FIELDS, ...ETHICS_FIELDS],
    editorSections: ['resumo_atividades', 'introducao', 'objetivos', 'metodologia', 'resultados', 'dificuldades', 'formacao', 'perspectivas', 'referencias'],
    hiddenFields: [],
  },
}

/** Fallback seguro: apenas campos básicos e sem seres humanos. */
function fallbackSchema(tipo: TipoTrabalho): WorkTypeSchema {
  return {
    tipoTrabalho: tipo,
    label: String(tipo),
    envolveSeresHumanos: false,
    projectFields: [...BASIC_FIELDS],
    editorSections: [],
    hiddenFields: [],
  }
}

/** Retorna o schema do tipo, ou um fallback seguro (com console.warn). */
export function getSchemaByWorkType(tipo: TipoTrabalho): WorkTypeSchema {
  const schema = SCHEMAS[tipo]
  if (!schema) {
    console.warn(`[workTypeSchemas] Tipo de trabalho sem schema mapeado: "${tipo}". Usando fallback seguro.`)
    return fallbackSchema(tipo)
  }
  return schema
}

/** Há um schema explícito mapeado para este tipo? (para mostrar a mensagem na UI) */
export function hasSchemaForWorkType(tipo: TipoTrabalho): boolean {
  return Boolean(SCHEMAS[tipo])
}

/**
 * Deve mostrar este campo na tela de Projeto para este tipo?
 * Regra não-destrutiva: só esconde o que está explicitamente em hiddenFields.
 */
export function shouldShowField(tipo: TipoTrabalho, fieldName: string): boolean {
  const schema = getSchemaByWorkType(tipo)
  if (schema.hiddenFields.includes(fieldName)) return false
  if (schema.projectFields.includes(fieldName)) return true
  if (BASIC_FIELDS.includes(fieldName)) return true
  // Campo não mapeado: por segurança, mostra (evita ocultar algo existente).
  return true
}

/**
 * Deve mostrar esta seção no Editor para este tipo?
 * Se o tipo não tiver editorSections (fallback), mostra tudo (não-destrutivo).
 */
export function shouldShowEditorSection(tipo: TipoTrabalho, sectionKey: string): boolean {
  const schema = getSchemaByWorkType(tipo)
  if (schema.editorSections.length === 0) return true
  return schema.editorSections.includes(sectionKey)
}
