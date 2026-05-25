'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Cpu,
  ExternalLink,
  Loader2,
  ClipboardList,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  Info,
  Upload,
  ImageIcon,
  Table2,
  X,
  FileSpreadsheet,
  Printer,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Trabalho, DadosProjeto, EtapaRoadmap, ItemChecklist, TipoDocumento, DocumentoEtapa } from '@/types'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Step = 'input' | 'gerando' | 'plano'

interface ProjetoCriadorClientProps {
  trabalho: Trabalho
  dadosProjetoInicial: DadosProjeto | null
  documentosInicial?: Record<string, string>   // tipo → conteudo salvo no banco
}

type DocStatus = 'idle' | 'gerando' | 'gerado' | 'erro'

interface DocState {
  status: DocStatus
  conteudo: string
  erro?: string
}

type DocsMap = Record<string, DocState>   // key: `${etapaId}_${tipoDoc}`

type EtapaStatus = 'pendente' | 'em_andamento' | 'concluido'

// ─── helpers de cor ───────────────────────────────────────────────────────────

function etapaCor(tipo: EtapaRoadmap['tipo']): string {
  switch (tipo) {
    case 'preparacao': return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100'
    case 'etica':      return 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-100'
    case 'aguardar':   return 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100'
    case 'coleta':     return 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100'
    case 'analise':    return 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100'
    case 'escrita':    return 'bg-green-50 dark:bg-green-950/60 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100'
    case 'submissao':  return 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100'
  }
}

function etapaIcone(tipo: EtapaRoadmap['tipo']): string {
  switch (tipo) {
    case 'preparacao': return '📋'
    case 'etica':      return '🟠'
    case 'aguardar':   return '⏳'
    case 'coleta':     return '🔵'
    case 'analise':    return '🟣'
    case 'escrita':    return '🟢'
    case 'submissao':  return '📤'
  }
}

function urgenciaCor(urgencia: ItemChecklist['urgencia']): string {
  switch (urgencia) {
    case 'alta':  return 'border-l-red-500 bg-red-50 dark:bg-red-950/40'
    case 'media': return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/40'
    case 'baixa': return 'border-l-green-500 bg-green-50 dark:bg-green-950/40'
  }
}

function urgenciaLabel(urgencia: ItemChecklist['urgencia']): string {
  switch (urgencia) {
    case 'alta':  return 'Alta'
    case 'media': return 'Média'
    case 'baixa': return 'Baixa'
  }
}

function urgenciaBadge(urgencia: ItemChecklist['urgencia']): string {
  switch (urgencia) {
    case 'alta':  return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
    case 'media': return 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
    case 'baixa': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
  }
}

function etapaStatusBadge(status: EtapaStatus): string {
  switch (status) {
    case 'pendente':     return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500'
    case 'em_andamento': return 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-600'
    case 'concluido':    return 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-200 border-green-300 dark:border-green-600'
  }
}

function etapaStatusLabel(status: EtapaStatus): string {
  switch (status) {
    case 'pendente':     return 'Pendente'
    case 'em_andamento': return 'Em andamento'
    case 'concluido':    return 'Concluído'
  }
}

function nextEtapaStatus(status: EtapaStatus): EtapaStatus {
  switch (status) {
    case 'pendente':     return 'em_andamento'
    case 'em_andamento': return 'concluido'
    case 'concluido':    return 'pendente'
  }
}

// ─── Normaliza o tipo de etapa — corrige erros de geração da IA ──────────────
// A IA às vezes tipifica etapas de ética como "preparacao".
// Baseado no título, corrigimos o tipo antes de qualquer outra lógica.

function normalizeEtapa(etapa: EtapaRoadmap): EtapaRoadmap {
  if (etapa.tipo !== 'preparacao') return etapa   // só corrige preparacao indevido
  const t = etapa.titulo.toLowerCase()
  // Etapas de ética com tipo errado → corrigir para 'etica'
  if (
    t.includes('protocolo') ||
    t.includes('cep') ||
    t.includes('plataforma brasil') ||
    t.includes('anuência') ||
    t.includes('anuencia') ||
    t.includes('tcle') ||
    (t.includes('submeter') && (t.includes('cep') || t.includes('comitê')))
  ) {
    return { ...etapa, tipo: 'etica' as const }
  }
  return etapa
}

// ─── Calcula app_executa deterministicamente no frontend ─────────────────────
// Não confia no valor gerado pela IA — define pela lógica de negócio.
// Para etica: usa heurística de título (elaborar doc → app; submeter/obter → usuário).

function computeAppExecuta(etapa: EtapaRoadmap): boolean {
  switch (etapa.tipo) {
    case 'preparacao': return true    // IA sempre faz (revisão de literatura)
    case 'escrita':    return true    // IA sempre faz (editor gera seções)
    case 'aguardar':   return false   // usuário acompanha
    case 'coleta':     return true    // IA gera instrumento, guia e cálculo amostral
    case 'analise':    return true    // IA gera guia de análise estatística
    case 'submissao':  return false   // usuário submete
    case 'etica': {
      const t = etapa.titulo.toLowerCase()
      // Etapas de SUBMISSÃO ou AGUARDA → usuário faz presencialmente
      if (t.includes('submeter') || t.includes('submiss') || t.includes('enviar')) return false
      // Etapas de elaboração ou obtenção de documentos → IA gera o template
      // (elaborar, redigir, obter carta, preparar)
      return (
        t.includes('elaborar') || t.includes('redigir') ||
        t.includes('obter') || t.includes('preparar')
      )
    }
  }
}

// ─── Instruções estáticas por tipo/subtipo de etapa ──────────────────────────
// Separadas por subtipo de etica para evitar conteúdo idêntico em cards diferentes.

function getInstrucoesEtapa(etapa: EtapaRoadmap, appExecuta: boolean): string[] {
  if (etapa.tipo === 'etica') {
    if (appExecuta) {
      const t = etapa.titulo.toLowerCase()
      // Obter carta de anuência: gerar template + coletar assinatura presencialmente
      if (t.includes('carta') || t.includes('anuência') || t.includes('anuencia') || t.includes('obter')) {
        return [
          'Clique em "Gerar com IA" abaixo para gerar o modelo de Carta de Anuência',
          'Preencha os campos em [colchetes] com os dados reais da instituição parceira',
          'Imprima em papel timbrado da sua instituição (ou da coparticipante)',
          'Apresente ao diretor ou responsável institucional para assinatura e carimbo',
          'Digitalize em PDF de boa qualidade e guarde uma cópia física em local seguro',
        ]
      }
      // Elaborar protocolo, TCLE e demais documentos CEP
      return [
        'Clique em "Gerar com IA" abaixo para gerar cada documento necessário',
        'Revise cada documento e preencha os campos em [colchetes] com seus dados reais',
        'Salve em PDF e organize numa pasta com o nome do projeto',
        'Mostre os documentos ao seu orientador antes de submeter ao CEP',
        'Após a revisão, submeta tudo na Plataforma Brasil como arquivo único ou separado',
      ]
    } else {
      // Etapas de submissão → usuário acessa a Plataforma Brasil
      return [
        'Acesse a Plataforma Brasil em plataformabrasil.saude.gov.br',
        'Crie ou acesse sua conta e cadastre o projeto de pesquisa',
        'Anexe o protocolo, o TCLE (Termo de Consentimento Livre e Esclarecido) e a Carta de Anuência',
        'Aguarde o número CAAE (Cadastro de Apresentações de Avaliação Ética) gerado após a submissão',
        'Acompanhe o status do parecer — prazo legal é 30 dias (podendo chegar a 60)',
      ]
    }
  }

  switch (etapa.tipo) {
    case 'preparacao': return [
      'Clique em "Gerar com IA" abaixo para gerar uma revisão de literatura do seu tema',
      'Revise o conteúdo gerado com seu orientador e adapte ao contexto local',
      'Use a revisão para fundamentar a justificativa e os objetivos do projeto',
      'Identifique os instrumentos validados existentes (escalas, questionários)',
      'Defina claramente a pergunta de pesquisa antes de avançar',
    ]
    case 'aguardar': return [
      'Acompanhe o status na Plataforma Brasil regularmente',
      'Em caso de pendência, responda dentro do prazo indicado pelo CEP',
      'Aproveite o período para finalizar os instrumentos de coleta',
      'Se o parecer for aprovado, avance para a próxima etapa',
    ]
    case 'coleta': return [
      'Gere abaixo o Instrumento de Coleta personalizado para sua pesquisa — questionário com todas as questões e escalas adequadas',
      'Gere o Guia Operacional de Coleta — roteiro passo a passo de como abordar participantes, coletar o TCLE e aplicar o instrumento',
      'Gere o Cálculo Amostral — justificativa estatística do número de participantes com poder e nível de significância',
      'Com esses documentos prontos, imprima o instrumento (1 cópia por participante, sem nome — use número de ID)',
      'Aplique após assinatura do TCLE e guarde os dados digitalizados com backup em dois locais',
    ]
    case 'analise': return [
      'Gere o Guia de Análise Estatística personalizado — testes específicos para seu delineamento, com código para R ou SPSS',
      'O guia inclui: limpeza dos dados, análise descritiva, verificação de premissas, testes inferenciais e interpretação',
      'Siga o passo a passo do guia ou encaminhe-o a um estatístico com seus dados — muitas universidades oferecem assessoria gratuita',
      'Após a análise, insira os resultados no painel "Dados da Pesquisa" para que a IA use-os ao gerar os Resultados e a Discussão',
    ]
    case 'escrita': return [
      'Use o editor do Científica AI para gerar cada seção com auxílio de IA',
      'Revise e adapte o conteúdo gerado inserindo seus dados reais coletados',
      'Siga as normas ABNT/Vancouver/APA conforme o formato do trabalho',
      'Valide cada seção antes de avançar para a próxima',
      'Peça feedback do orientador ao final de cada capítulo principal',
    ]
    case 'submissao': return [
      'Selecione o periódico ou banca adequada ao escopo do trabalho',
      'Leia atentamente as normas de submissão do periódico/instituição',
      'Prepare todos os documentos exigidos: carta, declarações, formulários',
      'Submeta o manuscrito e anote o número de protocolo/protocolo de defesa',
      'Aguarde e responda às revisões ou perguntas da banca/revisores',
    ]
    default: return []
  }
}

