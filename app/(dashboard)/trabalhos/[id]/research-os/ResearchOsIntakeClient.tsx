'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Brain, CheckCircle2, AlertTriangle, Loader2, Save, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import type { Trabalho } from '@/types'
import type { AcademicPurpose, HumanDataSource, ResearchProjectState } from '@/lib/research-os/types'
import type { StudyDesignFacts } from '@/lib/research-os/study-design-classifier'

interface Props {
  trabalho: Trabalho
  initialState: ResearchProjectState | null
}

type ConfirmedFacts = StudyDesignFacts & {
  involvesHumans?: boolean
  involvesAnimals?: boolean
  humanDataSource?: HumanDataSource
  vulnerablePopulation?: boolean
  multicenter?: boolean
}

interface IntakeQuestion {
  id: string
  question: string
  reason: string
  required: boolean
}

interface IntakeResponse {
  state: ResearchProjectState
  questions: IntakeQuestion[]
  classification: {
    design: ResearchProjectState['studyDesign']
    confidence: 'alta' | 'moderada' | 'baixa'
    rationale: string[]
    unresolved: string[]
  }
  ethics: {
    routes: string[]
    blockers: string[]
    notes: string[]
  }
  warnings: string[]
  extractedFacts: ConfirmedFacts
  confirmedFacts: ConfirmedFacts
}

const PURPOSES: Array<{ value: AcademicPurpose; label: string }> = [
  { value: 'disciplina', label: 'Trabalho de disciplina' },
  { value: 'iniciacao_cientifica', label: 'Iniciação científica' },
  { value: 'tcc', label: 'TCC' },
  { value: 'especializacao', label: 'Especialização / residência' },
  { value: 'mestrado', label: 'Mestrado' },
  { value: 'doutorado', label: 'Doutorado' },
  { value: 'artigo_independente', label: 'Artigo independente' },
  { value: 'outro', label: 'Outro' },
]

const HUMAN_SOURCES: Array<{ value: HumanDataSource; label: string }> = [
  { value: 'intervencao_prospectiva', label: 'Intervenção prospectiva' },
  { value: 'observacional_prospectiva', label: 'Seguimento observacional prospectivo' },
  { value: 'prontuario_retrospectivo', label: 'Prontuários retrospectivos' },
  { value: 'questionario_entrevista', label: 'Questionário / entrevista' },
  { value: 'material_biologico', label: 'Material biológico' },
  { value: 'imagem_audio_video', label: 'Imagem / áudio / vídeo' },
  { value: 'base_publica_anonimizada', label: 'Base pública anonimizada' },
  { value: 'base_privada_anonimizada', label: 'Base privada anonimizada' },
  { value: 'dados_identificaveis', label: 'Dados identificáveis' },
]

function boolSelect(value: boolean | undefined): string {
  return value === undefined ? '' : value ? 'sim' : 'nao'
}

function designLabel(design: ResearchProjectState['studyDesign']): string {
  return design.replaceAll('_', ' ')
}

