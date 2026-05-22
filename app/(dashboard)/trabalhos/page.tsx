import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlusCircle, Search, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TrabalhoCard } from '@/components/trabalho/TrabalhoCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Trabalho, TipoTrabalho, StatusTrabalho } from '@/types'

const TIPOS_FILTRO: { value: string; label: string }[] = [
  { value: '',                    label: 'Todos os tipos' },
  { value: 'tcc',                 label: 'TCC' },
  { value: 'artigo_original',     label: 'Artigo Original' },
  { value: 'artigo_revisao',      label: 'Artigo de Revisão' },
  { value: 'relato_caso',         label: 'Relato de Caso' },
  { value: 'monografia',          label: 'Monografia' },
  { value: 'dissertacao_mestrado',label: 'Dissertação' },
  { value: 'tese_doutorado',      label: 'Tese de Doutorado' },
  { value: 'revisao_sistematica', label: 'Revisão Sistemática' },
  { value: 'projeto_pesquisa',    label: 'Projeto de Pesquisa' },
  { value: 'relatorio_ic',        label: 'Relatório IC' },
]

interface PageProps {
  searchParams: Promise<{ tipo?: string; status?: string; q?: string }>
}

export default async function TrabalhosPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const { tipo, status, q } = params

  let query = supabase
    .from('trabalhos')
    .select('*')
    .eq('usuario_id', user.id)
    .order('updated_at', { ascending: false })

  if (tipo)   query = query.eq('tipo_trabalho', tipo)
  if (status) query = query.eq('status', status)
  if (q)      query = query.ilike('titulo', `%${q}%`)

  const { data } = await query
  const lista = (data ?? []) as Trabalho[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus Trabalhos"
        description={`${lista.length} trabalho${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Meus Trabalhos' }]}
        actions={
          <Link href="/novo-trabalho" className={cn(buttonVariants(), 'gap-2')}>
            <PlusCircle className="h-4 w-4" />
            Novo Trabalho
          </Link>
        }
      />

      {/* Filtros */}
      <form method="GET" className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por título…"
            className="w-full pl-9 h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <select
          name="tipo"
          defaultValue={tipo}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          {TIPOS_FILTRO.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="">Todos os status</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
          <option value="arquivado">Arquivado</option>
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: 'outline' }))}>
          Filtrar
        </button>
      </form>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="bg-white border rounded-xl p-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">
            {q || tipo || status ? 'Nenhum trabalho encontrado' : 'Nenhum trabalho ainda'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {q || tipo || status
              ? 'Tente ajustar os filtros de busca.'
              : 'Crie seu primeiro trabalho científico agora mesmo.'
            }
          </p>
          {!q && !tipo && !status && (
            <Link href="/novo-trabalho" className={cn(buttonVariants(), 'gap-2')}>
              <PlusCircle className="h-4 w-4" />
              Criar primeiro trabalho
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map(trabalho => {
            const fluxo = getFluxo(trabalho.tipo_trabalho)
            return (
              <TrabalhoCard
                key={trabalho.id}
                trabalho={trabalho}
                totalFases={fluxo?.fases.length ?? 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
