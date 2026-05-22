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
