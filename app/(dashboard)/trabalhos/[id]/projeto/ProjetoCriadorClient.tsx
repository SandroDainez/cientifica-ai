'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Trabalho, DadosProjeto, EtapaRoadmap, ItemChecklist, TipoDocumento } from '@/types'

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
        const res = await fetch('/api/ia/gerar-documento-projeto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trabalhoId: trabalho.id, tipoDocumento }),
        })

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
    [trabalho.id]
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
      const jsonMatch = fullText.match(/===PLANO_JSON===\s*([\s\S]+)/)
      if (!jsonMatch) throw new Error('Resposta sem plano estruturado. Tente novamente.')

      const parsed = JSON.parse(jsonMatch[1].trim()) as Omit<DadosProjeto, 'descricao_original' | 'criado_em' | 'confirmado'>
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
                  {planData.roadmap.map((etapa) => {
                    const isExpanded = expandedEtapas.has(etapa.id)
                    const etapaStatus = etapaStatuses[etapa.id] ?? 'pendente'
                    const hasDetails =
                      (etapa.instrucoes_detalhadas && etapa.instrucoes_detalhadas.length > 0) ||
                      (etapa.documentos && etapa.documentos.length > 0) ||
                      !!etapa.link_externo

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
                              <span className="font-medium text-sm">{etapa.titulo}</span>

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

                            <p className="text-xs leading-relaxed mb-2">{etapa.descricao}</p>

                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" /> {etapa.duracao_estimada}
                            </span>
                          </button>

                          {/* Conteúdo expandido */}
                          {isExpanded && hasDetails && (
                            <div className="border-t border-current/10 px-4 pb-4 pt-3 space-y-4">

                              {/* Instruções detalhadas */}
                              {etapa.instrucoes_detalhadas && etapa.instrucoes_detalhadas.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">
                                    Como fazer
                                  </p>
                                  <ol className="space-y-1.5">
                                    {etapa.instrucoes_detalhadas.map((instrucao, idx) => (
                                      <li key={idx} className="flex gap-2 text-xs leading-relaxed">
                                        <span className="flex-shrink-0 font-bold opacity-50">{idx + 1}.</span>
                                        <span>{instrucao}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {/* Link externo */}
                              {etapa.link_externo && (
                                <a
                                  href={etapa.link_externo}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Acessar link relacionado
                                </a>
                              )}

                              {/* Documentos IA */}
                              {etapa.documentos && etapa.documentos.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">
                                    Documentos
                                  </p>
                                  <div className="space-y-3">
                                    {etapa.documentos.map(doc => {
                                      const key = `${etapa.id}_${doc.tipo}`
                                      const docState = docsMap[key]

                                      return (
                                        <div key={doc.tipo} className="rounded-md bg-background/60 border border-current/10 p-3">
                                          <div className="flex items-start justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-1.5">
                                              <FileText className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
                                              <span className="text-xs font-medium">{doc.label}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              {docState?.status === 'gerado' && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleCopy(key, docState.conteudo)}
                                                  className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-background border border-current/20 opacity-70 hover:opacity-100 transition-opacity"
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
                                                  'inline-flex items-center gap-1 text-[10px] rounded px-2 py-0.5 font-medium transition-opacity',
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

                                          <p className="text-[11px] opacity-60 mb-2">{doc.descricao}</p>

                                          {/* Streaming / resultado */}
                                          {docState && (docState.status === 'gerando' || docState.status === 'gerado') && docState.conteudo && (
                                            <div className="mt-2 rounded border border-current/10 bg-background/80 p-3 max-h-72 overflow-y-auto">
                                              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-foreground font-sans">
                                                {docState.conteudo}
                                              </pre>
                                            </div>
                                          )}

                                          {docState?.status === 'erro' && (
                                            <p className="mt-1 text-[11px] text-red-600">
                                              {docState.erro ?? 'Erro ao gerar. Tente novamente.'}
                                            </p>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
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
