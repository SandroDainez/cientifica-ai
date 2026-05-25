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
    case 'preparacao': return 'bg-gray-100 border-gray-300 text-gray-700'
    case 'etica':      return 'bg-orange-50 border-orange-300 text-orange-800'
    case 'aguardar':   return 'bg-amber-50 border-amber-300 text-amber-800'
    case 'coleta':     return 'bg-blue-50 border-blue-300 text-blue-800'
    case 'analise':    return 'bg-purple-50 border-purple-300 text-purple-800'
    case 'escrita':    return 'bg-green-50 border-green-300 text-green-800'
    case 'submissao':  return 'bg-indigo-50 border-indigo-300 text-indigo-800'
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
    case 'alta':  return 'border-l-red-500 bg-red-50'
    case 'media': return 'border-l-amber-500 bg-amber-50'
    case 'baixa': return 'border-l-green-500 bg-green-50'
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
    case 'alta':  return 'bg-red-100 text-red-700'
    case 'media': return 'bg-amber-100 text-amber-700'
    case 'baixa': return 'bg-green-100 text-green-700'
  }
}

function etapaStatusBadge(status: EtapaStatus): string {
  switch (status) {
    case 'pendente':     return 'bg-gray-100 text-gray-600 border-gray-300'
    case 'em_andamento': return 'bg-blue-100 text-blue-700 border-blue-300'
    case 'concluido':    return 'bg-green-100 text-green-700 border-green-300'
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

// ─── Instruções estáticas por tipo de etapa ───────────────────────────────────
// Determinadas no frontend — não precisam ser geradas pela IA, evitando JSON enorme.

const INSTRUCOES_POR_TIPO: Record<EtapaRoadmap['tipo'], string[]> = {
  preparacao: [
    'Defina claramente a questão de pesquisa e os objetivos do estudo',
    'Revise a literatura existente para identificar lacunas e embasamento',
    'Consulte seu orientador sobre a viabilidade e escopo do projeto',
    'Liste os recursos necessários: tempo, acesso a dados, equipamentos',
    'Elabore um cronograma preliminar com marcos realistas',
  ],
  etica: [
    'Acesse a Plataforma Brasil em plataformabrasil.saude.gov.br',
    'Crie ou acesse sua conta e cadastre o projeto de pesquisa',
    'Anexe o protocolo de pesquisa, TCLE e carta de anuência da instituição',
    'Aguarde o número CAAE gerado após a submissão',
    'Acompanhe o status do parecer — prazo legal é 30 dias',
  ],
  aguardar: [
    'Acompanhe o status na Plataforma Brasil regularmente',
    'Em caso de pendência, responda dentro do prazo indicado pelo CEP',
    'Aproveite o período para finalizar os instrumentos de coleta',
    'Se o parecer for aprovado, avance para a próxima etapa',
  ],
  coleta: [
    'Treine a equipe de coleta conforme o protocolo aprovado pelo CEP',
    'Aplique o instrumento de coleta seguindo rigorosamente o protocolo',
    'Registre os dados de forma sistemática — planilha ou software específico',
    'Mantenha os TCLEs assinados arquivados em local seguro',
    'Monitore o andamento e corrija desvios do protocolo imediatamente',
  ],
  analise: [
    'Organize e limpe o banco de dados antes de iniciar a análise',
    'Verifique a distribuição dos dados e os pressupostos dos testes',
    'Aplique os testes estatísticos conforme planejado na metodologia',
    'Documente todas as decisões analíticas e os softwares usados',
    'Interprete os resultados à luz dos objetivos e da literatura',
  ],
  escrita: [
    'Use o editor do Científica AI para gerar cada seção com auxílio de IA',
    'Revise e adapte o conteúdo gerado inserindo seus dados reais coletados',
    'Siga as normas ABNT/Vancouver/APA conforme o formato do trabalho',
    'Valide cada seção antes de avançar para a próxima',
    'Peça feedback do orientador ao final de cada capítulo principal',
  ],
  submissao: [
    'Selecione o periódico ou banca adequada ao escopo do trabalho',
    'Leia atentamente as normas de submissão do periódico/instituição',
    'Prepare todos os documentos exigidos: carta, declarações, formulários',
    'Submeta o manuscrito e anote o número de protocolo/protocolo de defesa',
    'Aguarde e responda às revisões ou perguntas da banca/revisores',
  ],
}

// ─── Documentos disponíveis por tipo de etapa ─────────────────────────────────

function getDocumentosEtapa(
  tipo: EtapaRoadmap['tipo'],
  dadosProjeto?: DadosProjeto | null
): DocumentoEtapa[] {
  switch (tipo) {
    case 'etica': {
      const docs: DocumentoEtapa[] = []
      if (!dadosProjeto || dadosProjeto.precisa_cep)
        docs.push({ tipo: 'protocolo_cep', label: 'Protocolo CEP', descricao: 'Documento formal para submissão ao CEP' })
      if (!dadosProjeto || dadosProjeto.precisa_tcle)
        docs.push({ tipo: 'tcle', label: 'TCLE', descricao: 'Termo de Consentimento Livre e Esclarecido' })
      if (!dadosProjeto || dadosProjeto.precisa_carta_anuencia)
        docs.push({ tipo: 'carta_anuencia', label: 'Carta de Anuência', descricao: 'Autorização da instituição parceira' })
      return docs
    }
    case 'coleta':
      return [
        { tipo: 'instrumento_coleta', label: 'Instrumento de Coleta', descricao: 'Questionário ou formulário de dados' },
        { tipo: 'guia_coleta', label: 'Guia de Coleta', descricao: 'Manual operacional para a equipe' },
      ]
    case 'analise':
      return [{ tipo: 'guia_analise', label: 'Guia de Análise', descricao: 'Roteiro estatístico com código e interpretação' }]
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

// ─── O que fazer com cada documento após gerar ───────────────────────────────

const USO_DOCUMENTO: Record<string, { acao: string; detalhe: string }> = {
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
    acao: 'Imprima uma cópia por participante — use número sequencial, nunca o nome',
    detalhe: 'Preencha em campo. Ao final do dia, revise cada questionário e digitalize em planilha.',
  },
  guia_coleta: {
    acao: 'Leve para campo e use como checklist a cada dia de coleta',
    detalhe: 'Distribua para todos os pesquisadores/auxiliares que vão aplicar o instrumento.',
  },
  guia_analise: {
    acao: 'Siga o passo a passo no software indicado — ou envie este guia a um estatístico',
    detalhe: 'Se não tiver familiaridade com estatística, encaminhe este guia a um estatístico com seus dados. Muitas universidades oferecem serviço gratuito de assessoria estatística.',
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

export function ProjetoCriadorClient({ trabalho, dadosProjetoInicial }: ProjetoCriadorClientProps) {
  const router = useRouter()

  const [step, setStep] = useState<Step>(dadosProjetoInicial ? 'plano' : 'input')
  const [descricao, setDescricao] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [planData, setPlanData] = useState<DadosProjeto | null>(dadosProjetoInicial)
  const [salvando, setSalvando] = useState(false)

  // Roadmap interaction state
  const [expandedEtapas, setExpandedEtapas] = useState<Set<string>>(new Set())
  const [docsMap, setDocsMap] = useState<DocsMap>({})
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
          const err = await res.json().catch(() => ({ error: `Erro ${res.status}` }))
          throw new Error((err as { error?: string }).error ?? `Erro ${res.status}`)
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

        setDocsMap(prev => ({
          ...prev,
          [key]: { status: 'gerado', conteudo: accumulated },
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao gerar documento.'
        setDocsMap(prev => ({
          ...prev,
          [key]: { status: 'erro', conteudo: '', erro: msg },
        }))
        toast.error(msg)
      }
    },
    [trabalho.id, planData]
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

  // ── Geração do plano ──────────────────────────────────────────────────────

  async function handleGerarPlano() {
    if (descricao.trim().length < 30) return
    setStep('gerando')
    setStreamingText('')
    streamRef.current = ''

    try {
      const res = await fetch('/api/ia/planejar-projeto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: descricao.trim(), trabalhoId: trabalho.id }),
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
      const afterDelim = fullText.split('===PLANO_JSON===')[1]
      if (!afterDelim) throw new Error('Plano não foi gerado corretamente. Tente novamente.')

      // Extrai o JSON usando bracket-matching (ignora texto antes/depois do objeto)
      const jsonStr = extractJsonObject(afterDelim)
      if (!jsonStr) throw new Error('O plano ficou incompleto. Tente novamente — pode ser necessário simplificar a descrição.')

      const parsed = JSON.parse(jsonStr) as Omit<DadosProjeto, 'descricao_original' | 'criado_em' | 'confirmado'>
      const dadosProjeto: DadosProjeto = {
        ...parsed,
        descricao_original: descricao.trim(),
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
              Descreva sua ideia e a IA cria o plano completo — incluindo CEP, coleta e cronograma
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground" htmlFor="descricao">
              Descreva sua ideia de pesquisa
            </label>
            <textarea
              id="descricao"
              rows={7}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Quero estudar o impacto da carga de trabalho dos enfermeiros na qualidade do cuidado em UTIs adultas do hospital onde trabalho. Pretendo aplicar um questionário validado (NAS) para 40 enfermeiros e correlacionar com indicadores de segurança do paciente..."
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {descricao.length} caracteres{descricao.length < 30 ? ` — mínimo de 30` : ''}
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <span className="font-medium">Dica: </span>
            Quanto mais detalhes você der (onde, com quem, como), mais preciso será o plano. Inclua
            informações sobre o local da pesquisa, o público-alvo e os instrumentos que pretende usar.
          </div>

          <button
            onClick={handleGerarPlano}
            disabled={descricao.trim().length < 30}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'w-full gap-2',
              descricao.trim().length < 30 && 'opacity-50 cursor-not-allowed'
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

          {/* Progress bar */}
          {totalChecklist > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  Checklist de Preparação
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
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-orange-800">
                    Aprovação ética obrigatória (CEP/Plataforma Brasil)
                  </p>
                  <p className="text-sm text-orange-700">
                    Sua pesquisa envolve seres humanos. Pela Resolução CNS 466/2012, é obrigatória a
                    aprovação do Comitê de Ética em Pesquisa (CEP) antes do início da coleta de dados.
                    A submissão é feita pela Plataforma Brasil.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {planData.precisa_cep && <EticaBadge label="Aprovação CEP" />}
                    {planData.precisa_carta_anuencia && <EticaBadge label="Carta de Anuência" />}
                    {planData.precisa_tcle && <EticaBadge label="TCLE" />}
                  </div>
                  <a
                    href="https://plataformabrasil.saude.gov.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-orange-700 underline underline-offset-2 hover:text-orange-900 mt-1"
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
                    // Pré-computar qual é a primeira etapa de cada tipo
                    // (documentos só aparecem na primeira ocorrência de cada tipo)
                    const tiposVistos = new Set<string>()
                    const primeiraEtapaPorTipo = new Set<string>()
                    for (const e of planData.roadmap) {
                      if (!tiposVistos.has(e.tipo)) {
                        tiposVistos.add(e.tipo)
                        primeiraEtapaPorTipo.add(e.id)
                      }
                    }
                    return planData.roadmap.map((etapa) => {
                    const isFirstOfType = primeiraEtapaPorTipo.has(etapa.id)
                    const isExpanded = expandedEtapas.has(etapa.id)
                    const etapaStatus = etapaStatuses[etapa.id] ?? 'pendente'
                    const instrucoes = INSTRUCOES_POR_TIPO[etapa.tipo] ?? []
                    // Documentos e link externo só na primeira etapa de cada tipo
                    const documentosEtapa = isFirstOfType ? getDocumentosEtapa(etapa.tipo, planData) : []
                    const linkExterno = isFirstOfType && etapa.tipo === 'etica' ? 'https://plataformabrasil.saude.gov.br' : null
                    const hasDetails = instrucoes.length > 0 || documentosEtapa.length > 0 || !!linkExterno

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

                              {etapa.app_executa ? (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                  <Cpu className="h-3 w-3" /> App faz com IA
                                </span>
                              ) : (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
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

                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              {docState?.status === 'gerado' && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleCopy(key, docState.conteudo)}
                                                  className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
                                                >
                                                  {copiedKey === key
                                                    ? <><Check className="h-3 w-3" /> Copiado</>
                                                    : <><Copy className="h-3 w-3" /> Copiar</>}
                                                </button>
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

                                          {/* Streaming / resultado */}
                                          {docState && (docState.status === 'gerando' || docState.status === 'gerado') && docState.conteudo && (
                                            <div className="mt-2 rounded border border-border bg-muted/40 p-3 max-h-72 overflow-y-auto">
                                              <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground font-sans">
                                                {docState.conteudo}
                                              </pre>
                                            </div>
                                          )}

                                          {/* O que fazer com este documento */}
                                          {docState?.status === 'gerado' && USO_DOCUMENTO[doc.tipo] && (
                                            <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 p-3">
                                              <div className="flex items-start gap-2">
                                                <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                  <p className="text-xs font-semibold text-blue-800 mb-0.5">
                                                    {USO_DOCUMENTO[doc.tipo].acao}
                                                  </p>
                                                  <p className="text-xs text-blue-700">
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

          {/* Checklist interativo */}
          {planData.checklist && planData.checklist.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-foreground mb-3">Checklist de Preparação</h3>
              <div className="space-y-2">
                {planData.checklist.map((item) => {
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
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4 rounded border-2 border-current opacity-40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              'text-sm font-medium text-foreground',
                              done && 'line-through'
                            )}>
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

          {/* Análise gerada (texto da PARTE 1) */}
          {streamingText && (
            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">Análise do Orientador Virtual</h3>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {streamingText.split('===PLANO_JSON===')[0].trim()}
                </p>
              </div>
            </div>
          )}

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
    <span className="rounded-full bg-orange-100 border border-orange-300 px-2.5 py-0.5 text-xs font-medium text-orange-800">
      {label}
    </span>
  )
}
