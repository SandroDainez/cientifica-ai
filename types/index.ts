// ============================================================
// CIENTÍFICA AI — Types globais
// ============================================================

export type TipoTrabalho =
  | 'tcc'
  | 'artigo_original'
  | 'artigo_revisao'
  | 'relato_caso'
  | 'monografia'
  | 'dissertacao_mestrado'
  | 'tese_doutorado'
  | 'revisao_sistematica'
  | 'projeto_pesquisa'
  | 'relatorio_ic'

export type FormatoCitacao = 'abnt' | 'vancouver' | 'apa'

export type StatusTrabalho = 'em_andamento' | 'concluido' | 'arquivado'

export type StatusSecao = 'pendente' | 'gerando' | 'gerado' | 'editado' | 'aprovado'

export type NivelAcademico =
  | 'graduacao'
  | 'especializacao'
  | 'mestrado'
  | 'doutorado'
  | 'professor'

export type NivelExperiencia = 'iniciante' | 'intermediario' | 'avancado'

export type AIProvider = 'deepseek' | 'anthropic' | 'openai'

// ============================================================
// ENTIDADES
// ============================================================

export interface Profile {
  id: string
  nome: string
  email: string
  instituicao?: string
  nivel_academico?: NivelAcademico
  area_conhecimento?: string
  orientador_nome?: string
  orientador_email?: string
  lattes?: string
  orcid?: string
  nivel_experiencia: NivelExperiencia
  formato_citacao_padrao: FormatoCitacao
  created_at: string
  updated_at: string
}

export interface Trabalho {
  id: string
  usuario_id: string
  titulo?: string
  tipo_trabalho: TipoTrabalho
  area_conhecimento?: string
  subarea?: string
  formato_citacao: FormatoCitacao
  instituicao_destino?: string
  tem_orientador: boolean
  orientador?: string
  nivel_experiencia: NivelExperiencia
  status: StatusTrabalho
  fase_atual: string
  fases_concluidas: string[]
  dados_trabalho: Record<string, unknown>
  metadados: Record<string, unknown>
  liberado: boolean
  created_at: string
  updated_at: string
}