// ─── Documentos disponíveis por etapa ─────────────────────────────────────────
// Baseado no tipo E no appExecuta computado — não usa "primeiro de cada tipo".

function getDocumentosEtapa(
  etapa: EtapaRoadmap,
  appExecuta: boolean,
  dadosProjeto?: DadosProjeto | null
): DocumentoEtapa[] {
  if (!appExecuta) return []   // etapas manuais não têm documentos da IA

  switch (etapa.tipo) {
    case 'preparacao':
      return [
        { tipo: 'revisao_literatura', label: 'Revisão de Literatura', descricao: 'Síntese das publicações sobre o tema, lacunas e embasamento teórico' },
      ]
    case 'etica': {
      const docs: DocumentoEtapa[] = []
      const t = etapa.titulo.toLowerCase()
      // Etapa específica de carta de anuência → só a carta
      if (t.includes('carta') || t.includes('anuência') || t.includes('anuencia') || t.includes('obter')) {
        if (!dadosProjeto || dadosProjeto.precisa_carta_anuencia)
          docs.push({ tipo: 'carta_anuencia', label: 'Carta de Anuência', descricao: 'Modelo de autorização para coleta a assinatura do responsável institucional' })
      } else {
        // Elaborar protocolo: protocolo CEP + TCLE
        if (!dadosProjeto || dadosProjeto.precisa_cep)
          docs.push({ tipo: 'protocolo_cep', label: 'Protocolo CEP', descricao: 'Documento formal para submissão ao CEP via Plataforma Brasil' })
        if (!dadosProjeto || dadosProjeto.precisa_tcle)
          docs.push({ tipo: 'tcle', label: 'TCLE — Termo de Consentimento Livre e Esclarecido', descricao: 'Documento de concordância voluntária do participante' })
      }
      return docs
    }
    case 'coleta':
      return [
        { tipo: 'instrumento_coleta', label: 'Instrumento de Coleta', descricao: 'Questionário completo com questões, escalas e codificação para análise' },
        { tipo: 'calculo_amostral', label: 'Cálculo Amostral', descricao: 'Justificativa estatística do N necessário com poder e significância' },
        { tipo: 'guia_coleta', label: 'Guia Operacional de Coleta', descricao: 'Roteiro passo a passo para abordar participantes e aplicar o instrumento' },
      ]
    case 'analise':
      return [{ tipo: 'guia_analise', label: 'Guia de Análise Estatística', descricao: 'Testes específicos para seu delineamento com código R/SPSS e interpretação' }]
    case 'submissao':
      return [
        { tipo: 'sugestoes_periodicos', label: 'Sugestões de Periódicos', descricao: 'Revistas adequadas com Qualis, JCR e URLs' },
        { tipo: 'carta_submissao', label: 'Carta de Submissão', descricao: 'Cover letter para o editor do periódico' },
        { tipo: 'checklist_submissao', label: 'Checklist de Submissão', descricao: 'Verificação completa antes de enviar' },
      ]
    default:
      return []
  }
}

// ─── Extrai o primeiro objeto JSON completo de um texto ──────────────────────
// Usa bracket-matching com awareness de strings — ignora texto antes/depois.

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape)           { escape = false; continue }
    if (ch === '\\' && inString) { escape = true;  continue }
    if (ch === '"')       { inString = !inString;  continue }
    if (inString)         continue

    if (ch === '{')       depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.substring(start, i + 1)
    }
  }
  return null   // JSON incompleto (truncado)
}

// ─── Fallback: mapeia categoria → etapa_tipo (planos antigos sem etapa_tipo) ─

function categoriaParaEtapaTipo(categoria: string): EtapaRoadmap['tipo'] | null {
  switch (categoria) {
    case 'etica':
    case 'institucional': return 'etica'
    case 'metodologia':   return 'preparacao'
    case 'coleta':        return 'coleta'
    case 'escrita':       return 'escrita'
    default:              return null
  }
}

// ─── O que fazer com cada documento após gerar ───────────────────────────────

const USO_DOCUMENTO: Record<string, { acao: string; detalhe: string }> = {
  revisao_literatura: {
    acao: 'Use este texto como base para a Introdução e Justificativa do seu trabalho',
    detalhe: 'Revise com seu orientador, adicione referências locais que você conhece e adapte ao contexto específico da sua pesquisa. No editor, a IA vai expandir cada seção usando esta revisão.',
  },
  protocolo_cep: {
    acao: 'Preencha os campos em [colchetes] e submeta na Plataforma Brasil',
    detalhe: 'Acesse plataformabrasil.saude.gov.br → Nova Pesquisa → anexe como "Projeto Completo" em PDF.',
  },
  carta_anuencia: {
    acao: 'Imprima em papel timbrado e colete a assinatura do diretor',
    detalhe: 'Após assinada, digitalize e adicione na Plataforma Brasil junto com o protocolo CEP.',
  },
  tcle: {
    acao: 'Imprima 2 vias por participante — uma fica com ele, outra com você',
    detalhe: 'Colete a assinatura ANTES de aplicar o questionário. Guarde em local seguro por pelo menos 5 anos.',
  },
  instrumento_coleta: {
    acao: 'Imprima uma cópia por participante — use número sequencial de ID, nunca o nome',
    detalhe: 'Revise cada questionário antes de o participante ir embora. Ao final do dia, digitalize em planilha com os mesmos IDs do TCLE.',
  },
  calculo_amostral: {
    acao: 'Inclua este cálculo na seção de Métodos do trabalho e no protocolo CEP',
    detalhe: 'O cálculo amostral justifica o N necessário para detectar o efeito esperado com poder estatístico adequado. É exigido pelo CEP e pelos periódicos.',
  },
  guia_coleta: {
    acao: 'Leve para campo e use como checklist a cada dia de coleta',
    detalhe: 'Distribua para todos os pesquisadores/auxiliares que vão aplicar o instrumento.',
  },
  guia_analise: {
    acao: 'Siga o passo a passo no software indicado — ou encaminhe a um estatístico',
    detalhe: 'O guia contém o código pronto para R ou SPSS. Se não tiver familiaridade com estatística, envie este guia ao estatístico junto com seus dados. Muitas universidades oferecem assessoria gratuita.',
  },
  sugestoes_periodicos: {
    acao: 'Escolha 1 periódico e leia o Guia de Autores antes de formatar o artigo',
    detalhe: 'Acesse o link de submissão do periódico escolhido. Cada periódico tem regras específicas de formatação.',
  },
  carta_submissao: {
    acao: 'Preencha os campos em [colchetes], assine e envie junto com o manuscrito',
    detalhe: 'Enviada no sistema de submissão do periódico, na mesma etapa em que você faz o upload do artigo.',
  },
  checklist_submissao: {
    acao: 'Marque cada item ANTES de clicar em "Submeter" no sistema do periódico',
    detalhe: 'Manuscritos rejeitados por erro formal atrasam meses. Vale a pena verificar cada item com calma.',
  },
}

// ─── Próximo passo após completar cada tipo de etapa ─────────────────────────

function getProximoPasso(tipo: EtapaRoadmap['tipo'], dadosProjeto: DadosProjeto): string {
  switch (tipo) {
    case 'preparacao':
      return dadosProjeto.envolve_seres_humanos
        ? 'Quando tiver o projeto definido, avance para a etapa de ética (CEP) — obrigatória para pesquisas com seres humanos.'
        : 'Quando tiver o projeto definido, avance para a etapa de busca bibliográfica ou coleta de dados.'
    case 'etica':
      return 'Após submeter na Plataforma Brasil, aguarde o parecer. O prazo legal é de 30 dias, mas pode levar até 60.'
    case 'aguardar':
      return 'Aprovação em mãos? Avance para a coleta de dados. Reprovação? Responda às pendências dentro do prazo indicado pelo CEP.'
    case 'coleta':
      return 'Dados coletados e digitados em planilha? Avance para a análise estatística.'
    case 'analise':
      return 'Com os resultados em mãos (tabelas e gráficos), use o editor do app para escrever cada seção do trabalho.'
    case 'escrita':
      return 'Revise com seu orientador antes de submeter. Peça também revisão de um colega da área.'
    case 'submissao':
      return 'Após a submissão, anote o número de protocolo e aguarde a resposta dos revisores/banca.'
  }
}

const TIPO_LABELS: Record<string, string> = {
  tcc: 'TCC',
  artigo_original: 'Artigo Original',
  artigo_revisao: 'Artigo de Revisão',
  relato_caso: 'Relato de Caso',
  monografia: 'Monografia',
  dissertacao_mestrado: 'Dissertação de Mestrado',
  tese_doutorado: 'Tese de Doutorado',
  revisao_sistematica: 'Revisão Sistemática',
  projeto_pesquisa: 'Projeto de Pesquisa',
  relatorio_ic: 'Relatório de IC',
}

const COLETA_LABELS: Record<string, string> = {
  primaria: 'Coleta Primária',
  secundaria: 'Coleta Secundária',
  bibliografica: 'Pesquisa Bibliográfica',
}

// ─── componente principal ─────────────────────────────────────────────────────

