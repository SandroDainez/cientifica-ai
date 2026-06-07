'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { TipoTrabalhoCard } from '@/components/trabalho/TipoTrabalhoCard'
import { FLUXOS } from '@/lib/tipos/fluxos-trabalho'
import { analisarCoerenciaTituloTipo } from '@/lib/trabalho/coerencia'
import { AlertTriangle } from 'lucide-react'
import type { TipoTrabalho, FormatoCitacao, NivelExperiencia } from '@/types'

const TIPOS_LISTA = Object.keys(FLUXOS) as TipoTrabalho[]

const AREAS = [
  'Ciências da Saúde',
  'Ciências Biológicas',
  'Ciências Exatas e da Terra',
  'Ciências Humanas',
  'Ciências Sociais Aplicadas',
  'Ciências Agrárias',
  'Engenharias',
  'Linguística, Letras e Artes',
  'Multidisciplinar',
]

const STEPS = ['Tipo de trabalho', 'Detalhes', 'Confirmar']

interface FormData {
  tipo_trabalho: TipoTrabalho | null
  titulo: string
  area_conhecimento: string
  formato_citacao: FormatoCitacao
  instituicao_destino: string
  tem_orientador: boolean
  orientador: string
  nivel_experiencia: NivelExperiencia
}

export default function NovoTrabalhoPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // ── Sugestão da IA ───────────────────────────────────────────────────────
  const [descricaoLivre, setDescricaoLivre] = useState('')
  const [sugerindo, setSugerindo] = useState(false)
  const [sugestao, setSugestao] = useState<{
    tipo: TipoTrabalho
    explicacao: string
    alternativa?: TipoTrabalho | null
    explicacao_alternativa?: string | null
  } | null>(null)
  const [erroSugestao, setErroSugestao] = useState('')

  async function handleSugerir() {
    if (descricaoLivre.trim().length < 10) return
    setSugerindo(true)
    setErroSugestao('')
    setSugestao(null)
    try {
      const res = await fetch('/api/ia/sugerir-tipo-trabalho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: descricaoLivre }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao sugerir')
      setSugestao(json)
      // Pré-seleciona o tipo sugerido
      set('tipo_trabalho', json.tipo as TipoTrabalho)
    } catch (e) {
      setErroSugestao(e instanceof Error ? e.message : 'Erro ao sugerir. Tente novamente.')
    } finally {
      setSugerindo(false)
    }
  }

  const [form, setForm] = useState<FormData>({
    tipo_trabalho: null,
    titulo: '',
    area_conhecimento: '',
    formato_citacao: 'abnt',
    instituicao_destino: '',
    tem_orientador: false,
    orientador: '',
    nivel_experiencia: 'intermediario',
  })

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleCriar() {
    if (!form.tipo_trabalho) return
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/trabalhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_trabalho: form.tipo_trabalho,
          titulo: form.titulo || undefined,
          area_conhecimento: form.area_conhecimento || undefined,
          formato_citacao: form.formato_citacao,
          instituicao_destino: form.instituicao_destino || undefined,
          tem_orientador: form.tem_orientador,
          orientador: form.orientador || undefined,
          nivel_experiencia: form.nivel_experiencia,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      router.push(`/trabalhos/${json.id}/projeto`)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar trabalho')
      setLoading(false)
    }
  }

  const fluxoSelecionado = form.tipo_trabalho ? FLUXOS[form.tipo_trabalho] : null

  // Guarda de coerência: o título combina com o tipo escolhido?
  const coerencia = form.tipo_trabalho && form.titulo.trim()
    ? analisarCoerenciaTituloTipo(form.titulo, form.tipo_trabalho)
    : { ok: true as const }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
          className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 mb-4')}
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 0 ? 'Voltar' : STEPS[step - 1]}
        </button>
        <h1 className="text-2xl font-bold text-foreground">Novo trabalho</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Passo {step + 1} de {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={cn(
              'h-1.5 rounded-full transition-all',
              i < step ? 'bg-green-500' : i === step ? 'bg-primary' : 'bg-gray-200'
            )} />
          </div>
        ))}
      </div>

      {/* Step 1 — Tipo */}
      {step === 0 && (
        <div className="space-y-5">

          {/* Campo livre com sugestão da IA */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                O que você quer criar ou pesquisar?
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Descreva sua ideia e a IA indica o tipo de trabalho mais adequado. Ou escolha direto na grade abaixo.
              </p>
            </div>

            <textarea
              rows={3}
              value={descricaoLivre}
              onChange={e => { setDescricaoLivre(e.target.value); setSugestao(null) }}
              placeholder="Ex: Quero publicar um artigo sobre o impacto da carga de trabalho dos enfermeiros na UTI. / Preciso fazer meu TCC sobre saúde mental de adolescentes. / Quero revisar todos os estudos sobre vitamina D e diabetes."
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSugerir}
                disabled={sugerindo || descricaoLivre.trim().length < 10}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  'bg-primary text-primary-foreground hover:opacity-90',
                  (sugerindo || descricaoLivre.trim().length < 10) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {sugerindo
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
                  : <><Sparkles className="h-4 w-4" /> A IA indica o tipo ideal</>}
              </button>
              {erroSugestao && (
                <p className="text-xs text-destructive">{erroSugestao}</p>
              )}
            </div>

            {/* Card de sugestão */}
            {sugestao && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-primary">
                      Sugestão da IA: {FLUXOS[sugestao.tipo]?.nome_completo ?? sugestao.tipo}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSugestao(null); set('tipo_trabalho', null) }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{sugestao.explicacao}</p>
                {sugestao.alternativa && sugestao.explicacao_alternativa && (
                  <div className="pt-1 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Alternativa:</span>{' '}
                      <button
                        type="button"
                        onClick={() => set('tipo_trabalho', sugestao.alternativa as TipoTrabalho)}
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        {FLUXOS[sugestao.alternativa]?.nome_completo ?? sugestao.alternativa}
                      </button>
                      {' '}— {sugestao.explicacao_alternativa}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grade de tipos */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              {sugestao ? 'Ou escolha outro tipo:' : 'Escolha o tipo de trabalho:'}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TIPOS_LISTA.map(tipo => (
                <TipoTrabalhoCard
                  key={tipo}
                  tipo={tipo}
                  selected={form.tipo_trabalho === tipo}
                  onClick={() => set('tipo_trabalho', tipo)}
                  duracao={FLUXOS[tipo]?.duracao_estimada_horas}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => setStep(1)}
              disabled={!form.tipo_trabalho}
              className={cn(buttonVariants(), 'gap-2')}
            >
              Próximo <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Detalhes */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Detalhes do trabalho</h2>

          <div className="bg-card border rounded-xl p-6 space-y-5">
            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Título <span className="text-muted-foreground font-normal">(opcional — pode definir depois)</span>
              </label>
              <input
                type="text"
                value={form.titulo}
                onChange={e => set('titulo', e.target.value)}
                placeholder="Ex: Efeito da suplementação de vitamina D em pacientes com diabetes tipo 2"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
              {!coerencia.ok && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
                    <p>{coerencia.aviso}</p>
                    {coerencia.sugestaoTipo && (
                      <button
                        type="button"
                        onClick={() => set('tipo_trabalho', coerencia.sugestaoTipo as TipoTrabalho)}
                        className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                      >
                        Mudar para “{coerencia.sugestaoLabel}”
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Área */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Área do conhecimento</label>
              <select
                value={form.area_conhecimento}
                onChange={e => set('area_conhecimento', e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Selecione a área…</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Formato de citação */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Formato de citação</label>
              {fluxoSelecionado?.formatos_citacao_recomendados && (
                <p className="text-xs text-muted-foreground">
                  Recomendado para {fluxoSelecionado.nome_completo}:{' '}
                  <span className="font-medium text-primary">
                    {fluxoSelecionado.formatos_citacao_recomendados.join(', ').toUpperCase()}
                  </span>
                </p>
              )}
              <div className="flex gap-3">
                {(['abnt', 'vancouver', 'apa'] as FormatoCitacao[]).map(fmt => (
                  <label key={fmt} className={cn(
                    'flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 text-sm font-medium cursor-pointer transition-all',
                    form.formato_citacao === fmt
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}>
                    <input
                      type="radio"
                      name="formato_citacao"
                      value={fmt}
                      checked={form.formato_citacao === fmt}
                      onChange={() => set('formato_citacao', fmt)}
                      className="sr-only"
                    />
                    {fmt.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            {/* Instituição */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Instituição de destino <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.instituicao_destino}
                onChange={e => set('instituicao_destino', e.target.value)}
                placeholder="Ex: USP, UNICAMP, Faculdade X…"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            {/* Orientador */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set('tem_orientador', !form.tem_orientador)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                    form.tem_orientador ? 'bg-primary' : 'bg-gray-200'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                    form.tem_orientador ? 'translate-x-4.5' : 'translate-x-0.5'
                  )} />
                </button>
                <span className="text-sm font-medium text-muted-foreground">Tenho orientador(a)</span>
              </div>
              {form.tem_orientador && (
                <input
                  type="text"
                  value={form.orientador}
                  onChange={e => set('orientador', e.target.value)}
                  placeholder="Nome do(a) orientador(a)"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              )}
            </div>

            {/* Nível de experiência */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Seu nível de experiência em escrita científica</label>
              <div className="flex gap-3">
                {([
                  { v: 'iniciante', l: 'Iniciante' },
                  { v: 'intermediario', l: 'Intermediário' },
                  { v: 'avancado', l: 'Avançado' },
                ] as { v: NivelExperiencia; l: string }[]).map(({ v, l }) => (
                  <label key={v} className={cn(
                    'flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 text-sm font-medium cursor-pointer transition-all',
                    form.nivel_experiencia === v
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}>
                    <input
                      type="radio"
                      name="nivel_experiencia"
                      value={v}
                      checked={form.nivel_experiencia === v}
                      onChange={() => set('nivel_experiencia', v)}
                      className="sr-only"
                    />
                    {l}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(0)} className={cn(buttonVariants({ variant: 'outline' }))}>
              Voltar
            </button>
            <button onClick={() => setStep(2)} className={cn(buttonVariants(), 'gap-2')}>
              Revisar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirmar */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Confirme seu trabalho</h2>

          <div className="bg-card border rounded-xl divide-y">
            <SummaryRow label="Tipo" value={fluxoSelecionado?.nome_completo ?? ''} />
            <SummaryRow label="Título" value={form.titulo || '(a definir)'} />
            <SummaryRow label="Área" value={form.area_conhecimento || '(a definir)'} />
            <SummaryRow label="Citação" value={form.formato_citacao.toUpperCase()} />
            <SummaryRow label="Instituição" value={form.instituicao_destino || '(a definir)'} />
            <SummaryRow label="Orientador" value={form.tem_orientador ? (form.orientador || '(a definir)') : 'Não'} />
            <SummaryRow label="Experiência" value={{ iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }[form.nivel_experiencia]} />
            <SummaryRow label="Fases" value={`${fluxoSelecionado?.fases.length ?? 0} seções guiadas`} />
          </div>

          {fluxoSelecionado && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-2">
              <p className="font-medium">O que vem a seguir?</p>
              <div className="space-y-1.5 text-blue-700">
                <p className="flex gap-2 items-start">
                  <span className="font-bold shrink-0">1º</span>
                  <span><span className="font-semibold">Criar o Plano do Projeto</span> — a IA monta o roadmap completo, incluindo etapas de CEP, coleta e cronograma. <span className="font-semibold">Faça isso antes de escrever.</span></span>
                </p>
                <p className="flex gap-2 items-start">
                  <span className="font-bold shrink-0">2º</span>
                  <span>Com o plano aprovado, escrever as {fluxoSelecionado.fases.length} seções do {fluxoSelecionado.nome_completo} guiadas pela IA.</span>
                </p>
                <p className="flex gap-2 items-start">
                  <span className="font-bold shrink-0">3º</span>
                  <span>Exportar, gerar slides e se preparar para a defesa. Tempo estimado total: <span className="font-semibold">{fluxoSelecionado.duracao_estimada_horas}h</span>.</span>
                </p>
              </div>
            </div>
          )}

          {!coerencia.ok && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 text-sm text-amber-800 dark:text-amber-200 space-y-1.5">
                <p className="font-medium">Título e tipo podem não combinar</p>
                <p className="text-xs">{coerencia.aviso}</p>
                {coerencia.sugestaoTipo && (
                  <button
                    type="button"
                    onClick={() => { set('tipo_trabalho', coerencia.sugestaoTipo as TipoTrabalho); setStep(0) }}
                    className="text-xs font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                  >
                    Mudar para “{coerencia.sugestaoLabel}”
                  </button>
                )}
              </div>
            </div>
          )}

          {erro && (
            <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(1)} disabled={loading} className={cn(buttonVariants({ variant: 'outline' }))}>
              Voltar
            </button>
            <button
              onClick={handleCriar}
              disabled={loading}
              className={cn(buttonVariants(), 'gap-2')}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Criar e iniciar</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
