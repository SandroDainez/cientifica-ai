'use client'

import { useState } from 'react'
import { User, BookOpen, ExternalLink, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Profile, NivelAcademico } from '@/types'

interface Props {
  perfil: Profile
  email: string
}

const NIVEIS: { value: NivelAcademico; label: string }[] = [
  { value: 'graduacao',      label: 'Graduação' },
  { value: 'especializacao', label: 'Especialização / MBA' },
  { value: 'mestrado',       label: 'Mestrado' },
  { value: 'doutorado',      label: 'Doutorado' },
  { value: 'professor',      label: 'Professor / Pesquisador' },
]

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

type Status = 'idle' | 'salvando' | 'salvo' | 'erro'

export function PerfilClient({ perfil, email }: Props) {
  const [form, setForm] = useState({
    nome: perfil.nome ?? '',
    instituicao: perfil.instituicao ?? '',
    nivel_academico: perfil.nivel_academico ?? '',
    area_conhecimento: perfil.area_conhecimento ?? '',
    orientador_nome: perfil.orientador_nome ?? '',
    orientador_email: perfil.orientador_email ?? '',
    lattes: perfil.lattes ?? '',
    orcid: perfil.orcid ?? '',
  })

  const [status, setStatus] = useState<Status>('idle')

  function set(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setStatus('salvando')
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setStatus('salvo')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      console.error('[PerfilClient] Erro:', err)
      setStatus('erro')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  const initials = form.nome
    ? form.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Meu Perfil"
        description="Dados acadêmicos e informações pessoais"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Perfil' },
        ]}
      />

      <form onSubmit={salvar} className="space-y-5">
        {/* Avatar + identificação */}
        <div className="bg-white border rounded-xl p-6 flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-brand text-white text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{form.nome || 'Sem nome'}</p>
            <p className="text-sm text-muted-foreground truncate">{email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Membro desde {new Date(perfil.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Dados pessoais */}
        <Section title="Dados pessoais" icon={User}>
          <Field label="Nome completo *">
            <input required value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Seu nome completo" className={inputCls} />
          </Field>
          <Field label="E-mail">
            <input value={email} disabled className={cn(inputCls, 'bg-gray-50 text-muted-foreground cursor-not-allowed')} />
            <p className="text-xs text-muted-foreground mt-1">O e-mail não pode ser alterado aqui.</p>
          </Field>
          <Field label="Instituição de ensino / pesquisa">
            <input value={form.instituicao} onChange={e => set('instituicao', e.target.value)}
              placeholder="Ex: Universidade de São Paulo" className={inputCls} />
          </Field>
        </Section>

        {/* Dados acadêmicos */}
        <Section title="Dados acadêmicos" icon={BookOpen}>
          <Field label="Nível acadêmico">
            <select value={form.nivel_academico} onChange={e => set('nivel_academico', e.target.value)}
              className={selectCls}>
              <option value="">Selecione…</option>
              {NIVEIS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </Field>
          <Field label="Área do conhecimento (CNPq)">
            <select value={form.area_conhecimento} onChange={e => set('area_conhecimento', e.target.value)}
              className={selectCls}>
              <option value="">Selecione…</option>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome do orientador(a)">
              <input value={form.orientador_nome} onChange={e => set('orientador_nome', e.target.value)}
                placeholder="Prof. Dr. Nome Sobrenome" className={inputCls} />
            </Field>
            <Field label="E-mail do orientador(a)">
              <input type="email" value={form.orientador_email} onChange={e => set('orientador_email', e.target.value)}
                placeholder="orientador@univ.br" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Identificadores acadêmicos */}
        <Section title="Identificadores acadêmicos" icon={ExternalLink}>
          <Field label="Currículo Lattes (URL)">
            <input value={form.lattes} onChange={e => set('lattes', e.target.value)}
              type="url" placeholder="http://lattes.cnpq.br/…" className={inputCls} />
          </Field>
          <Field label="ORCID">
            <input value={form.orcid} onChange={e => set('orcid', e.target.value)}
              placeholder="0000-0000-0000-0000" className={inputCls} />
          </Field>
          <div className="flex gap-3">
            {form.lattes && (
              <a href={form.lattes} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Ver Lattes
              </a>
            )}
            {form.orcid && (
              <a href={`https://orcid.org/${form.orcid}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Ver ORCID
              </a>
            )}
          </div>
        </Section>

        {/* Botão salvar */}
        <div className="flex items-center justify-between">
          {status === 'salvo' && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Perfil salvo com sucesso!
            </p>
          )}
          {status === 'erro' && (
            <p className="text-sm text-red-600">Erro ao salvar. Tente novamente.</p>
          )}
          {(status === 'idle' || status === 'salvando') && <span />}

          <button type="submit" disabled={status === 'salvando'}
            className={cn(buttonVariants(), 'gap-2')}>
            {status === 'salvando'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
              : <><Save className="h-4 w-4" /> Salvar perfil</>
            }
          </button>
        </div>
      </form>
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