export function ProjetoCriadorClient({ trabalho, dadosProjetoInicial, documentosInicial }: ProjetoCriadorClientProps) {
  const router = useRouter()

  const [step, setStep] = useState<Step>(dadosProjetoInicial ? 'plano' : 'input')
  const [descricao, setDescricao] = useState('')

  // Guided form fields
  const [tema, setTema] = useState('')
  const [populacao, setPopulacao] = useState('')
  const [local, setLocal] = useState('')
  const [nivel, setNivel] = useState<string>('')
  const [temDados, setTemDados] = useState(false)
  const [dadosColetados, setDadosColetados] = useState('')

  const [streamingText, setStreamingText] = useState('')
  const [planData, setPlanData] = useState<DadosProjeto | null>(dadosProjetoInicial)
  const [salvando, setSalvando] = useState(false)

  // Roadmap interaction state
  const [expandedEtapas, setExpandedEtapas] = useState<Set<string>>(new Set())
  // Inline document editing
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editBuffer, setEditBuffer] = useState<Record<string, string>>({})
  const [refineInput, setRefineInput] = useState<Record<string, string>>({})
  const [refineLoading, setRefineLoading] = useState<Record<string, boolean>>({})
  const [docsMap, setDocsMap] = useState<DocsMap>(() => {
    if (!documentosInicial) return {}
    const initial: DocsMap = {}
    for (const [key, conteudo] of Object.entries(documentosInicial)) {
      if (conteudo) initial[key] = { status: 'gerado', conteudo }
    }
    return initial
  })
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Checklist state — merged from planData + local toggles
  const [checklistStatus, setChecklistStatus] = useState<Record<string, boolean>>(() => {
    if (!dadosProjetoInicial) return {}
    const saved = dadosProjetoInicial.checklist_status ?? {}
    const fromItems: Record<string, boolean> = {}
    for (const item of dadosProjetoInicial.checklist ?? []) {
      fromItems[item.id] = saved[item.id] ?? item.concluido
    }
    return fromItems
  })

  // Etapa statuses — local state derived from planData
  const [etapaStatuses, setEtapaStatuses] = useState<Record<string, EtapaStatus>>(() => {
    if (!dadosProjetoInicial) return {}
    const statuses: Record<string, EtapaStatus> = {}
    for (const etapa of dadosProjetoInicial.roadmap ?? []) {
      statuses[etapa.id] = etapa.status ?? 'pendente'
    }
    return statuses
  })

  const streamRef = useRef<string>('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Persist partial dados_projeto ─────────────────────────────────────────

  const persistDadosProjeto = useCallback(
    async (partial: Partial<DadosProjeto>) => {
      if (!planData) return
      try {
        await fetch(`/api/trabalhos/${trabalho.id}/projeto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dados_projeto: { ...planData, ...partial } }),
        })
      } catch (err) {
        console.error('[ProjetoCriador] Erro ao salvar parcial:', err)
      }
    },
    [planData, trabalho.id]
  )

  // ── Persiste um documento gerado no banco ────────────────────────────────

  const salvarDocumento = useCallback(
    async (key: string, conteudo: string) => {
      try {
        await fetch(`/api/trabalhos/${trabalho.id}/projeto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentos_projeto: { [key]: conteudo } }),
        })
      } catch (err) {
        console.error('[ProjetoCriador] Erro ao salvar documento:', err)
      }
    },
    [trabalho.id]
  )

  // ── Debounced checklist save ──────────────────────────────────────────────

  const debouncedSaveChecklist = useCallback(
    (newStatus: Record<string, boolean>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void persistDadosProjeto({ checklist_status: newStatus })
      }, 1000)
    },
    [persistDadosProjeto]
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Checklist toggle ──────────────────────────────────────────────────────

  const handleChecklistToggle = useCallback(
    (itemId: string) => {
      setChecklistStatus(prev => {
        const newStatus = { ...prev, [itemId]: !prev[itemId] }
        debouncedSaveChecklist(newStatus)
        return newStatus
      })
    },
    [debouncedSaveChecklist]
  )

  // ── Etapa status cycle ────────────────────────────────────────────────────

  const handleEtapaStatusChange = useCallback(
    (etapaId: string) => {
      setEtapaStatuses(prev => {
        const current = prev[etapaId] ?? 'pendente'
        const next = nextEtapaStatus(current)
        const newStatuses = { ...prev, [etapaId]: next }

        // Save updated roadmap to DB
        if (planData) {
          const updatedRoadmap = planData.roadmap.map(e =>
            e.id === etapaId ? { ...e, status: next } : e
          )
          void persistDadosProjeto({ roadmap: updatedRoadmap })
        }

        return newStatuses
      })
    },
    [planData, persistDadosProjeto]
  )

  // ── Toggle expanded etapa ─────────────────────────────────────────────────

  const toggleEtapa = useCallback((etapaId: string) => {
    setExpandedEtapas(prev => {
      const next = new Set(prev)
      if (next.has(etapaId)) {
        next.delete(etapaId)
      } else {
        next.add(etapaId)
      }
      return next
    })
  }, [])

  // ── Document generation ───────────────────────────────────────────────────

  const handleGerarDocumento = useCallback(
    async (etapaId: string, tipoDocumento: TipoDocumento) => {
      const key = `${etapaId}_${tipoDocumento}`
      setDocsMap(prev => ({
        ...prev,
        [key]: { status: 'gerando', conteudo: '' },
      }))

      try {
        let res = await fetch('/api/ia/gerar-documento-projeto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trabalhoId: trabalho.id, tipoDocumento }),
        })

        // Se o plano não está no banco (foi gerado mas não salvo), salva e tenta de novo
        if (res.status === 400) {
          const errBody = await res.json().catch(() => ({ error: '' })) as { error?: string }
          if (errBody.error?.includes('Projeto não encontrado') && planData) {
            await fetch(`/api/trabalhos/${trabalho.id}/projeto`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dados_projeto: planData }),
            })
            // Retry após salvar
            res = await fetch('/api/ia/gerar-documento-projeto', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trabalhoId: trabalho.id, tipoDocumento }),
            })
          } else {
            throw new Error(errBody.error ?? `Erro ${res.status}`)
          }
        }

        if (!res.ok) {
          const statusCode = res.status
          const err = await res.json().catch(() => ({})) as { error?: string }
          if (statusCode === 429) throw new Error('Limite de requisições atingido. Aguarde 1 minuto e tente novamente.')
          if (statusCode === 504) throw new Error('A IA demorou muito para responder. Tente novamente — documentos longos podem levar até 2 minutos.')
          if (statusCode >= 500) throw new Error(err.error ?? 'Erro interno no servidor. Tente novamente em instantes.')
          throw new Error(err.error ?? `Erro ${statusCode}`)
        }

        if (!res.body) throw new Error('Sem stream')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setDocsMap(prev => ({
            ...prev,
            [key]: { status: 'gerando', conteudo: accumulated },
          }))
        }

        // Verificar se algo foi realmente gerado
        if (!accumulated.trim()) {
          throw new Error('A IA não retornou conteúdo. Tente novamente.')
        }

        setDocsMap(prev => ({
          ...prev,
          [key]: { status: 'gerado', conteudo: accumulated },
        }))

        // Persiste no banco — silencioso, não bloqueia o fluxo
        void salvarDocumento(key, accumulated)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao gerar documento. Tente novamente.'
        setDocsMap(prev => ({
          ...prev,
          [key]: { status: 'erro', conteudo: '', erro: msg },
        }))
        toast.error(msg)
      }
    },
    [trabalho.id, planData, salvarDocumento]
  )

  // ── Copy to clipboard ─────────────────────────────────────────────────────

  const handleCopy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2000)
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }, [])

  // ── Download como .txt ────────────────────────────────────────────────────

  const handleDownload = useCallback((texto: string, nomeDoc: string) => {
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nomeDoc.replace(/[^a-zA-Z0-9À-ú\s]/g, '').trim().replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // ── Imprimir documento ────────────────────────────────────────────────────

  const handleImprimir = useCallback((texto: string, nomeDoc: string, tituloTrabalho: string) => {
    const linhas = texto
      .split('\n')
      .map(l => {
        // Títulos markdown → <h2>/<h3>
        if (/^### /.test(l)) return `<h3>${l.replace(/^### /, '')}</h3>`
        if (/^## /.test(l))  return `<h2>${l.replace(/^## /, '')}</h2>`
        if (/^# /.test(l))   return `<h1>${l.replace(/^# /, '')}</h1>`
        // Negrito **texto**
        const formatted = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        if (formatted.trim() === '') return '<br/>'
        return `<p>${formatted}</p>`
      })
      .join('\n')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${nomeDoc}</title>
  <style>
    @page { margin: 2.5cm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; color: #000; }
    h1 { font-size: 14pt; text-align: center; margin: 24pt 0 12pt; text-transform: uppercase; }
    h2 { font-size: 13pt; margin: 18pt 0 8pt; }
    h3 { font-size: 12pt; margin: 14pt 0 6pt; }
    p  { margin: 0 0 8pt; text-align: justify; }
    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 12pt; margin-bottom: 18pt; }
    .header small { font-size: 10pt; color: #333; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <small>${tituloTrabalho}</small><br/>
    <strong>${nomeDoc}</strong><br/>
    <small>Gerado em ${new Date().toLocaleDateString('pt-BR')} pelo Científica AI</small>
  </div>
  ${linhas}
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (w) {
      w.document.write(html)
      w.document.close()
    } else {
      toast.error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.')
    }
  }, [])

  // ── Salvar edição manual de documento ────────────────────────────────────

  const handleSalvarEdicao = useCallback(
    (key: string) => {
      const conteudo = editBuffer[key]
      if (conteudo === undefined) return
      setDocsMap(prev => ({ ...prev, [key]: { status: 'gerado', conteudo } }))
      setEditingKey(null)
      void salvarDocumento(key, conteudo)
    },
    [editBuffer, salvarDocumento]
  )

  // ── Refinar documento com IA ──────────────────────────────────────────────

  const handleRefinarDocumento = useCallback(
    async (key: string, tipoDocumento: TipoDocumento) => {
      const conteudoAtual = editBuffer[key] ?? docsMap[key]?.conteudo ?? ''
      const instrucoes = refineInput[key] ?? ''
      if (!instrucoes.trim()) {
        toast.error('Descreva o que você quer alterar antes de refinar.')
        return
      }
      setRefineLoading(prev => ({ ...prev, [key]: true }))
      try {
        const res = await fetch('/api/ia/refinar-documento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trabalhoId: trabalho.id, tipoDocumento, conteudo_atual: conteudoAtual, instrucoes }),
        })
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error ?? 'Erro ao refinar')
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setEditBuffer(prev => ({ ...prev, [key]: accumulated }))
        }
        // Auto-salva versão refinada
        setDocsMap(prev => ({ ...prev, [key]: { status: 'gerado', conteudo: accumulated } }))
        setRefineInput(prev => ({ ...prev, [key]: '' }))
        // Clear stale editBuffer entry so next manual edit starts from the refined content
        setEditBuffer(prev => { const n = { ...prev }; delete n[key]; return n })
        setEditingKey(null)
        void salvarDocumento(key, accumulated)
        toast.success('Documento refinado e salvo!')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao refinar. Tente novamente.')
      } finally {
        setRefineLoading(prev => ({ ...prev, [key]: false }))
      }
    },
    [editBuffer, docsMap, refineInput, trabalho.id, salvarDocumento]
  )

  // ── buildDescricao — combina os campos do formulário guiado ────────────────

  function buildDescricao(): string {
    let d = tema.trim()
    if (populacao.trim()) d += `\n\nParticipantes/população: ${populacao.trim()}`
    if (local.trim()) d += `\nLocal onde será feita: ${local.trim()}`
    if (nivel) d += `\nNível acadêmico do pesquisador: ${nivel}`
    if (temDados && dadosColetados.trim()) d += `\n\nDados já coletados pelo pesquisador:\n${dadosColetados.trim()}`
    return d
  }

  // ── Geração do plano ──────────────────────────────────────────────────────

  async function handleGerarPlano() {
    if (tema.trim().length < 20) return
    const desc = buildDescricao()
    setDescricao(desc)
    setStep('gerando')
    setStreamingText('')
    streamRef.current = ''

    try {
      const res = await fetch('/api/ia/planejar-projeto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: desc, trabalhoId: trabalho.id }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Erro ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `Erro ${res.status}`)
      }

      if (!res.body) throw new Error('Sem stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        streamRef.current += decoder.decode(value, { stream: true })
        setStreamingText(streamRef.current)
      }

      const fullText = streamRef.current
      const parts = fullText.split('===PLANO_JSON===')
      const afterDelim = parts[1]
      if (!afterDelim) throw new Error('Plano não foi gerado corretamente. Tente novamente.')

      // Salva o texto da análise (PARTE 1) para persistir no banco
      const analiseOrientador = parts[0].trim() || undefined

      // Extrai o JSON usando bracket-matching (ignora texto antes/depois do objeto)
      const jsonStr = extractJsonObject(afterDelim)
      if (!jsonStr) throw new Error('O plano ficou incompleto. Tente novamente — pode ser necessário simplificar a descrição.')

      const parsed = JSON.parse(jsonStr) as Omit<DadosProjeto, 'descricao_original' | 'criado_em' | 'confirmado'>
      const dadosProjeto: DadosProjeto = {
        ...parsed,
        descricao_original: desc,
        analise_orientador: analiseOrientador,
        dados_coletados: temDados && dadosColetados.trim() ? dadosColetados.trim() : undefined,
        criado_em: new Date().toISOString(),
        confirmado: false,
      }

      // Init local status state from new plan
      const statuses: Record<string, EtapaStatus> = {}
      for (const etapa of dadosProjeto.roadmap ?? []) {
        statuses[etapa.id] = etapa.status ?? 'pendente'
      }
      setEtapaStatuses(statuses)

      const checkStatus: Record<string, boolean> = {}
      for (const item of dadosProjeto.checklist ?? []) {
        checkStatus[item.id] = item.concluido
      }
      setChecklistStatus(checkStatus)

      setPlanData(dadosProjeto)

      // Auto-save to DB so document generation API works immediately
      // (documents are generated via API that reads from DB, not local state)
      try {
        await fetch(`/api/trabalhos/${trabalho.id}/projeto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dados_projeto: dadosProjeto }),
        })
      } catch (saveErr) {
        console.warn('[ProjetoCriador] Auto-save falhou:', saveErr)
      }

      setStep('plano')
    } catch (err) {
      console.error('Erro ao gerar plano:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar plano. Tente novamente.')
      setStep('input')
    }
  }

  // ── Salvar e ir ao editor ──────────────────────────────────────────────────

  async function salvarESeguir() {
    if (!planData) return
    setSalvando(true)
    try {
      const dadosProjetoFinal: DadosProjeto = {
        ...planData,
        checklist_status: checklistStatus,
        roadmap: planData.roadmap.map(e => ({
          ...e,
          status: etapaStatuses[e.id] ?? e.status ?? 'pendente',
        })),
        confirmado: true,
      }

      const res = await fetch(`/api/trabalhos/${trabalho.id}/projeto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dados_projeto: dadosProjetoFinal }),
      })

      if (!res.ok) throw new Error('Falha ao salvar')
      router.push(`/trabalhos/${trabalho.id}/editar`)
    } catch (err) {
      console.error('Erro ao salvar:', err)
      toast.error('Erro ao salvar o plano. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Progresso do checklist ────────────────────────────────────────────────

  const totalChecklist = planData?.checklist?.length ?? 0
  const doneChecklist = Object.values(checklistStatus).filter(Boolean).length
  const progressPct = totalChecklist > 0 ? Math.round((doneChecklist / totalChecklist) * 100) : 0

  // ─── Layout base ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <PageHeader
          title="Projeto de Pesquisa"
          description={trabalho.titulo ?? 'Trabalho sem título'}
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Meus Trabalhos', href: '/trabalhos' },
            { label: trabalho.titulo ?? 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
            { label: 'Projeto' },
          ]}
          actions={
            <Link
              href={`/trabalhos/${trabalho.id}/editar`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Editor
            </Link>
          }
        />
      </div>

      {/* ── Estado: input ─────────────────────────────────────────────────── */}
      {step === 'input' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              Planeje seu projeto de pesquisa
            </h2>
            <p className="text-sm text-muted-foreground">
              Responda às perguntas abaixo — a IA cria o plano completo, incluindo CEP, roadmap e cronograma
            </p>
          </div>

          {/* Campo 1 — Tema principal (obrigatório) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="tema">
              O que você quer pesquisar? <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground -mt-1">Tema ou problema principal</p>
            <textarea
              id="tema"
              rows={4}
              value={tema}
              onChange={e => setTema(e.target.value)}
              placeholder="Ex: Quero estudar o impacto da carga de trabalho dos enfermeiros na qualidade do cuidado em UTIs. / Quero avaliar se o uso de redes sociais afeta a autoestima de adolescentes. / Quero analisar os prontuários de pacientes com diabetes tipo 2 em uma UBS."
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {tema.length} caracteres{tema.length < 20 ? ` — mínimo de 20` : ''}
            </p>
          </div>

          {/* Campo 2 — Participantes/objeto */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="populacao">
              Com quem ou sobre o quê?
            </label>
            <p className="text-xs text-muted-foreground -mt-1">Participantes ou objeto de estudo</p>
            <input
              id="populacao"
              type="text"
              value={populacao}
              onChange={e => setPopulacao(e.target.value)}
              placeholder="Ex: Enfermeiros de UTI adulta, 40-80 profissionais / Adolescentes de 14-18 anos de escolas públicas / Prontuários de 2019-2023"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Campo 3 — Local */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="local">
              Onde vai ser feita?
            </label>
            <p className="text-xs text-muted-foreground -mt-1">Local da pesquisa</p>
            <input
              id="local"
              type="text"
              value={local}
              onChange={e => setLocal(e.target.value)}
              placeholder="Ex: Hospital universitário de São Paulo / 5 escolas municipais de BH / Arquivo médico de uma UBS"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Campo 4 — Nível acadêmico */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="nivel">
              Qual é o seu nível acadêmico?
            </label>
            <select
              id="nivel"
              value={nivel}
              onChange={e => setNivel(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            >
              <option value="">Selecione...</option>
              <option value="Graduação (TCC)">Graduação (TCC)</option>
              <option value="Especialização / Residência">Especialização / Residência</option>
              <option value="Mestrado">Mestrado</option>
              <option value="Doutorado">Doutorado</option>
              <option value="Profissional da área (sem vínculo acadêmico atual)">Profissional da área (sem vínculo acadêmico atual)</option>
            </select>
          </div>

          {/* Campo 5 — Tem dados? */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Você já tem dados coletados?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTemDados(false)}
                className={cn(
                  'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                  !temDados
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-muted'
                )}
              >
                Ainda não tenho
              </button>
              <button
                type="button"
                onClick={() => setTemDados(true)}
                className={cn(
                  'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                  temDados
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-muted'
                )}
              >
                Já tenho dados
              </button>
            </div>
          </div>

          {/* Campo 6 — Dados coletados (condicional) */}
          {temDados && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="dadosColetados">
                Quais foram os principais resultados?
              </label>
              <p className="text-xs text-muted-foreground -mt-1">Seus dados e resultados principais</p>
              <textarea
                id="dadosColetados"
                rows={5}
                value={dadosColetados}
                onChange={e => setDadosColetados(e.target.value)}
                placeholder={
                  'Cole aqui seus achados:\nEx: N=80 enfermeiros responderam\n65% relataram sobrecarga moderada/intensa\nMédia de horas extras: 12h/semana\nCorrelação com qualidade do cuidado: r=-0.42 (p<0.001)'
                }
                className="w-full resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground font-mono"
              />
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 p-3 text-xs text-blue-800 dark:text-blue-200">
                <span className="font-semibold">Dica:</span> Quanto mais dados reais você inserir, mais precisa e personalizada será a seção Resultados quando você for escrever no editor.
              </div>
            </div>
          )}

          {/* Info box permanente */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 p-3 text-xs text-blue-800 dark:text-blue-200">
            📋 Os dados que você inserir aqui ficam salvos no projeto. Quando for escrever a seção Resultados no editor, o app vai usar esses dados automaticamente.
          </div>

          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 p-4 text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">Dica: </span>
            Quanto mais detalhes você der (onde, com quem, como), mais preciso será o plano. Inclua
            informações sobre o local da pesquisa, o público-alvo e os instrumentos que pretende usar.
          </div>

          <button
            onClick={handleGerarPlano}
            disabled={tema.trim().length < 20}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'w-full gap-2',
              tema.trim().length < 20 && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ClipboardList className="h-5 w-5" />
            Criar Plano do Projeto
          </button>

          <div className="text-center">
            <Link
              href={`/trabalhos/${trabalho.id}/editar`}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Já tenho um projeto definido — Ir direto ao editor
            </Link>
          </div>
        </div>
      )}

      {/* ── Estado: gerando ───────────────────────────────────────────────── */}
      {step === 'gerando' && (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-base font-medium text-foreground">
              Analisando sua ideia de pesquisa...
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              A IA está criando um plano detalhado com roadmap, checklist e orientações sobre CEP.
            </p>
          </div>

          {streamingText && (
            <div className="rounded-lg border bg-muted/40 p-4 max-h-80 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {streamingText.split('===PLANO_JSON===')[0]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Estado: plano ─────────────────────────────────────────────────── */}
      {step === 'plano' && planData && (
        <div className="space-y-6">

          {/* Header card */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-start gap-4">
            <CheckCircle2 className="h-7 w-7 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-700 mb-0.5">Plano criado com sucesso</p>
              <h2 className="text-lg font-bold text-green-900">{planData.titulo_provisorio}</h2>
            </div>
          </div>

          {/* Análise do orientador virtual — logo abaixo do header */}
          {(() => {
            const textoAnalise = planData.analise_orientador
              ?? (streamingText ? streamingText.split('===PLANO_JSON===')[0].trim() : '')
            return textoAnalise ? (
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-4">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
                  Análise do Orientador Virtual
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {textoAnalise}
                </p>
              </div>
            ) : null
          })()}

          {/* Progress bar */}
          {totalChecklist > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  Progresso do Projeto
                </span>
                <span className="text-sm text-muted-foreground">
                  {doneChecklist} de {totalChecklist} concluídos
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{progressPct}% completo</p>
            </div>
          )}

          {/* Alertas */}
          {planData.alertas && planData.alertas.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Atenção</span>
              </div>
              <ul className="space-y-1">
                {planData.alertas.map((alerta, i) => (
                  <li key={i} className="text-sm text-amber-800 flex gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span>{alerta}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Visão geral */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-3">Visão Geral</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Tipo de Trabalho" value={TIPO_LABELS[planData.tipo_trabalho_sugerido] ?? planData.tipo_trabalho_sugerido} />
              <InfoCard label="Delineamento" value={planData.delineamento} />
              <InfoCard label="Tipo de Coleta" value={COLETA_LABELS[planData.tipo_coleta] ?? planData.tipo_coleta} />
              <InfoCard
                label="Tempo Estimado"
                value={planData.tempo_total_estimado}
                icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            </div>
          </div>

          {/* Pergunta e objetivo */}
          <div className="space-y-3">
            <DetailCard label="Pergunta de Pesquisa" value={planData.pergunta_pesquisa} />
            <DetailCard label="Objetivo Geral" value={planData.objetivo_geral} />
            {planData.justificativa_resumida && (
              <DetailCard label="Justificativa" value={planData.justificativa_resumida} />
            )}
          </div>

          {/* CEP / Ética */}
          {planData.envolve_seres_humanos && (
            <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                    Aprovação ética obrigatória (CEP/Plataforma Brasil)
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Sua pesquisa envolve seres humanos. Pela Resolução CNS 466/2012, é obrigatória a
                    aprovação do Comitê de Ética em Pesquisa (CEP) antes do início da coleta de dados.
                    A submissão é feita pela Plataforma Brasil.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {planData.precisa_cep && <EticaBadge label="CEP (Comitê de Ética em Pesquisa)" />}
                    {planData.precisa_carta_anuencia && <EticaBadge label="Carta de Anuência" />}
                    {planData.precisa_tcle && <EticaBadge label="TCLE (Termo de Consentimento)" />}
                  </div>
                  <a
                    href="https://plataformabrasil.saude.gov.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300 underline underline-offset-2 hover:text-orange-900 dark:hover:text-orange-100 mt-1"
                  >
                    Acessar Plataforma Brasil
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Roadmap expandível */}
          {planData.roadmap && planData.roadmap.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-foreground mb-4">Roadmap do Projeto</h3>
              <div className="relative">
                {/* Linha vertical */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <ol className="space-y-4 pl-10">
                  {(() => {
                    // Rastreia quais tipos já foram renderizados para evitar duplicação de
                    // instruções e checklist quando o roadmap tem 2 etapas do mesmo tipo.
                    const tiposJaRenderizados = new Set<string>()
                    return planData.roadmap.map((etapaRaw) => {
                    // Normaliza tipo antes de qualquer lógica (corrige erros da IA)
                    const etapa = normalizeEtapa(etapaRaw)
                    // app_executa calculado no frontend — não depende do valor gerado pela IA
                    const appExecuta = computeAppExecuta(etapa)
                    const isExpanded = expandedEtapas.has(etapa.id)
                    const etapaStatus = etapaStatuses[etapa.id] ?? 'pendente'

                    // Instruções e checklist só aparecem na PRIMEIRA etapa de cada tipo.
                    // Se houver duas etapas 'coleta', a segunda não repete os mesmos itens.
                    const isPrimeiraDoTipo = !tiposJaRenderizados.has(etapa.tipo)
                    tiposJaRenderizados.add(etapa.tipo)

                    const instrucoes = isPrimeiraDoTipo ? getInstrucoesEtapa(etapa, appExecuta) : []
                    // Documentos baseados no appExecuta computado (não em "primeiro de cada tipo")
                    const documentosEtapa = getDocumentosEtapa(etapa, appExecuta, planData)
                    // Link para Plataforma Brasil em etapas de submissão de ética
                    const linkExterno = etapa.tipo === 'etica' && !appExecuta ? 'https://plataformabrasil.saude.gov.br' : null
                    const etapaChecklistItems = isPrimeiraDoTipo
                      ? (planData.checklist ?? []).filter(item => {
                          const tipo = item.etapa_tipo ?? categoriaParaEtapaTipo(item.categoria)
                          return tipo === etapa.tipo
                        })
                      : []
                    const hasDetails = instrucoes.length > 0 || documentosEtapa.length > 0 || !!linkExterno || etapaChecklistItems.length > 0

                    return (
                      <li key={etapa.id} className="relative">
                        {/* Marcador */}
                        <span className="absolute -left-6 flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border text-sm">
                          {etapaIcone(etapa.tipo)}
                        </span>

                        <div className={cn('rounded-lg border', etapaCor(etapa.tipo))}>
                          {/* Header da etapa — clicável para expandir */}
                          <button
                            type="button"
                            onClick={() => hasDetails && toggleEtapa(etapa.id)}
                            className={cn(
                              'w-full text-left p-4',
                              hasDetails && 'cursor-pointer'
                            )}
                          >
                            <div className="flex flex-wrap items-start gap-2 mb-1">
                              <span className="font-semibold text-base">{etapa.titulo}</span>

                              {etapa.bloqueante && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wide">
                                  Bloqueio
                                </span>
                              )}

                              {/* Status badge — clicável para ciclar */}
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  handleEtapaStatusChange(etapa.id)
                                }}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-80',
                                  etapaStatusBadge(etapaStatus)
                                )}
                              >
                                {etapaStatusLabel(etapaStatus)}
                              </button>

                              {appExecuta ? (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/60 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                                  <Cpu className="h-3 w-3" /> App faz com IA
                                </span>
                              ) : (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                                  <User className="h-3 w-3" /> Você faz
                                </span>
                              )}

                              {hasDetails && (
                                <span className="text-current opacity-50">
                                  {isExpanded
                                    ? <ChevronUp className="h-4 w-4" />
                                    : <ChevronDown className="h-4 w-4" />}
                                </span>
                              )}
                            </div>

                            <p className="text-sm leading-relaxed mb-2 text-foreground/80">{etapa.descricao}</p>

                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" /> {etapa.duracao_estimada}
                            </span>
                          </button>

                          {/* Conteúdo expandido */}
                          {isExpanded && hasDetails && (
                            <div className="border-t border-current/20 px-4 pb-4 pt-3 space-y-4 text-foreground">

                              {/* Instruções detalhadas — determinadas estaticamente no frontend */}
                              {instrucoes.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                    Como fazer
                                  </p>
                                  <ol className="space-y-2">
                                    {instrucoes.map((instrucao, idx) => (
                                      <li key={idx} className="flex gap-2 text-sm leading-relaxed text-foreground">
                                        <span className="flex-shrink-0 font-semibold text-muted-foreground w-4">{idx + 1}.</span>
                                        <span>{instrucao}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {/* Mini-checklist desta etapa — usa etapaChecklistItems já filtrado acima */}
                              {etapaChecklistItems.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                      Tarefas desta etapa
                                    </p>
                                    <div className="space-y-2">
                                      {etapaChecklistItems.map(item => {
                                        const done = checklistStatus[item.id] ?? false
                                        return (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleChecklistToggle(item.id)}
                                            className={cn(
                                              'w-full text-left rounded-lg border border-l-4 p-3 transition-opacity bg-background',
                                              urgenciaCor(item.urgencia),
                                              done && 'opacity-60'
                                            )}
                                          >
                                            <div className="flex items-start gap-3">
                                              <div className="flex-shrink-0 mt-0.5">
                                                {done
                                                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                  : <div className="h-4 w-4 rounded border-2 border-current opacity-40" />}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className={cn('text-sm font-medium text-foreground', done && 'line-through')}>
                                                    {item.item}
                                                  </span>
                                                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide', urgenciaBadge(item.urgencia))}>
                                                    {urgenciaLabel(item.urgencia)}
                                                  </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>
                                                {item.link_ajuda && (
                                                  <a
                                                    href={item.link_ajuda}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                                                  >
                                                    Saiba mais <ExternalLink className="h-3 w-3" />
                                                  </a>
                                                )}
                                              </div>
                                            </div>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                              )}

                              {/* Link externo — estático por tipo de etapa */}
                              {linkExterno && (
                                <a
                                  href={linkExterno}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Acessar Plataforma Brasil
                                </a>
                              )}

                              {/* Documentos IA — determinados estaticamente por tipo de etapa */}
                              {documentosEtapa.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                    Documentos
                                  </p>
                                  <div className="space-y-3">
                                    {documentosEtapa.map(doc => {
                                      const key = `${etapa.id}_${doc.tipo}`
                                      const docState = docsMap[key]

                                      return (
                                        <div key={doc.tipo} className="rounded-md bg-background border border-border p-3">
                                          <div className="flex items-start justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-1.5">
                                              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                              <span className="text-sm font-medium text-foreground">{doc.label}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                              {docState?.status === 'gerado' && (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleImprimir(docState.conteudo, doc.label, trabalho.titulo ?? '')}
                                                    className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
                                                    title="Abre janela de impressão — use 'Salvar como PDF' para gerar um PDF"
                                                  >
                                                    <Printer className="h-3 w-3" /> Imprimir
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDownload(docState.conteudo, doc.label)}
                                                    className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
                                                    title="Baixar como arquivo .txt para editar no Word"
                                                  >
                                                    <Download className="h-3 w-3" /> Baixar .txt
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleCopy(key, docState.conteudo)}
                                                    className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
                                                  >
                                                    {copiedKey === key
                                                      ? <><Check className="h-3 w-3" /> Copiado</>
                                                      : <><Copy className="h-3 w-3" /> Copiar</>}
                                                  </button>
                                                </>
                                              )}

                                              <button
                                                type="button"
                                                onClick={() => handleGerarDocumento(etapa.id, doc.tipo as TipoDocumento)}
                                                disabled={docState?.status === 'gerando'}
                                                className={cn(
                                                  'inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 font-medium transition-opacity',
                                                  'bg-primary text-primary-foreground hover:opacity-90',
                                                  docState?.status === 'gerando' && 'opacity-50 cursor-not-allowed'
                                                )}
                                              >
                                                {docState?.status === 'gerando' ? (
                                                  <><Loader2 className="h-3 w-3 animate-spin" /> Gerando...</>
                                                ) : docState?.status === 'gerado' ? (
                                                  <><RefreshCw className="h-3 w-3" /> Regerar</>
                                                ) : (
                                                  <>Gerar com IA</>
                                                )}
                                              </button>
                                            </div>
                                          </div>

                                          <p className="text-xs text-muted-foreground mb-2">{doc.descricao}</p>

                                          {/* Streaming → exibe durante geração */}
                                          {docState?.status === 'gerando' && docState.conteudo && (
                                            <div className="mt-2 rounded border border-border bg-muted/40 p-3 max-h-[32rem] overflow-y-auto">
                                              <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground font-sans">
                                                {docState.conteudo}
                                              </pre>
                                            </div>
                                          )}

                                          {/* Gerado → modo leitura ou edição */}
                                          {docState?.status === 'gerado' && (
                                            <>
                                              {editingKey === key ? (
                                                /* ── Modo edição ── */
                                                <div className="mt-2 space-y-2">
                                                  <textarea
                                                    rows={16}
                                                    value={editBuffer[key] ?? docState.conteudo}
                                                    onChange={e => setEditBuffer(prev => ({ ...prev, [key]: e.target.value }))}
                                                    className="w-full resize-y rounded-md border border-primary bg-background px-3 py-2 text-xs font-mono leading-relaxed shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                  />
                                                  {/* Refinar com IA */}
                                                  <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                                                    <p className="text-xs font-medium text-foreground">Refinar com IA — descreva o que alterar:</p>
                                                    <textarea
                                                      rows={2}
                                                      value={refineInput[key] ?? ''}
                                                      onChange={e => setRefineInput(prev => ({ ...prev, [key]: e.target.value }))}
                                                      placeholder='Ex: "Adicione o nome Dr. João Silva como pesquisador" ou "Inclua cláusula sobre sigilo por 5 anos"'
                                                      className="w-full resize-none rounded border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRefinarDocumento(key, doc.tipo as TipoDocumento)}
                                                      disabled={refineLoading[key] || !(refineInput[key]?.trim())}
                                                      className={cn(
                                                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground transition-opacity',
                                                        (refineLoading[key] || !refineInput[key]?.trim()) && 'opacity-50 cursor-not-allowed'
                                                      )}
                                                    >
                                                      {refineLoading[key]
                                                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Refinando...</>
                                                        : <><RefreshCw className="h-3 w-3" /> Aplicar com IA</>}
                                                    </button>
                                                  </div>
                                                  {/* Save / Cancel */}
                                                  <div className="flex gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSalvarEdicao(key)}
                                                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                                                    >
                                                      <CheckCircle2 className="h-3.5 w-3.5" /> Salvar edição
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setEditingKey(null)
                                                        setEditBuffer(prev => { const n = { ...prev }; delete n[key]; return n })
                                                      }}
                                                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
                                                    >
                                                      <X className="h-3.5 w-3.5" /> Cancelar
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                /* ── Modo leitura ── */
                                                <div className="mt-2 rounded border border-border bg-muted/40 p-3 max-h-[32rem] overflow-y-auto">
                                                  <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground font-sans">
                                                    {docState.conteudo}
                                                  </pre>
                                                </div>
                                              )}

                                              {/* Botões de ação — só no modo leitura */}
                                              {editingKey !== key && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingKey(key)
                                                      setEditBuffer(prev => ({ ...prev, [key]: docState.conteudo }))
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                                                  >
                                                    ✏️ Editar / Refinar com IA
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleImprimir(docState.conteudo, doc.label, trabalho.titulo ?? '')}
                                                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                                                  >
                                                    <Printer className="h-3.5 w-3.5" /> Imprimir / Salvar PDF
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDownload(docState.conteudo, doc.label)}
                                                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
                                                  >
                                                    <Download className="h-3.5 w-3.5" /> Baixar .txt
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleCopy(key, docState.conteudo)}
                                                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
                                                  >
                                                    {copiedKey === key
                                                      ? <><Check className="h-3.5 w-3.5" /> Copiado!</>
                                                      : <><Copy className="h-3.5 w-3.5" /> Copiar texto</>}
                                                  </button>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {/* O que fazer com este documento */}
                                          {docState?.status === 'gerado' && USO_DOCUMENTO[doc.tipo] && (
                                            <div className="mt-3 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-3">
                                              <div className="flex items-start gap-2">
                                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-0.5">
                                                    {USO_DOCUMENTO[doc.tipo].acao}
                                                  </p>
                                                  <p className="text-xs text-blue-700 dark:text-blue-300">
                                                    {USO_DOCUMENTO[doc.tipo].detalhe}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          )}

                                          {docState?.status === 'erro' && (
                                            <p className="mt-1 text-xs text-red-600">
                                              {docState.erro ?? 'Erro ao gerar. Tente novamente.'}
                                            </p>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Link direto ao editor para etapa de escrita */}
                              {etapa.tipo === 'escrita' && (
                                <Link
                                  href={`/trabalhos/${trabalho.id}/editar`}
                                  className={cn(
                                    buttonVariants({ size: 'sm' }),
                                    'w-full gap-2 justify-center'
                                  )}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                  Abrir Editor e escrever com IA
                                </Link>
                              )}

                              {/* Próximo passo */}
                              <div className="rounded-md bg-muted/60 border border-border p-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                  Próximo passo
                                </p>
                                <p className="text-sm text-foreground">
                                  {getProximoPasso(etapa.tipo, planData)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })
                  })()}
                </ol>
              </div>
            </div>
          )}

          {/* Checklist órfão — itens sem etapa_tipo e sem categoria mapeável */}
          {(() => {
            const orfaos = (planData.checklist ?? []).filter(item => {
              const tipo = item.etapa_tipo ?? categoriaParaEtapaTipo(item.categoria)
              return tipo === null
            })
            if (orfaos.length === 0) return null
            return (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3">Outras Tarefas</h3>
                <div className="space-y-2">
                  {orfaos.map(item => {
                    const done = checklistStatus[item.id] ?? false
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleChecklistToggle(item.id)}
                        className={cn(
                          'w-full text-left rounded-lg border border-l-4 p-3 transition-opacity',
                          urgenciaCor(item.urgencia),
                          done && 'opacity-60'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                              : <div className="h-4 w-4 rounded border-2 border-current opacity-40" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-sm font-medium text-foreground', done && 'line-through')}>
                                {item.item}
                              </span>
                              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide', urgenciaBadge(item.urgencia))}>
                                {urgenciaLabel(item.urgencia)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>
                            {item.link_ajuda && (
                              <a
                                href={item.link_ajuda}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                              >
                                Saiba mais <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Dados da Pesquisa — para inserir dados coletados */}
          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">Dados da Pesquisa</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Cole aqui seus dados coletados, resultados, tabelas ou achados. O editor usará essas informações ao gerar a seção Resultados.
            </p>
            <DadosPesquisaPanel
              trabalhoId={trabalho.id}
              dadosProjetoAtual={planData}
            />
          </div>

          {/* Ações */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setStep('input')
                setStreamingText('')
              }}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'flex-1 gap-2')}
            >
              <ArrowLeft className="h-4 w-4" /> Refazer o plano
            </button>
            <button
              onClick={salvarESeguir}
              disabled={salvando}
              className={cn(buttonVariants({ size: 'lg' }), 'flex-1 gap-2')}
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Plano aprovado — Iniciar redação
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── sub-componentes ──────────────────────────────────────────────────────────

// Infere o software mais adequado com base nos campos do projeto
interface SoftwareSugestao {
  valor: string
  motivo: string
}
function inferirSoftware(dados: DadosProjeto | null): SoftwareSugestao | null {
  if (!dados) return null
  const analise = (dados.analise_prevista ?? '').toLowerCase()
  const delineamento = (dados.delineamento ?? '').toLowerCase()
  const tipo = (dados.tipo_coleta ?? '').toLowerCase()

  // Pesquisa bibliográfica / revisão → não aplica
  if (tipo === 'bibliografica' || delineamento.includes('revisão') || delineamento.includes('revisao') || delineamento.includes('bibliográfica')) {
    return { valor: 'Não aplica (pesquisa bibliográfica)', motivo: 'Pesquisa bibliográfica não exige software estatístico.' }
  }
  // R mencionado explicitamente
  if (analise.includes(' r ') || analise.includes('(r)') || analise.startsWith('r,') || analise.includes(', r') || analise.includes('r studio') || analise.includes('rstudio')) {
    return { valor: 'R', motivo: 'R foi indicado no plano. Excelente para regressão, correlação e análises avançadas — gratuito e reproduzível.' }
  }
  // SPSS mencionado
  if (analise.includes('spss')) {
    return { valor: 'SPSS', motivo: 'SPSS foi indicado no plano. Interface amigável para análises descritivas e inferenciais, padrão em saúde e ciências sociais.' }
  }
  // Stata
  if (analise.includes('stata')) {
    return { valor: 'Stata', motivo: 'Stata foi indicado no plano. Excelente para dados longitudinais e epidemiológicos.' }
  }
  // Python
  if (analise.includes('python') || analise.includes('pandas') || analise.includes('scipy')) {
    return { valor: 'Python (pandas/scipy)', motivo: 'Python foi indicado no plano. Ideal para grandes volumes de dados e análises customizadas.' }
  }
  // GraphPad — dados clínicos, experimentos
  if (analise.includes('graphpad') || analise.includes('prism') || delineamento.includes('experimental') || delineamento.includes('ensaio clínico') || delineamento.includes('erc')) {
    return { valor: 'GraphPad Prism', motivo: 'GraphPad Prism é o padrão para estudos experimentais e ensaios clínicos — gera gráficos prontos para publicação.' }
  }
  // Jamovi — interface fácil, R por baixo
  if (analise.includes('jamovi')) {
    return { valor: 'Jamovi', motivo: 'Jamovi é gratuito, com interface visual simples e análises robustas — ótimo para quem está iniciando.' }
  }
  // Heurística por tipo de análise mencionada
  if (analise.includes('correlação') || analise.includes('correlacao') || analise.includes('regressão') || analise.includes('regressao') || analise.includes('anova') || analise.includes('qui-quadrado') || analise.includes('mann-whitney') || analise.includes('kruskal')) {
    return { valor: 'SPSS', motivo: 'Para o tipo de análise do seu projeto (testes de hipótese, correlação/regressão), o SPSS é o mais usado em saúde — interface intuitiva e amplamente aceito em periódicos.' }
  }
  // Análise qualitativa
  if (analise.includes('qualitativ') || analise.includes('categor') || analise.includes('temátic') || analise.includes('discurso')) {
    return { valor: 'Não aplica (pesquisa bibliográfica)', motivo: 'Análise qualitativa geralmente não usa software estatístico. Softwares como NVivo ou ATLAS.ti são opcionais.' }
  }
  // Padrão para estudos primários sem menção específica
  return { valor: 'SPSS', motivo: 'Para estudos quantitativos com seres humanos, o SPSS é o software mais usado em saúde no Brasil — interface amigável e aceito em todos os periódicos.' }
}

// Dicas contextuais por software selecionado
const DICAS_SOFTWARE: Record<string, string> = {
  'SPSS': 'Disponível na maioria das universidades brasileiras. Acesse o computador do laboratório de informática ou verifique se sua instituição tem licença. Exporte os resultados como tabelas para Word.',
  'R': 'Gratuito e de código aberto. Instale em r-project.org. Para iniciantes, use o RStudio (também gratuito) como interface. O pacote "tidyverse" cobre 90% das análises.',
  'Excel': 'Disponível na maioria dos computadores. Use o "Analysis ToolPak" (suplemento gratuito do Excel) para análises estatísticas básicas. Limitado para testes avançados.',
  'GraphPad Prism': 'Tem versão de avaliação gratuita de 30 dias. Ideal para curvas de sobrevida, análises de dose-resposta e gráficos de alta qualidade para artigos.',
  'Python (pandas/scipy)': 'Gratuito. Use o Google Colab (navegador, sem instalação) ou instale o Anaconda. Mais flexível mas exige familiaridade com programação.',
  'Stata': 'Software pago, geralmente disponível em pós-graduações. Excelente para dados de painel e análise de séries temporais.',
  'SAS': 'Software institucional. Consulte o setor de TI da sua instituição. Interface procedural com alta robustez estatística.',
  'Jamovi': 'Gratuito, instale em jamovi.org. Interface visual semelhante ao SPSS, roda R por baixo. Ótima opção para quem não quer programar.',
  'Não aplica (pesquisa bibliográfica)': 'Para pesquisas bibliográficas, use gerenciadores de referência como Mendeley (gratuito) ou Zotero para organizar os artigos.',
}

interface DadosPesquisaPanelProps {
  trabalhoId: string
  dadosProjetoAtual: DadosProjeto | null
}

type ArquivoStatus = 'lendo' | 'extraindo' | 'concluido' | 'erro'

interface ArquivoProcessado {
  id: string
  nome: string
  tipo: string
  status: ArquivoStatus
  erro?: string
}

type AbaNotas = 'contexto' | 'metodologia' | 'resultados' | 'interpretacao'

const ABA_CONFIG: Record<AbaNotas, { label: string; emoji: string; placeholder: string; dica: string }> = {
  contexto: {
    label: 'Contexto',
    emoji: '📌',
    placeholder:
      'Informações do seu contexto local que a IA não sabe:\n' +
      '• Por que você escolheu este tema (motivação pessoal ou profissional)\n' +
      '• Características específicas do local de pesquisa\n' +
      '• Problemas reais observados que justificam o estudo\n' +
      '• Dados locais/regionais relevantes que você conhece\n\n' +
      'A IA usará isso para tornar a Introdução e a Justificativa mais precisas e localizadas.',
    dica: 'Alimenta: Introdução e Justificativa',
  },
  metodologia: {
    label: 'Metodologia',
    emoji: '🔬',
    placeholder:
      'Como a coleta realmente aconteceu (pode diferir do planejado):\n' +
      '• Período exato de coleta (datas reais)\n' +
      '• Como os participantes foram abordados\n' +
      '• Dificuldades operacionais encontradas e como foram resolvidas\n' +
      '• Critérios de inclusão/exclusão aplicados na prática\n' +
      '• Qualquer desvio do protocolo original e o motivo\n\n' +
      'A IA usará isso para escrever a seção de Métodos com precisão.',
    dica: 'Alimenta: Métodos / Metodologia',
  },
  resultados: {
    label: 'Resultados',
    emoji: '📊',
    placeholder:
      'Seus dados, achados e resultados concretos:\n' +
      '• 65% relataram sobrecarga moderada ou intensa\n' +
      '• Média de horas extras: 12h/semana (DP=3,2)\n' +
      '• Correlação carga×qualidade: r=−0,42 (p<0,001)\n' +
      '• p<0,05 para todas as comparações\n\n' +
      'Cole tabelas do Excel ou faça upload abaixo.\n' +
      'REGRA: a IA usa EXATAMENTE estes números — nunca inventa.',
    dica: 'Alimenta: Resultados, Discussão e Conclusão',
  },
  interpretacao: {
    label: 'Interpretação',
    emoji: '💬',
    placeholder:
      'Suas impressões e análise dos resultados:\n' +
      '• O que você acha que explica os achados principais\n' +
      '• O que surpreendeu você nos resultados\n' +
      '• Como seus resultados se comparam com o que você já leu na literatura\n' +
      '• Limitações que você percebeu durante a pesquisa\n' +
      '• Recomendações práticas que você quer destacar\n\n' +
      'A IA usará isso para escrever a Discussão e Conclusão com a voz do pesquisador.',
    dica: 'Alimenta: Discussão e Conclusão',
  },
}

function DadosPesquisaPanel({ trabalhoId, dadosProjetoAtual }: DadosPesquisaPanelProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaNotas>('resultados')
  const [textos, setTextos] = useState<Record<AbaNotas, string>>({
    contexto:       dadosProjetoAtual?.notas_contexto ?? '',
    metodologia:    dadosProjetoAtual?.notas_metodologia ?? '',
    resultados:     dadosProjetoAtual?.dados_coletados ?? '',
    interpretacao:  dadosProjetoAtual?.notas_interpretacao ?? '',
  })
  const [nParticipantes, setNParticipantes] = useState(dadosProjetoAtual?.n_participantes ?? '')
  const [softwareAnalise, setSoftwareAnalise] = useState(dadosProjetoAtual?.software_analise ?? '')
  const [taxaResposta, setTaxaResposta] = useState(dadosProjetoAtual?.taxa_resposta ?? '')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [arquivos, setArquivos] = useState<ArquivoProcessado[]>([])
  const [arrastando, setArrastando] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Always-current ref — salvarDados reads this inside the debounce timeout
  // so it never captures stale textos from the render closure.
  const textosRef = useRef<Record<AbaNotas, string>>(textos)
  textosRef.current = textos

  function salvarDados(patch: Partial<{
    dados_coletados: string
    notas_contexto: string
    notas_metodologia: string
    notas_interpretacao: string
    n_participantes: string
    software_analise: string
    taxa_resposta: string
  }>) {
    setSalvo(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSalvando(true)
      try {
        await fetch(`/api/trabalhos/${trabalhoId}/projeto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dados_projeto: {
              ...(dadosProjetoAtual ?? {}),
              // Use ref so we always get the latest textos, not the stale closure value
              dados_coletados:     textosRef.current.resultados,
              notas_contexto:      textosRef.current.contexto,
              notas_metodologia:   textosRef.current.metodologia,
              notas_interpretacao: textosRef.current.interpretacao,
              n_participantes:     nParticipantes,
              software_analise:    softwareAnalise,
              taxa_resposta:       taxaResposta,
              ...patch,
            },
          }),
        })
        setSalvo(true)
      } finally {
        setSalvando(false)
      }
    }, 1500)
  }

  const abaParaCampo: Record<AbaNotas, keyof typeof textos> = {
    contexto:      'contexto',
    metodologia:   'metodologia',
    resultados:    'resultados',
    interpretacao: 'interpretacao',
  }

  const abaToCampoSalvar: Record<AbaNotas, 'notas_contexto' | 'notas_metodologia' | 'dados_coletados' | 'notas_interpretacao'> = {
    contexto:      'notas_contexto',
    metodologia:   'notas_metodologia',
    resultados:    'dados_coletados',
    interpretacao: 'notas_interpretacao',
  }

  function handleTextoChange(aba: AbaNotas, val: string) {
    setTextos(prev => ({ ...prev, [abaParaCampo[aba]]: val }))
    salvarDados({ [abaToCampoSalvar[aba]]: val })
  }

  function handleCampoSimples(campo: 'n_participantes' | 'software_analise' | 'taxa_resposta', val: string) {
    if (campo === 'n_participantes') setNParticipantes(val)
    if (campo === 'software_analise') setSoftwareAnalise(val)
    if (campo === 'taxa_resposta') setTaxaResposta(val)
    salvarDados({ [campo]: val })
  }

  function atualizarArquivo(id: string, patch: Partial<ArquivoProcessado>) {
    setArquivos(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  function removerArquivo(id: string) {
    setArquivos(prev => prev.filter(a => a.id !== id))
  }

  function appendTexto(conteudo: string, nomeArquivo: string) {
    const separador = `\n\n--- Extraído de: ${nomeArquivo} ---\n`
    const aba = abaAtiva
    const campo = abaParaCampo[aba]
    // Compute the new value OUTSIDE the updater to avoid side-effect-in-updater anti-pattern.
    // textos here is current because appendTexto is redefined on every render.
    const atual = textos[campo]
    const novo = atual ? atual + separador + conteudo : conteudo
    setTextos(prev => ({ ...prev, [campo]: novo }))
    salvarDados({ [abaToCampoSalvar[aba]]: novo })
  }

  async function processarArquivo(file: File) {
    const id = `${Date.now()}-${Math.random()}`
    const tipo = file.type || ''
    const nome = file.name
    const ext = nome.split('.').pop()?.toLowerCase() ?? ''

    const novo: ArquivoProcessado = { id, nome, tipo, status: 'lendo' }
    setArquivos(prev => [...prev, novo])

    try {
      // TXT / CSV — leitura direta no navegador
      if (tipo.includes('text') || ext === 'txt' || ext === 'csv' || ext === 'tsv') {
        const conteudo = await file.text()
        appendTexto(conteudo, nome)
        atualizarArquivo(id, { status: 'concluido' })
        return
      }

      // XLSX / XLS — SheetJS no navegador
      if (ext === 'xlsx' || ext === 'xls' || ext === 'ods' ||
          tipo.includes('spreadsheet') || tipo.includes('excel')) {
        atualizarArquivo(id, { status: 'lendo' })
        const xlsx = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = xlsx.read(buffer, { type: 'array' })
        const linhas: string[] = []
        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName]
          const csv = xlsx.utils.sheet_to_csv(ws)
          if (csv.trim()) {
            linhas.push(`[Planilha: ${sheetName}]`)
            linhas.push(csv.trim())
          }
        })
        const conteudo = linhas.join('\n\n')
        appendTexto(conteudo, nome)
        atualizarArquivo(id, { status: 'concluido' })
        return
      }

      // Imagens (PNG, JPG, WEBP, GIF) — extração via IA
      const MIME_IMAGEM = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
      if (MIME_IMAGEM.includes(tipo) || ['png','jpg','jpeg','webp','gif'].includes(ext)) {
        atualizarArquivo(id, { status: 'extraindo' })
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/ia/extrair-arquivo', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao extrair imagem')
        appendTexto(data.conteudo, nome)
        atualizarArquivo(id, { status: 'concluido' })
        return
      }

      // PDF — orientação ao usuário
      if (tipo === 'application/pdf' || ext === 'pdf') {
        atualizarArquivo(id, {
          status: 'erro',
          erro: 'PDFs com texto protegido não podem ser lidos automaticamente. Abra o PDF, selecione os dados e cole diretamente na caixa de texto acima.',
        })
        return
      }

      // Tipo não suportado
      atualizarArquivo(id, {
        status: 'erro',
        erro: `Formato não suportado. Use TXT, CSV, XLSX, XLS, PNG, JPG ou WEBP.`,
      })
    } catch (err) {
      atualizarArquivo(id, {
        status: 'erro',
        erro: err instanceof Error ? err.message : 'Erro ao processar arquivo.',
      })
    }
  }

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    files.forEach(f => processarArquivo(f))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setArrastando(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setArrastando(true) }
  function onDragLeave() { setArrastando(false) }

  function iconeArquivo(tipo: string, ext: string) {
    if (tipo.includes('image') || ['png','jpg','jpeg','webp','gif'].includes(ext))
      return <ImageIcon className="h-3.5 w-3.5 text-purple-500" />
    if (tipo.includes('spreadsheet') || tipo.includes('excel') || ['xlsx','xls','ods','csv'].includes(ext))
      return <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
    return <FileText className="h-3.5 w-3.5 text-blue-500" />
  }

  return (
    <div className="space-y-4">

      {/* Perguntas guiadas simples */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações básicas da coleta</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* N de participantes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Quantas pessoas participaram?
            </label>
            <input
              type="text"
              value={nParticipantes}
              onChange={e => handleCampoSimples('n_participantes', e.target.value)}
              placeholder="ex: 80, ou 45 casos e 45 controles"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          {/* Taxa de resposta */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Taxa de resposta (opcional)
            </label>
            <input
              type="text"
              value={taxaResposta}
              onChange={e => handleCampoSimples('taxa_resposta', e.target.value)}
              placeholder="ex: 82%, ou 74 de 90 convidados"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          {/* Software */}
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs font-medium text-foreground">
              Software de análise usado
            </label>
            <div className="flex gap-2 items-start flex-col">
              <select
                value={softwareAnalise}
                onChange={e => handleCampoSimples('software_analise', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              >
                <option value="">Selecione...</option>
                <option value="SPSS">SPSS</option>
                <option value="R">R</option>
                <option value="Excel">Excel</option>
                <option value="GraphPad Prism">GraphPad Prism</option>
                <option value="Python (pandas/scipy)">Python</option>
                <option value="Stata">Stata</option>
                <option value="SAS">SAS</option>
                <option value="Jamovi">Jamovi</option>
                <option value="Não aplica (pesquisa bibliográfica)">Não aplica</option>
              </select>
              {/* Sugestão automática baseada no plano */}
              {(() => {
                const sugestao = inferirSoftware(dadosProjetoAtual)
                if (!sugestao || softwareAnalise === sugestao.valor) return null
                return (
                  <button
                    type="button"
                    onClick={() => handleCampoSimples('software_analise', sugestao.valor)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors text-left"
                  >
                    <Info className="h-3 w-3 shrink-0" />
                    Recomendado para seu projeto: <span className="font-semibold">{sugestao.valor}</span> — clique para aplicar
                  </button>
                )
              })()}
            </div>
            {/* Dica contextual para o software selecionado */}
            {softwareAnalise && DICAS_SOFTWARE[softwareAnalise] && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                💡 {DICAS_SOFTWARE[softwareAnalise]}
              </p>
            )}
            {/* Motivo da sugestão quando aplicado */}
            {softwareAnalise && (() => {
              const sugestao = inferirSoftware(dadosProjetoAtual)
              if (!sugestao || softwareAnalise !== sugestao.valor) return null
              return (
                <p className="text-xs text-primary/80 mt-0.5 leading-relaxed">
                  ✓ {sugestao.motivo}
                </p>
              )
            })()}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA usa esses dados automaticamente na seção de Metodologia e Resultados — e o Guia de Análise é gerado especificamente para o software selecionado.
        </p>
      </div>

      {/* Abas de notas estruturadas */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b bg-muted/40">
          {(Object.keys(ABA_CONFIG) as AbaNotas[]).map(aba => {
            const cfg = ABA_CONFIG[aba]
            const temConteudo = textos[abaParaCampo[aba]].length > 0
            return (
              <button
                key={aba}
                type="button"
                onClick={() => setAbaAtiva(aba)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors relative',
                  abaAtiva === aba
                    ? 'bg-background text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <span>{cfg.emoji}</span>
                <span className="hidden sm:inline">{cfg.label}</span>
                {temConteudo && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary absolute top-1.5 right-1.5" />
                )}
              </button>
            )
          })}
        </div>

        {/* Conteúdo da aba ativa */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{ABA_CONFIG[abaAtiva].dica}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {salvando && <><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</>}
              {!salvando && salvo && <><CheckCircle2 className="h-3 w-3 text-green-600" /> Salvo</>}
            </div>
          </div>
          <textarea
            key={abaAtiva}
            rows={7}
            value={textos[abaParaCampo[abaAtiva]]}
            onChange={e => handleTextoChange(abaAtiva, e.target.value)}
            placeholder={ABA_CONFIG[abaAtiva].placeholder}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground font-mono leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Upload abaixo → conteúdo extraído é adicionado nesta aba ({ABA_CONFIG[abaAtiva].label})
          </p>
        </div>
      </div>

      {/* Zona de upload */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors',
          arrastando
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".txt,.csv,.tsv,.xlsx,.xls,.ods,.png,.jpg,.jpeg,.webp,.gif,.pdf"
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        <Upload className={cn('h-5 w-5', arrastando ? 'text-primary' : 'text-muted-foreground')} />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {arrastando ? 'Solte para processar' : 'Arraste arquivos ou clique para selecionar'}
          </p>
          <p className="text-xs text-muted-foreground">
            Tabelas Excel/CSV, imagens de gráficos e tabelas — a IA extrai os dados automaticamente
          </p>
        </div>
        {/* Tipo badges */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-1">
          {[
            { icon: <FileSpreadsheet className="h-3 w-3" />, label: 'Excel / CSV', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
            { icon: <ImageIcon className="h-3 w-3" />, label: 'Imagem (IA extrai)', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
            { icon: <FileText className="h-3 w-3" />, label: 'TXT / CSV', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
            { icon: <Table2 className="h-3 w-3" />, label: 'ODS', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
          ].map(b => (
            <span key={b.label} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', b.color)}>
              {b.icon}{b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Lista de arquivos em processamento / concluídos */}
      {arquivos.length > 0 && (
        <div className="space-y-1.5">
          {arquivos.map(arq => {
            const ext = arq.nome.split('.').pop()?.toLowerCase() ?? ''
            return (
              <div
                key={arq.id}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                  arq.status === 'concluido' && 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40',
                  arq.status === 'erro' && 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40',
                  (arq.status === 'lendo' || arq.status === 'extraindo') && 'border-border bg-muted/30',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {iconeArquivo(arq.tipo, ext)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{arq.nome}</p>
                  {arq.status === 'lendo' && (
                    <span className="flex items-center gap-1 text-muted-foreground mt-0.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> Lendo arquivo...
                    </span>
                  )}
                  {arq.status === 'extraindo' && (
                    <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300 mt-0.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> Extraindo dados com IA...
                    </span>
                  )}
                  {arq.status === 'concluido' && (
                    <span className="flex items-center gap-1 text-green-700 dark:text-green-400 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Dados extraídos e adicionados
                    </span>
                  )}
                  {arq.status === 'erro' && (
                    <span className="text-red-700 dark:text-red-400 mt-0.5 block">{arq.erro}</span>
                  )}
                </div>
                {(arq.status === 'concluido' || arq.status === 'erro') && (
                  <button
                    onClick={e => { e.stopPropagation(); removerArquivo(arq.id) }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dica de uso */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
        <span className="font-semibold">Como funciona:</span> Tudo o que você colocar aqui — colado ou via upload — será usado automaticamente pela IA ao gerar as seções de Resultados, Discussão e Conclusão. Imagens de tabelas e gráficos são lidas por visão computacional.
      </div>
    </div>
  )
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        {icon}
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-foreground leading-relaxed">{value}</p>
    </div>
  )
}

function EticaBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-orange-100 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-700 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:text-orange-200">
      {label}
    </span>
  )
}
