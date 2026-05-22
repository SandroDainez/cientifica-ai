import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlusCircle, TrendingUp, BookOpen, CheckCircle2, Clock, ArrowRight, Lightbulb } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TrabalhoCard } from '@/components/trabalho/TrabalhoCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Trabalho } from '@/types'

const DICAS = [
  'Na norma ABNT NBR 14724:2011, o resumo deve ter entre 150 e 500 palavras e não deve conter citações.',
  'O objetivo geral deve começar com um verbo no infinitivo (analisar, comparar, avaliar) e responder diretamente à pergunta de pesquisa.',
  'Revisão sistemática ≠ revisão narrativa. A sistemática tem protocolo pré-registrado (PROSPERO) e segue o diagrama PRISMA.',
  'Na Vancouver, as referências são numeradas na ordem de aparecimento no texto, não em ordem alfabética.',
  'A hipótese nula (H0) afirma que não há diferença ou efeito. Seu estudo testa se ela pode ser rejeitada.',
  'Antes de enviar um artigo, verifique as normas do periódico alvo (Guide for Authors) — cada revista tem regras específicas.',
  'O DOI (Digital Object Identifier) é o identificador permanente de um artigo. Sempre inclua nas referências quando disponível.',
  'Na APA 7ª edição, quando há 3 ou mais autores, usa-se apenas o primeiro + "et al." desde a primeira citação.',
]

function getDicaDoDia(): string {
  const dia = new Date().getDate()
  return DICAS[dia % DICAS.length]
}

function getSaudacao(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: trabalhos }] = await Promise.all([
    supabase.from('profiles').select('nome').eq('id', user.id).single(),
    supabase.from('trabalhos').select('*').eq('usuario_id', user.id).order('updated_at', { ascending: false }),
  ])

  const lista = (trabalhos ?? []) as Trabalho[]
  const emAndamento = lista.filter(t => t.status === 'em_andamento')
  const concluidos  = lista.filter(t => t.status === 'concluido')
  const progressoMedio = lista.length > 0
    ? Math.round(lista.reduce((acc, t) => {
        const fluxo = getFluxo(t.tipo_trabalho)
        const total = fluxo?.fases.length ?? 1
        return acc + (t.fases_concluidas.length / total) * 100
      }, 0) / lista.length)
    : 0

  const recentes = lista.slice(0, 5)

  const stats = [
    { label: 'Total de trabalhos', value: lista.length,          icon: BookOpen,     color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Em andamento',       value: emAndamento.length,    icon: Clock,        color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Concluídos',         value: concluidos.length,     icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Progresso médio',    value: `${progressoMedio}%`,  icon: TrendingUp,   color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  const primeiroNome = profile?.nome?.split(' ')[0] ?? 'Pesquisador(a)'

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${getSaudacao()}, ${primeiroNome}!`}
        description={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <Link href="/novo-trabalho" className={cn(buttonVariants(), 'gap-2')}>
            <PlusCircle className="h-4 w-4" />
            Novo Trabalho
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-xl border p-5 flex items-center gap-4 glow-card">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', bg)}>
              <Icon className={cn('h-5 w-5', color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Trabalhos recentes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Trabalhos recentes</h2>
            {lista.length > 5 && (
              <Link href="/trabalhos" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {recentes.length === 0 ? (
            <div className="bg-card border rounded-xl p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Nenhum trabalho ainda</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Crie seu primeiro trabalho científico e comece agora.
              </p>
              <Link href="/novo-trabalho" className={cn(buttonVariants(), 'gap-2')}>
                <PlusCircle className="h-4 w-4" />
                Criar primeiro trabalho
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentes.map(trabalho => {
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

        {/* Sidebar direita */}
        <div className="space-y-4">
          {/* CTA novo trabalho */}
          <div className="gradient-brand rounded-xl p-6 text-white text-center space-y-3">
            <PlusCircle className="h-8 w-8 mx-auto opacity-90" />
            <h3 className="font-bold text-lg">Criar novo trabalho</h3>
            <p className="text-sm text-teal-100">
              TCC, artigo, dissertação, tese e muito mais.
            </p>
            <Link
              href="/novo-trabalho"
              className="block w-full bg-white/15 backdrop-blur-sm text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-white/25 border border-white/30 transition-colors"
            >
              Começar agora
            </Link>
          </div>

          {/* Dica do dia */}
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Lightbulb className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Dica do dia</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{getDicaDoDia()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
