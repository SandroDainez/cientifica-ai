'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, CheckCircle2, ExternalLink,
  Database, Filter, FileSearch, CheckSquare, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { DiagramaPRISMA } from '@/components/prisma/DiagramaPRISMA'
import type { Trabalho } from '@/types'

interface Props { trabalho: Trabalho; prismaInicial: PrismaState | null }

const BASES = [
  'PubMed/MEDLINE', 'EMBASE', 'Cochrane Library',
  'LILACS/BVS', 'Web of Science', 'Scopus',
  'SciELO', 'PsycINFO', 'CINAHL',
]

interface PrismaState {
  bases_pesquisadas: string[]
  registros_identificados: number
  registros_duplicados: number
  registros_triagem: number
  registros_excluidos_titulo: number
  textos_completos_avaliados: number
  textos_excluidos: number
  estudos_incluidos: number
  criterios_inclusao: string
  criterios_exclusao: string
  estrategia_busca: string
  data_busca: string
  pergunta_pico: string
  numero_prospero: string
  motivos_exclusao: { motivo: string; n: number }[]
}

export function PrismaClient({ trabalho, prismaInicial }: Props) {
  const [dados, setDados] = useState<PrismaState>({
    bases_pesquisadas: prismaInicial?.bases_pesquisadas ?? [],
    registros_identificados: prismaInicial?.registros_identificados ?? 0,
    registros_duplicados: prismaInicial?.registros_duplicados ?? 0,
    registros_triagem: prismaInicial?.registros_triagem ?? 0,
    registros_excluidos_titulo: prismaInicial?.registros_excluidos_titulo ?? 0,
    textos_completos_avaliados: prismaInicial?.textos_completos_avaliados ?? 0,
    textos_excluidos: prismaInicial?.textos_excluidos ?? 0,
    estudos_incluidos: prismaInicial?.estudos_incluidos ?? 0,
    criterios_inclusao: prismaInicial?.criterios_inclusao ?? '',
    criterios_exclusao: prismaInicial?.criterios_exclusao ?? '',
    estrategia_busca: prismaInicial?.estrategia_busca ?? '',
    data_busca: prismaInicial?.data_busca ?? '',
    pergunta_pico: prismaInicial?.pergunta_pico ?? '',
    numero_prospero: prismaInicial?.numero_prospero ?? '',
    motivos_exclusao: prismaInicial?.motivos_exclusao ?? [{ motivo: '', n: 0 }],
  })

  const [status, setStatus] = useState<'idle' | 'salvando' | 'salvo' | 'erro'>('idle')
  const [gerandoEstrategia, setGerandoEstrategia] = useState(false)

  function set<K extends keyof PrismaState>(key: K, val: PrismaState[K]) {
    setDados(prev => ({ ...prev, [key]: val }))
  }

  function toggleBase(base: string) {
    const atual = dados.bases_pesquisadas
    set('bases_pesquisadas', atual.includes(base) ? atual.filter(b => b !== base) : [...atual, base])
  }

  function setNum(key: keyof PrismaState, val: string) {
    set(key, (parseInt(val) || 0) as never)
  }

  function adicionarMotivo() {
    set('motivos_exclusao', [...dados.motivos_exclusao, { motivo: '', n: 0 }])
  }

  function setMotivo(i: number, campo: 'motivo' | 'n', val: string) {
    const nova = dados.motivos_exclusao.map((m, idx) =>
      idx === i ? { ...m, [campo]: campo === 'n' ? parseInt(val) || 0 : val } : m
    )
    set('motivos_exclusao', nova)
  }

  async function gerarEstrategia() {
    setGerandoEstrategia(true)
    try {
      const res = await fetch('/api/ia/gerar-estrategia-busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          pergunta_pico: dados.pergunta_pico,
          bases: dados.bases_pesquisadas,
          criterios_inclusao: dados.criterios_inclusao,
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
        set('estrategia_busca', acumulado)
      }
    } finally {
      setGerandoEstrategia(false)
    }
  }

  async function salvar() {
    setStatus('salvando')
    try {
      const res = await fetch(`/api/trabalhos/${trabalho.id}/prisma`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      if (!res.ok) throw new Error()
      setStatus('salvo')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      console.error('[PrismaClient] Erro:', err)
      setStatus('erro')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  const numerosParaDiagrama = {
    identificados: dados.registros_identificados,
    duplicados: dados.registros_duplicados,
    apos_remocao: dados.registros_triagem,
    excluidos_titulo: dados.registros_excluidos_titulo,
    textos_avaliados: dados.textos_completos_avaliados,
    textos_excluidos: dados.textos_excluidos,
    estudos_incluidos: dados.estudos_incluidos,
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <PageHeader
        title="Diagrama PRISMA"
        description="Preferred Reporting Items for Systematic Reviews and Meta-Analyses 2020"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meus Trabalhos', href: '/trabalhos' },
          { label: trabalho.titulo ?? 'Trabalho', href: `/trabalhos/${trabalho.id}/editar` },
          { label: 'PRISMA' },
        ]}
        actions={
          <div className="flex gap-2">
            <a href="https://www.prisma-statement.org" target="_blank" rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-sm')}>
              <ExternalLink className="h-4 w-4" /> PRISMA 2020
            </a>
            <Link href={`/trabalhos/${trabalho.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </div>
        }
      />

      {/* Seção 1 — Protocolo */}
      <Section title="Protocolo e pergunta de pesquisa" icon={FileSearch}>
        <Field label="Número de registro no PROSPERO (se disponível)">
          <div className="flex gap-2">
            <input value={dados.numero_prospero} onChange={e => set('numero_prospero', e.target.value)}
              className={cn(inputCls, 'flex-1')} placeholder="CRD42024000000" />
            <a href="https://www.crd.york.ac.uk/prospero/" target="_blank" rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5 text-sm shrink-0')}>
              <ExternalLink className="h-3.5 w-3.5" /> PROSPERO
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Recomenda-se registrar o protocolo antes de iniciar a busca.
          </p>
        </Field>
        <Field label="Pergunta de pesquisa (PICO/PICOS)">
          <textarea value={dados.pergunta_pico} onChange={e => set('pergunta_pico', e.target.value)}
            rows={3} className={textareaCls}
            placeholder="P: População | I: Intervenção | C: Comparação | O: Desfecho | S: Tipo de estudo" />
        </Field>
        <Field label="Data da última busca">
          <input type="date" value={dados.data_busca} onChange={e => set('data_busca', e.target.value)}
            className={cn(inputCls, 'w-48')} />
        </Field>
      </Section>

      {/* Seção 2 — Bases */}
      <Section title="Bases de dados pesquisadas" icon={Database}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BASES.map(base => (
            <label key={base} className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm',
              dados.bases_pesquisadas.includes(base)
                ? 'border-primary bg-primary/5 text-primary font-medium'
                : 'border-border hover:border-primary/40'
            )}>
              <input type="checkbox" checked={dados.bases_pesquisadas.includes(base)}
                onChange={() => toggleBase(base)} className="sr-only" />
              <div className={cn(
                'h-3.5 w-3.5 rounded border-2 shrink-0 flex items-center justify-center',
                dados.bases_pesquisadas.includes(base) ? 'border-primary bg-primary' : 'border-gray-300'
              )}>
                {dados.bases_pesquisadas.includes(base) && (
                  <CheckSquare className="h-2.5 w-2.5 text-white" />
                )}
              </div>
              {base}
            </label>
          ))}
        </div>
      </Section>

      {/* Seção 3 — Critérios */}
      <Section title="Critérios de elegibilidade" icon={Filter}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Critérios de inclusão">
            <textarea value={dados.criterios_inclusao} onChange={e => set('criterios_inclusao', e.target.value)}
              rows={4} className={textareaCls}
              placeholder="• Estudos em humanos adultos&#10;• ECR e estudos observacionais&#10;• Publicados de 2010 a 2024…" />
          </Field>
          <Field label="Critérios de exclusão">
            <textarea value={dados.criterios_exclusao} onChange={e => set('criterios_exclusao', e.target.value)}
              rows={4} className={textareaCls}
              placeholder="• Relatos de caso e série de casos&#10;• Estudos sem grupo controle&#10;• Idiomas fora do escopo…" />
          </Field>
        </div>
        <Field label="Estratégia de busca (strings para as bases)">
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={gerarEstrategia}
              disabled={gerandoEstrategia || !dados.pergunta_pico.trim()}
              className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 text-sm')}>
              {gerandoEstrategia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar com IA
            </button>
          </div>
          <textarea value={dados.estrategia_busca} onChange={e => set('estrategia_busca', e.target.value)}
            rows={6} className={textareaCls}
            placeholder="PubMed: (diabetes[MeSH]) AND (exercise[MeSH] OR &quot;physical activity&quot;) AND (glycemic control[MeSH])&#10;&#10;LILACS: (diabetes) AND (exercício OR atividade física)…" />
        </Field>
      </Section>

      {/* Seção 4 — Números do fluxo */}
      <Section title="Dados do fluxo PRISMA" icon={Filter}>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField label="Registros identificados nas bases" value={dados.registros_identificados}
            onChange={v => setNum('registros_identificados', v)} />
          <NumField label="Registros duplicados removidos" value={dados.registros_duplicados}
            onChange={v => setNum('registros_duplicados', v)} />
          <NumField label="Registros após remoção de duplicatas" value={dados.registros_triagem}
            onChange={v => setNum('registros_triagem', v)} />
          <NumField label="Excluídos por título/resumo" value={dados.registros_excluidos_titulo}
            onChange={v => setNum('registros_excluidos_titulo', v)} />
          <NumField label="Textos completos avaliados" value={dados.textos_completos_avaliados}
            onChange={v => setNum('textos_completos_avaliados', v)} />
          <NumField label="Textos excluídos (com motivo)" value={dados.textos_excluidos}
            onChange={v => setNum('textos_excluidos', v)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Motivos de exclusão dos textos completos</label>
          <div className="space-y-2">
            {dados.motivos_exclusao.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input value={m.motivo} onChange={e => setMotivo(i, 'motivo', e.target.value)}
                  className={cn(inputCls, 'flex-1')} placeholder="Ex: metodologia inadequada" />
                <input type="number" value={m.n} onChange={e => setMotivo(i, 'n', e.target.value)}
                  className={cn(inputCls, 'w-20')} min={0} placeholder="N" />
              </div>
            ))}
            <button type="button" onClick={adicionarMotivo}
              className="text-xs text-primary hover:underline">
              + Adicionar motivo
            </button>
          </div>
        </div>
        <NumField label="Estudos incluídos na síntese" value={dados.estudos_incluidos}
          onChange={v => setNum('estudos_incluidos', v)} />
      </Section>

      {/* Diagrama visual */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-gray-900">Diagrama PRISMA 2020 — Preview</p>
        </div>
        <div className="p-5">
          <DiagramaPRISMA numeros={numerosParaDiagrama} />
          <p className="text-xs text-muted-foreground mt-4 text-center">
            O diagrama atualiza automaticamente conforme você preenche os números acima.
          </p>
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
          {status === 'salvando' ? 'Salvando…' : 'Salvar PRISMA'}
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

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        min={0} className={cn(inputCls, 'w-32')} />
    </Field>
  )
}

const inputCls = 'w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'
const textareaCls = 'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-y'