export function ResearchOsIntakeClient({ trabalho, initialState }: Props) {
  const initialDescription = initialState?.question.freeText ?? trabalho.titulo ?? ''
  const [description, setDescription] = useState(initialDescription)
  const [purpose, setPurpose] = useState<AcademicPurpose>(initialState?.academicPurpose ?? 'outro')
  const [facts, setFacts] = useState<ConfirmedFacts>({})
  const [result, setResult] = useState<IntakeResponse | null>(initialState ? {
    state: initialState,
    questions: [],
    classification: { design: initialState.studyDesign, confidence: initialState.studyDesign === 'indefinido' ? 'baixa' : 'moderada', rationale: [], unresolved: initialState.unresolvedIssues },
    ethics: { routes: initialState.ethicsRoutes, blockers: [], notes: [] },
    warnings: [],
    extractedFacts: {},
    confirmedFacts: {},
  } : null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const canAnalyze = description.trim().length >= 10 && !loading
  const needsHumanSource = facts.involvesHumans === true

  const readiness = useMemo(() => {
    if (!result) return 0
    const values = Object.values(result.state.readiness)
    const points = values.reduce((acc, item) => acc + (item === 'pronto' || item === 'nao_aplicavel' ? 1 : item === 'parcial' ? 0.5 : 0), 0)
    return Math.round((points / values.length) * 100)
  }, [result])

  async function analyze() {
    if (!canAnalyze) return
    setLoading(true)
    try {
      const response = await fetch('/api/ia/intake-cientifico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          area: trabalho.area_conhecimento ?? undefined,
          academicPurpose: purpose,
          confirmedFacts: facts,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Falha ao analisar a ideia')
      setResult(data as IntakeResponse)
      toast.success('Análise científica atualizada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao analisar a ideia')
    } finally {
      setLoading(false)
    }
  }

  async function persist() {
    if (!result) return
    setSaving(true)
    try {
      const response = await fetch(`/api/trabalhos/${trabalho.id}/research-os`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          researchProjectState: result.state,
          intakeMetadata: {
            extractedFacts: result.extractedFacts,
            confirmedFacts: facts,
            questions: result.questions,
            savedAt: new Date().toISOString(),
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Falha ao salvar')
      toast.success('Estado científico salvo no projeto')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/trabalhos/${trabalho.id}/projeto`} className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao projeto atual
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Brain className="h-6 w-6" /> Research OS — Intake científico</h1>
          <p className="mt-1 text-sm text-muted-foreground">Conte a ideia como você pensou. O sistema primeiro identifica os fatos; só depois classifica desenho, ética e guideline.</p>
        </div>
        {result && (
          <button onClick={persist} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar estado científico
          </button>
        )}
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <label className="space-y-2">
            <span className="text-sm font-medium">Qual é a sua ideia de pesquisa?</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={6}
              placeholder="Ex.: Tenho prontuários de cerca de 800 pacientes de UTI e quero estudar fatores associados ao desenvolvimento de lesão renal aguda..."
              className="w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Finalidade acadêmica</span>
            <select value={purpose} onChange={e => setPurpose(e.target.value as AcademicPurpose)} className="w-full rounded-md border bg-background p-2.5 text-sm">
              {PURPOSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">A finalidade não define o desenho. Uma tese pode ser coorte, RCT, revisão sistemática, qualitativa etc.</p>
          </label>
        </div>

        <div className="mt-5 border-t pt-5">
          <h2 className="text-sm font-semibold">Fatos que você já sabe</h2>
          <p className="mt-1 text-xs text-muted-foreground">Preencha apenas o que tem certeza. Em branco = o sistema não deve assumir.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs">Pesquisador atribui intervenção?
              <select value={boolSelect(facts.investigatorAssignsIntervention)} onChange={e => setFacts(f => ({ ...f, investigatorAssignsIntervention: e.target.value === '' ? undefined : e.target.value === 'sim' }))} className="mt-1 w-full rounded-md border bg-background p-2 text-sm">
                <option value="">Não sei / não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </label>
            <label className="text-xs">Dados já existem integralmente?
              <select value={boolSelect(facts.historicalDataOnly)} onChange={e => setFacts(f => ({ ...f, historicalDataOnly: e.target.value === '' ? undefined : e.target.value === 'sim' }))} className="mt-1 w-full rounded-md border bg-background p-2 text-sm">
                <option value="">Não sei / não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </label>
            <label className="text-xs">Há seres humanos?
              <select value={boolSelect(facts.involvesHumans)} onChange={e => setFacts(f => ({ ...f, involvesHumans: e.target.value === '' ? undefined : e.target.value === 'sim', humanDataSource: e.target.value === 'sim' ? f.humanDataSource : undefined }))} className="mt-1 w-full rounded-md border bg-background p-2 text-sm">
                <option value="">Não sei / não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </label>
            <label className="text-xs">Há animais experimentais?
              <select value={boolSelect(facts.involvesAnimals)} onChange={e => setFacts(f => ({ ...f, involvesAnimals: e.target.value === '' ? undefined : e.target.value === 'sim', animalExperiment: e.target.value === 'sim' ? true : f.animalExperiment }))} className="mt-1 w-full rounded-md border bg-background p-2 text-sm">
                <option value="">Não sei / não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </label>
          </div>
          {needsHumanSource && (
            <label className="mt-3 block max-w-md text-xs">Origem dos dados humanos
              <select value={facts.humanDataSource ?? ''} onChange={e => setFacts(f => ({ ...f, humanDataSource: (e.target.value || undefined) as HumanDataSource | undefined }))} className="mt-1 w-full rounded-md border bg-background p-2 text-sm">
                <option value="">Selecione apenas se souber</option>
                {HUMAN_SOURCES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          )}
        </div>

        <button onClick={analyze} disabled={!canAnalyze} className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {loading ? 'Analisando fatos e desenho...' : 'Analisar cientificamente'}
        </button>
      </section>

      {result && (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Desenho classificado</p>
                <h2 className="mt-1 text-xl font-semibold capitalize">{designLabel(result.classification.design)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Confiança: {result.classification.confidence}</p>
              </div>
              <div className="rounded-full border px-3 py-1 text-sm">Prontidão {readiness}%</div>
            </div>

            {result.classification.rationale.length > 0 && (
              <div><h3 className="text-sm font-semibold">Por quê?</h3><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{result.classification.rationale.map((item, i) => <li key={i}>• {item}</li>)}</ul></div>
            )}

            <div>
              <h3 className="text-sm font-semibold">Guidelines aplicáveis</h3>
              <div className="mt-2 flex flex-wrap gap-2">{result.state.reportingGuidelines.map(item => <span key={item} className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">{item}</span>)}</div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Rotas éticas / regulatórias</h3>
              <div className="mt-2 flex flex-wrap gap-2">{result.state.ethicsRoutes.map(item => <span key={item} className="rounded-full border bg-muted px-2.5 py-1 text-xs">{item.replaceAll('_', ' ')}</span>)}</div>
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Não avance ainda</div>
                <ul className="mt-2 space-y-1">{result.warnings.map((warning, i) => <li key={i}>• {warning}</li>)}</ul>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold"><CheckCircle2 className="h-5 w-5" /> Próximas perguntas</h2>
            {result.questions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Não há perguntas essenciais pendentes neste estágio. O próximo passo será construir protocolo, estatística e mapa de evidências.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {result.questions.map(q => (
                  <div key={q.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{q.question}</p>
                      {q.required && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">ESSENCIAL</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{q.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
