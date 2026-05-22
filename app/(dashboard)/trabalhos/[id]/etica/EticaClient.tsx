'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Shield, ArrowLeft, Save, Loader2, CheckCircle2,
  AlertTriangle, ExternalLink, Sparkles, FileText, Users, FlaskConical, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Trabalho } from '@/types'

interface EticaData {
  envolve_seres_humanos: boolean
  envolve_animais: boolean
  tipo_pesquisa: string
  titulo_projeto: string
  pesquisador_responsavel: string
  instituicao_proponente: string
  resumo_projeto: string
  objetivo_primario: string
  justificativa: string
  metodologia: string
  criterios_inclusao: string
  criterios_exclusao: string
  tamanho_amostra: string
  riscos: string
  beneficios: string
  termo_consentimento: string
  status_cep: string
  numero_caae: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { trabalho: Trabalho; eticaInicial: any }

const TIPOS_PESQUISA = [
  'Observacional',
  'Experimental (ECR)',
  'Survey / Questionário',
  'Retrospectiva (prontuários)',
  'Prospectiva',
  'Qualitativa',
  'Mista',
]

const AREAS_TEMATICAS = [
  'Genética Humana',
  'Reprodução Humana',
  'Fármacos, medicamentos e vacinas',
  'Equipamentos e dispositivos',
  'Nutrição',
  'Meio ambiente',
  'Biossegurança',
  'Saúde dos Povos Indígenas',
  'Pesquisa em subgrupos especiais',
  'Projetos de caráter internacional',
  'Outros',
]

export function EticaClient({ trabalho, eticaInicial }: Props) {
  const [dados, setDados] = useState<EticaData>({
    envolve_seres_humanos: eticaInicial?.envolve_seres_humanos ?? false,
    envolve_animais: eticaInicial?.envolve_animais ?? false,
    tipo_pesquisa: eticaInicial?.tipo_pesquisa ?? '',
    titulo_projeto: eticaInicial?.titulo_projeto ?? trabalho.titulo ?? '',
    pesquisador_responsavel: eticaInicial?.pesquisador_responsavel ?? '',
    instituicao_proponente: eticaInicial?.instituicao_proponente ?? '',
    resumo_projeto: eticaInicial?.resumo_projeto ?? '',
    objetivo_primario: eticaInicial?.objetivo_primario ?? '',
    justificativa: eticaInicial?.justificativa ?? '',
    metodologia: eticaInicial?.metodologia ?? '',
    criterios_inclusao: eticaInicial?.criterios_inclusao ?? '',
    criterios_exclusao: eticaInicial?.criterios_exclusao ?? '',
    tamanho_amostra: eticaInicial?.tamanho_amostra?.toString() ?? '',
    riscos: eticaInicial?.riscos ?? '',
    beneficios: eticaInicial?.beneficios ?? '',
    termo_consentimento: eticaInicial?.termo_consentimento ?? '',
    status_cep: eticaInicial?.status_cep ?? 'pendente',
    numero_caae: eticaInicial?.numero_caae ?? '',
  })

  const [status, setStatus] = useState<'idle' | 'salvando' | 'salvo' | 'erro'>('idle')
  const [gerandoTCLE, setGerandoTCLE] = useState(false)
  const [tcleGerado, setTcleGerado] = useState('')

  function set<K extends keyof EticaData>(key: K, val: EticaData[K]) {
    setDados(prev => ({ ...prev, [key]: val }))
  }

  async function salvar() {
    setStatus('salvando')
    try {
      const res = await fetch(`/api/trabalhos/${trabalho.id}/etica`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dados, tamanho_amostra: dados.tamanho_amostra ? parseInt(dados.tamanho_amostra) : null }),
      })
      if (!res.ok) throw new Error()
      setStatus('salvo')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('erro')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  async function gerarTCLE() {
    setGerandoTCLE(true)
    setTcleGerado('')
    try {
      const res = await fetch('/api/ia/gerar-tcle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          titulo: dados.titulo_projeto,
          objetivo: dados.objetivo_primario,
          metodologia: dados.metodologia,
          riscos: dados.riscos,
          beneficios: dados.beneficios,
          pesquisador: dados.pesquisador_responsavel,
          instituicao: dados.instituicao_proponente,
        }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setTcleGerado(acumulado)
      }
      set('termo_consentimento', acumulado)
    } finally {
      setGerandoTCLE(false)
    }
  }

  const precisaCEP = dados.envolve_seres_humanos
  const precisaCEUA = dados.envolve_animais

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <PageHeader
        title="Comitê de Ética em Pesquisa (CEP)"
        description="Formulário para submissão via Plataforma Brasil"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo ?? 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'Ética / CEP' },
        ]}
        actions={
          <Link href={`/trabalhos/${trabalho.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
            <ArrowLeft className="h-4 w-4" /> Voltar ao Editor
          </Link>
        }
      />

      {/* Alerta informativo */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Sobre a aprovação ética</p>
          <p className="text-sm text-amber-800 mt-1">
            Pesquisas envolvendo seres humanos devem ser submetidas ao CEP via{' '}
            <a href="https://plataformabrasil.saude.gov.br" target="_blank" rel="noopener noreferrer"
              className="underline font-medium">Plataforma Brasil</a>.
            A pesquisa só pode iniciar após aprovação. O prazo médio é de 30 a 60 dias.
          </p>
        </div>
      </div>

      {/* Seção 1 — Tipo de pesquisa */}
      <Section title="Identificação do tipo de pesquisa" icon={FlaskConical}>
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={dados.envolve_seres_humanos}
                onChange={e => set('envolve_seres_humanos', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary" />
              <span className="text-sm font-medium">A pesquisa envolve seres humanos</span>
              {dados.envolve_seres_humanos && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Requer CEP</span>
              )}
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={dados.envolve_animais}
                onChange={e => set('envolve_animais', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary" />
              <span className="text-sm font-medium">A pesquisa envolve animais</span>
              {dados.envolve_animais && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Requer CEUA</span>
              )}
            </label>
          </div>

          <Field label="Tipo de pesquisa">
            <select value={dados.tipo_pesquisa} onChange={e => set('tipo_pesquisa', e.target.value)} className={selectCls}>
              <option value="">Selecione…</option>
              {TIPOS_PESQUISA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Área temática (CNS)">
            <select value="" onChange={e => { /* handled externally */ }} className={selectCls}>
              <option value="">Selecione a área temática…</option>
              {AREAS_TEMATICAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      {/* Seção 2 — Identificação */}
      <Section title="Identificação do projeto e pesquisadores" icon={Users}>
        <div className="space-y-4">
          <Field label="Título do projeto de pesquisa *">
            <input value={dados.titulo_projeto} onChange={e => set('titulo_projeto', e.target.value)}
              className={inputCls} placeholder="Título completo do projeto" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Pesquisador responsável *">
              <input value={dados.pesquisador_responsavel} onChange={e => set('pesquisador_responsavel', e.target.value)}
                className={inputCls} placeholder="Nome completo" />
            </Field>
            <Field label="Instituição proponente *">
              <input value={dados.instituicao_proponente} onChange={e => set('instituicao_proponente', e.target.value)}
                className={inputCls} placeholder="Ex: Universidade Federal de…" />
            </Field>
          </div>

          {dados.status_cep !== 'pendente' && (
            <Field label="Número CAAE (após aprovação)">
              <input value={dados.numero_caae} onChange={e => set('numero_caae', e.target.value)}
                className={inputCls} placeholder="Ex: 12345678.9.0000.0000" />
            </Field>
          )}

          <Field label="Status no CEP">
            <select value={dados.status_cep} onChange={e => set('status_cep', e.target.value)} className={selectCls}>
              <option value="pendente">Pendente (não submetido)</option>
              <option value="submetido">Submetido — aguardando avaliação</option>
              <option value="aprovado">Aprovado</option>
              <option value="necessita_revisao">Necessita revisão (Pendência)</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Seção 3 — Resumo e objetivos */}
      <Section title="Resumo e objetivos" icon={FileText}>
        <div className="space-y-4">
          <Field label={`Resumo do projeto (máx. 1500 palavras)`}>
            <textarea value={dados.resumo_projeto} onChange={e => set('resumo_projeto', e.target.value)}
              rows={6} className={textareaCls}
              placeholder="Descreva o projeto de forma clara e objetiva, contextualizando o problema, a relevância e a metodologia…" />
          </Field>
          <Field label="Objetivo primário *">
            <textarea value={dados.objetivo_primario} onChange={e => set('objetivo_primario', e.target.value)}
              rows={3} className={textareaCls}
              placeholder="Descreva o objetivo principal da pesquisa em uma ou duas frases claras" />
          </Field>
          <Field label="Justificativa">
            <textarea value={dados.justificativa} onChange={e => set('justificativa', e.target.value)}
              rows={4} className={textareaCls}
              placeholder="Por que esta pesquisa é necessária? Qual o benefício para a ciência e para a sociedade?" />
          </Field>
        </div>
      </Section>

      {/* Seção 4 — Metodologia e amostra */}
      <Section title="Metodologia e participantes" icon={ClipboardList}>
        <div className="space-y-4">
          <Field label="Delineamento e metodologia">
            <textarea value={dados.metodologia} onChange={e => set('metodologia', e.target.value)}
              rows={4} className={textareaCls}
              placeholder="Descreva: tipo de estudo, local, período, procedimentos realizados com os participantes…" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Critérios de inclusão">
              <textarea value={dados.criterios_inclusao} onChange={e => set('criterios_inclusao', e.target.value)}
                rows={3} className={textareaCls} placeholder="Liste os critérios que tornam o participante elegível" />
            </Field>
            <Field label="Critérios de exclusão">
              <textarea value={dados.criterios_exclusao} onChange={e => set('criterios_exclusao', e.target.value)}
                rows={3} className={textareaCls} placeholder="Liste os critérios que tornam o participante inelegível" />
            </Field>
          </div>
          <Field label="Tamanho da amostra previsto">
            <input type="number" value={dados.tamanho_amostra} onChange={e => set('tamanho_amostra', e.target.value)}
              className={cn(inputCls, 'w-40')} placeholder="N = " min={1} />
          </Field>
        </div>
      </Section>

      {/* Seção 5 — Riscos e benefícios */}
      <Section title="Riscos e benefícios" icon={Shield}>
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            Toda pesquisa com seres humanos possui algum risco. Declare-os com honestidade — o CEP avalia se os riscos são justificados pelos benefícios.
          </div>
          <Field label="Riscos para os participantes">
            <textarea value={dados.riscos} onChange={e => set('riscos', e.target.value)}
              rows={4} className={textareaCls}
              placeholder="Descreva todos os riscos possíveis: físicos, psicológicos, sociais, econômicos… Mesmo riscos mínimos devem ser declarados." />
          </Field>
          <Field label="Benefícios esperados">
            <textarea value={dados.beneficios} onChange={e => set('beneficios', e.target.value)}
              rows={3} className={textareaCls}
              placeholder="Benefícios diretos para os participantes e benefícios indiretos para a sociedade/ciência" />
          </Field>
        </div>
      </Section>

      {/* Seção 6 — TCLE */}
      {precisaCEP && (
        <Section title="Termo de Consentimento Livre e Esclarecido (TCLE)" icon={FileText}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O TCLE deve seguir a Resolução CNS 466/2012. A IA pode gerar um modelo completo com base nos dados preenchidos acima.
            </p>
            <button type="button" onClick={gerarTCLE} disabled={gerandoTCLE || !dados.objetivo_primario.trim()}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              {gerandoTCLE ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {gerandoTCLE ? 'Gerando TCLE…' : 'Gerar modelo de TCLE com IA'}
            </button>
            {!dados.objetivo_primario.trim() && (
              <p className="text-xs text-muted-foreground">Preencha o objetivo primário antes de gerar o TCLE.</p>
            )}
            <textarea
              value={dados.termo_consentimento || tcleGerado}
              onChange={e => set('termo_consentimento', e.target.value)}
              rows={12}
              className={textareaCls}
              placeholder="O TCLE gerado aparecerá aqui. Você pode editar antes de usar."
            />
          </div>
        </Section>
      )}

      {/* Checklist Plataforma Brasil */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-gray-900">Checklist — Plataforma Brasil</p>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">Documentos geralmente necessários para submissão:</p>
          <div className="space-y-2 text-sm">
            {[
              'Folha de rosto gerada pela Plataforma Brasil',
              'Projeto de pesquisa completo (PDF)',
              'TCLE (e Termo de Assentimento se houver menores)',
              'Currículo Lattes do pesquisador responsável',
              'Declaração de infraestrutura da instituição',
              'Aprovação da chefia/direção (se pesquisa institucional)',
              'Orçamento detalhado (se houver financiamento externo)',
            ].map((item, i) => (
              <label key={i} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary" />
                <span className="text-gray-700">{item}</span>
              </label>
            ))}
          </div>
          <div className="pt-2">
            <a href="https://plataformabrasil.saude.gov.br" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
              <ExternalLink className="h-3.5 w-3.5" /> Acessar Plataforma Brasil
            </a>
          </div>
        </div>
      </div>

      {/* Botão salvar */}
      <div className="flex items-center justify-between">
        <span>
          {status === 'salvo' && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso!
            </p>
          )}
          {status === 'erro' && <p className="text-sm text-red-600">Erro ao salvar. Tente novamente.</p>}
        </span>
        <button onClick={salvar} disabled={status === 'salvando'}
          className={cn(buttonVariants(), 'gap-2')}>
          {status === 'salvando' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {status === 'salvando' ? 'Salvando…' : 'Salvar formulário CEP'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-gray-900">{title}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'
const selectCls = 'w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'
const textareaCls = 'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-y'
