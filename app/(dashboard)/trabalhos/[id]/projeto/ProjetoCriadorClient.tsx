'use client'

import { useState, useRef } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Trabalho, DadosProjeto, EtapaRoadmap, ItemChecklist } from '@/types'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Step = 'input' | 'gerando' | 'plano'

interface ProjetoCriadorClientProps {
  trabalho: Trabalho
  dadosProjetoInicial: DadosProjeto | null
}

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
  const streamRef = useRef<string>('')

  // ── Geração ────────────────────────────────────────────────────────────────

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
        throw new Error(err.error ?? `Erro ${res.status}`)
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

      // Extrai o JSON da resposta
      const fullText = streamRef.current
      const jsonMatch = fullText.match(/===PLANO_JSON===\s*([\s\S]+)/)
      if (!jsonMatch) throw new Error('Resposta sem plano estruturado. Tente novamente.')

      const parsed = JSON.parse(jsonMatch[1].trim())
      const dadosProjeto: DadosProjeto = {
        ...parsed,
        descricao_original: descricao.trim(),
        criado_em: new Date().toISOString(),
        confirmado: false,
      }

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
      const dadosProjetoFinal: DadosProjeto = { ...planData, confirmado: true }

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

          {/* Dica */}
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

          {/* Roadmap */}
          {planData.roadmap && planData.roadmap.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-foreground mb-4">Roadmap do Projeto</h3>
              <div className="relative">
                {/* Linha vertical */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <ol className="space-y-4 pl-10">
                  {planData.roadmap.map((etapa) => (
                    <li key={etapa.id} className="relative">
                      {/* Marcador */}
                      <span className="absolute -left-6 flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border text-sm">
                        {etapaIcone(etapa.tipo)}
                      </span>

                      <div className={cn('rounded-lg border p-4', etapaCor(etapa.tipo))}>
                        <div className="flex flex-wrap items-start gap-2 mb-1">
                          <span className="font-medium text-sm">{etapa.titulo}</span>

                          {etapa.bloqueante && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wide">
                              Bloqueio
                            </span>
                          )}

                          {etapa.app_executa ? (
                            <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                              <Cpu className="h-3 w-3" /> App faz com IA
                            </span>
                          ) : (
                            <span className="ml-auto flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                              <User className="h-3 w-3" /> Você faz
                            </span>
                          )}
                        </div>

                        <p className="text-xs leading-relaxed mb-2">{etapa.descricao}</p>

                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {etapa.duracao_estimada}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Checklist */}
          {planData.checklist && planData.checklist.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-foreground mb-3">Checklist de Preparação</h3>
              <div className="space-y-2">
                {planData.checklist.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-lg border border-l-4 p-3',
                      urgenciaCor(item.urgencia)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 rounded border-2 border-current opacity-40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{item.item}</span>
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
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                          >
                            Saiba mais <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
