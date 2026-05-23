'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, Brain, FileText, Shield,
  Save, Loader2, CheckCircle2, AlertTriangle, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/client'
import type { Profile, NivelExperiencia, FormatoCitacao } from '@/types'

interface Props { perfil: Profile }

type Status = 'idle' | 'salvando' | 'salvo' | 'erro'

const FORMATOS: { value: FormatoCitacao; label: string; desc: string }[] = [
  { value: 'abnt',      label: 'ABNT',      desc: 'Padrão brasileiro — NBR 6023. Usado em TCCs, dissertações e teses.' },
  { value: 'vancouver', label: 'Vancouver', desc: 'Numérico. Padrão em ciências da saúde e medicina.' },
  { value: 'apa',       label: 'APA 7ª ed.', desc: 'Autor-data. Padrão em psicologia, educação e ciências sociais.' },
]

const NIVEIS_EXP: { value: NivelExperiencia; label: string; desc: string }[] = [
  { value: 'iniciante',     label: 'Iniciante',     desc: 'Primeiro trabalho científico. A IA usa linguagem mais didática.' },
  { value: 'intermediario', label: 'Intermediário', desc: 'Já escreveu alguns trabalhos. Orientações técnicas diretas.' },
  { value: 'avancado',      label: 'Avançado',      desc: 'Pesquisador experiente. Respostas concisas e técnicas.' },
]

export function ConfiguracoesClient({ perfil }: Props) {
  const router = useRouter()
  const [formato, setFormato] = useState<FormatoCitacao>(perfil.formato_citacao_padrao)
  const [nivel, setNivel] = useState<NivelExperiencia>(perfil.nivel_experiencia)
  const [status, setStatus] = useState<Status>('idle')
  const [deletando, setDeletando] = useState(false)
  const [confirmarDelete, setConfirmarDelete] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setStatus('salvando')
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato_citacao_padrao: formato, nivel_experiencia: nivel }),
      })
      if (!res.ok) throw new Error()
      setStatus('salvo')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      console.error('[ConfiguracoesClient] Erro:', err)
      setStatus('erro')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  async function handleDeletarConta() {
    if (!confirmarDelete) { setConfirmarDelete(true); return }
    setDeletando(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('[ConfiguracoesClient] Erro:', err)
      setDeletando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Configurações"
        description="Preferências padrão e comportamento da IA"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Configurações' },
        ]}
      />

      <form onSubmit={salvar} className="space-y-5">

        {/* Formato de citação padrão */}
        <Section title="Formato de citação padrão" icon={FileText}
          desc="Usado automaticamente em novos trabalhos. Pode ser alterado por trabalho.">
          <div className="space-y-2">
            {FORMATOS.map(f => (
              <label key={f.value} className={cn(
                'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                formato === f.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}>
                <input type="radio" name="formato" value={f.value}
                  checked={formato === f.value} onChange={() => setFormato(f.value)}
                  className="sr-only" />
                <div className={cn(
                  'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  formato === f.value ? 'border-primary' : 'border-gray-300'
                )}>
                  {formato === f.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Nível de experiência */}
        <Section title="Nível de experiência em escrita científica" icon={Brain}
          desc="Define o tom e a profundidade das respostas da IA.">
          <div className="space-y-2">
            {NIVEIS_EXP.map(n => (
              <label key={n.value} className={cn(
                'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                nivel === n.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}>
                <input type="radio" name="nivel" value={n.value}
                  checked={nivel === n.value} onChange={() => setNivel(n.value)}
                  className="sr-only" />
                <div className={cn(
                  'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  nivel === n.value ? 'border-primary' : 'border-gray-300'
                )}>
                  {nivel === n.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{n.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Salvar preferências */}
        <div className="flex items-center justify-between">
          <span>
            {status === 'salvo' && (
              <p className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Preferências salvas!
              </p>
            )}
            {status === 'erro' && (
              <p className="text-sm text-red-600">Erro ao salvar. Tente novamente.</p>
            )}
          </span>
          <button type="submit" disabled={status === 'salvando'}
            className={cn(buttonVariants(), 'gap-2')}>
            {status === 'salvando'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
              : <><Save className="h-4 w-4" /> Salvar preferências</>
            }
          </button>
        </div>
      </form>

      {/* Zona de perigo */}
      <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-red-200 bg-red-50">
          <Shield className="h-4 w-4 text-red-600" />
          <p className="text-sm font-semibold text-red-700">Zona de risco</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Encerrar sessão</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sair da conta em todos os dispositivos.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0 text-sm border-red-200 text-red-600 hover:bg-red-50')}
            >
              Sair
            </button>
          </div>

          <div className="border-t pt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Excluir conta</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Remove todos os seus trabalhos e dados permanentemente. Ação irreversível.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeletarConta}
              disabled={deletando}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'shrink-0 text-sm gap-2',
                confirmarDelete
                  ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
                  : 'border-red-200 text-red-600 hover:bg-red-50'
              )}
            >
              {deletando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Excluindo…</>
                : confirmarDelete
                ? <><AlertTriangle className="h-4 w-4" /> Confirmar exclusão</>
                : <><Trash2 className="h-4 w-4" /> Excluir conta</>
              }
            </button>
          </div>
          {confirmarDelete && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Clique novamente para confirmar. Esta ação não pode ser desfeita.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, desc, children }: {
  title: string; icon: React.ElementType; desc: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-gray-50">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