export interface SecaoTrabalho {
  id: string
  trabalho_id: string
  nome_secao: string
  chave_secao: string
  ordem: number
  conteudo?: string
  conteudo_ia?: string
  conteudo_usuario?: string
  status: StatusSecao
  sugestoes_ia: SugestaoIA[]
  metadados: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Referencia {
  id: string
  trabalho_id: string
  tipo: TipoReferencia
  titulo: string
  autores?: AutorReferencia[]
  ano?: number
  data_acesso?: string   // ex: "15 jan. 2024" — obrigatório ABNT/Vancouver para sites
  journal?: string
  volume?: string
  numero?: string
  paginas?: string
  doi?: string
  pmid?: string
  url?: string
  isbn?: string
  issn?: string
  editora?: string
  cidade?: string
  dados_extras: Record<string, unknown>
  referencia_formatada_abnt?: string
  referencia_formatada_vancouver?: string
  referencia_formatada_apa?: string
  confiabilidade: 'alta' | 'media' | 'baixa'
  fonte_tipo?: 'pubmed' | 'crossref' | 'openalex' | 'manual'
  created_at: string
}

export type TipoReferencia =
  | 'artigo'
  | 'livro'
  | 'capitulo_livro'
  | 'site'
  | 'tese'
  | 'dissertacao'
  | 'lei'
  | 'norma'
  | 'anais'

export interface AutorReferencia {
  nome: string
  sobrenome: string
  iniciais?: string
}

// ============================================================
// IA
// ============================================================

export interface MensagemIA {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

export interface SugestaoIA {
  id: string
  tipo: 'critico' | 'importante' | 'sugestao'
  titulo: string
  descricao: string
  aplicado: boolean
}

export interface ResultadoValidacao {
  aprovado: boolean
  score: number
  sugestoes: SugestaoIA[]
  comentarios: string
}

// ============================================================
// CONFIGURAÇÃO DE FLUXO
// ============================================================

export interface FaseConfig {
  id: string
  nome: string
  descricao: string
  chave_secao: string
  obrigatoria: boolean
  tempo_estimado_minutos: number
  instrucoes: string
  dicas_ia: string[]
  elementos_obrigatorios: string[]
  erros_comuns: string[]
  min_palavras?: number
  max_palavras?: number
}

export interface ConfiguracaoFluxo {
  tipo: TipoTrabalho
  nome_completo: string
  descricao: string
  nivel: NivelAcademico[]
  duracao_estimada_horas: number
  requer_cep: boolean
  requer_prisma: boolean
  formatos_citacao_recomendados: FormatoCitacao[]
  fases: FaseConfig[]
}

// ============================================================
// DADOS DO PROJETO DE PESQUISA
// ============================================================

export interface ItemChecklist {
  id: string
  item: string
  descricao: string
  categoria: 'etica' | 'institucional' | 'metodologia' | 'coleta' | 'escrita'
  urgencia: 'alta' | 'media' | 'baixa'
  link_ajuda?: string
  concluido: boolean
}

export type TipoDocumento =
  | 'revisao_literatura'
  | 'protocolo_cep'
  | 'carta_anuencia'
  | 'tcle'
  | 'instrumento_coleta'
  | 'guia_coleta'
  | 'guia_analise'
  | 'sugestoes_periodicos'
  | 'carta_submissao'
  | 'checklist_submissao'

export interface DocumentoEtapa {
  tipo: TipoDocumento
  label: string
  descricao: string
}

export interface EtapaRoadmap {
  id: string
  titulo: string
  descricao: string
  tipo: 'preparacao' | 'etica' | 'aguardar' | 'coleta' | 'analise' | 'escrita' | 'submissao'
  duracao_estimada: string
  app_executa: boolean   // true = o app faz, false = o usuário precisa fazer
  obrigatoria: boolean
  bloqueante: boolean   // se true, próximas etapas dependem desta
  instrucoes_detalhadas?: string[]    // bullet-point instructions for the user
  documentos?: DocumentoEtapa[]       // documents AI can generate for this step
  link_externo?: string               // e.g. Plataforma Brasil URL
  status?: 'pendente' | 'em_andamento' | 'concluido'
}

export interface DadosProjeto {
  // Identificação
  descricao_original: string       // texto livre do usuário
  titulo_provisorio: string
  tipo_trabalho_sugerido: TipoTrabalho

  // Essência
  pergunta_pesquisa: string
  objetivo_geral: string

  // Metodologia
  tipo_coleta: 'primaria' | 'secundaria' | 'bibliografica'
  delineamento: string
  envolve_seres_humanos: boolean
  local_previsto: string
  periodo_previsto: string
  populacao_alvo: string
  amostra_estimada: string
  instrumentos_previstos: string
  analise_prevista: string

  // Ética
  precisa_cep: boolean
  precisa_carta_anuencia: boolean
  precisa_tcle: boolean

  // Contexto para geração das seções (alimenta o buildGerarSecaoPrompt)
  contexto_geral: string
  justificativa_resumida: string

  // Roadmap e checklist
  roadmap: EtapaRoadmap[]
  checklist: ItemChecklist[]
  alertas: string[]
  tempo_total_estimado: string

  // Checklist state persistence
  checklist_status?: Record<string, boolean>   // item.id → concluido

  // Análise textual gerada pela IA (PARTE 1 da resposta do planejador)
  analise_orientador?: string

  // Dados coletados pelo pesquisador (inseridos no painel de dados)
  dados_coletados?: string

  // Informações estruturadas do painel de dados
  n_participantes?: string       // ex: "80", "45 casos e 45 controles"
  software_analise?: string      // ex: "SPSS 27", "R 4.3", "Excel"
  taxa_resposta?: string         // ex: "82%", "74 de 90 convidados"

  // Controle
  criado_em: string
  confirmado: boolean
}
