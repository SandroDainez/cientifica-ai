import Link from 'next/link'
import {
  GraduationCap, FileText, BookOpen, FlaskConical, Award,
  ArrowRight, CheckCircle2, Sparkles, Zap, Shield, Clock,
  ChevronDown, Star, Users, BookMarked, Presentation,
  BarChart3, Search, ClipboardList,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Dados ──────────────────────────────────────────────────────

const TIPOS = [
  { icon: GraduationCap, label: 'TCC',               color: 'text-blue-600',   bg: 'bg-blue-50' },
  { icon: FileText,      label: 'Artigo Original',    color: 'text-green-600',  bg: 'bg-green-50' },
  { icon: BookOpen,      label: 'Artigo de Revisão',  color: 'text-emerald-600',bg: 'bg-emerald-50' },
  { icon: ClipboardList, label: 'Relato de Caso',     color: 'text-orange-600', bg: 'bg-orange-50' },
  { icon: Award,         label: 'Dissertação',        color: 'text-violet-600', bg: 'bg-violet-50' },
  { icon: FlaskConical,  label: 'Tese de Doutorado',  color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { icon: Search,        label: 'Revisão Sistemática',color: 'text-purple-600', bg: 'bg-purple-50' },
  { icon: BarChart3,     label: 'Projeto de Pesquisa',color: 'text-cyan-600',   bg: 'bg-cyan-50' },
]

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Geração seção por seção',
    desc: 'A IA escreve cada parte do trabalho seguindo as instruções da seção, elementos obrigatórios e a coerência com o que já foi escrito.',
  },
  {
    icon: Shield,
    title: 'Validação automática',
    desc: 'Cada seção é validada com score de 0 a 100. A IA aponta problemas críticos, importantes e sugestões de melhoria.',
  },
  {
    icon: BookMarked,
    title: 'Referências ABNT / Vancouver / APA',
    desc: 'Geração automática de referências no formato correto. Adicione manualmente ou peça à IA para sugerir com base no tema.',
  },
  {
    icon: Presentation,
    title: 'Exportação profissional',
    desc: 'DOCX com formatação ABNT completa (margens, fonte, espaçamento) e PPTX com slides prontos para a defesa.',
  },
  {
    icon: Clock,
    title: 'Progresso e retomada',
    desc: 'Continue de onde parou. O progresso de cada seção é salvo automaticamente e visualizado na barra lateral.',
  },
  {
    icon: Zap,
    title: 'Chat científico integrado',
    desc: 'Painel de chat contextual para tirar dúvidas sobre a seção atual sem sair do editor.',
  },
]

const STEPS = [
  { n: '01', title: 'Crie seu trabalho', desc: 'Escolha o tipo (TCC, artigo, tese…), a área do conhecimento e o formato de citação. Pronto em 2 minutos.' },
  { n: '02', title: 'A IA guia cada seção', desc: 'O editor abre com a primeira seção e instruções detalhadas. Peça à IA para gerar um rascunho ou escreva você mesmo.' },
  { n: '03', title: 'Valide, edite e exporte', desc: 'Valide cada seção com IA, aplique sugestões e exporte em DOCX formatado em ABNT ou slides para apresentação.' },
]

const PLANOS = [
  {
    nome: 'Gratuito',
    preco: 'R$ 0',
    periodo: 'para sempre',
    desc: 'Escreva e gere todas as seções livremente, sem pagar nada.',
    cor: 'border-border',
    destaque: false,
    cta: 'Começar grátis',
    href: '/cadastro',
    itens: [
      'Geração de todas as seções com IA',
      'Validação automática com score',
      'Visualizador formatado',
      'Chat científico integrado',
      'Referências manuais e automáticas',
    ],
    nao: ['Exportação DOCX formatado ABNT', 'Exportação PPTX para defesa'],
  },
  {
    nome: 'Por trabalho',
    preco: 'R$ 197',
    periodo: 'por trabalho',
    desc: 'Pague uma única vez e exporte o trabalho completo. Sem assinatura.',
    cor: 'border-primary',
    destaque: true,
    cta: 'Criar trabalho agora',
    href: '/cadastro',
    itens: [
      'Tudo do plano gratuito incluso',
      'DOCX com formatação ABNT completa',
      'Exportação PPTX para apresentação',
      'Acesso permanente ao documento',
      'Suporte via WhatsApp',
    ],
    nao: [],
  },
  {
    nome: 'Institucional',
    preco: 'Sob consulta',
    periodo: '',
    desc: 'Para faculdades, universidades e grupos de pesquisa.',
    cor: 'border-border',
    destaque: false,
    cta: 'Falar com equipe',
    href: 'mailto:contato@cientifica.ai',
    itens: [
      'Assinatura mensal ilimitada',
      'Múltiplos usuários',
      'Painel do orientador',
      'Relatórios de progresso',
      'Integração com sistemas EAD',
      'SLA e suporte dedicado',
    ],
    nao: [],
  },
]

const FAQ = [
  {
    q: 'A IA escreve o trabalho inteiro por mim?',
    a: 'A IA gera rascunhos estruturados para cada seção, mas você é quem revisa, edita e aprova. O objetivo é acelerar o processo, não substituir o pesquisador. Os dados reais (resultados, coleta, etc.) precisam ser inseridos por você.',
  },
  {
    q: 'A formatação ABNT está realmente correta?',
    a: 'O DOCX exportado segue as normas NBR 14724:2011 (trabalhos acadêmicos) e NBR 6023:2018 (referências), com margens, fonte Times New Roman 12pt, espaçamento 1,5 e recuos corretos. Recomendamos uma revisão final.',
  },
  {
    q: 'Posso usar no celular?',
    a: 'Sim, a plataforma é responsiva. O editor completo funciona melhor no desktop, mas você pode navegar, visualizar e usar o chat no celular sem problemas.',
  },
  {
    q: 'Quais tipos de trabalho são suportados?',
    a: 'TCC, Artigo Original, Artigo de Revisão, Relato de Caso, Monografia, Dissertação de Mestrado, Tese de Doutorado, Revisão Sistemática, Projeto de Pesquisa e Relatório de IC — 10 tipos com fluxos específicos para cada um.',
  },
  {
    q: 'Os dados dos meus trabalhos ficam seguros?',
    a: 'Sim. Os dados são armazenados no Supabase (PostgreSQL) com Row Level Security — nenhum outro usuário acessa seus trabalhos. O conteúdo não é usado para treinar modelos de IA.',
  },
]

// ── Componentes internos ──────────────────────────────────────

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200">
      {children}
    </span>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-gray-900">Científica AI</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">Do tema à defesa</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#precos" className="hover:text-foreground transition-colors">Preços</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:flex')}>
              Entrar
            </Link>
            <Link href="/cadastro" className={cn(buttonVariants(), 'gap-1.5')}>
              Criar conta grátis <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <Badge>
          <Sparkles className="h-3.5 w-3.5" />
          Powered by DeepSeek AI · Normas ABNT 2024
        </Badge>

        <h1 className="mt-6 text-5xl sm:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
          Do tema à defesa,<br />
          <span className="text-primary">com inteligência artificial</span>
        </h1>

        <p className="mt-5 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Escreva TCCs, artigos, dissertações e teses em etapas guiadas.
          A IA gera, valida e formata seguindo rigorosamente as normas ABNT, Vancouver e APA.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'text-base px-8 gap-2')}>
            Começar agora — é grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'text-base px-8')}>
            Já tenho conta
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Sem cartão de crédito · Escreva grátis · Pague R$ 197 só para exportar
        </p>

        {/* Tipos suportados */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {TIPOS.map(({ icon: Icon, label, color, bg }) => (
            <div key={label} className="flex items-center gap-2.5 bg-gray-50 border rounded-xl px-4 py-3 text-left">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', bg)}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <span className="text-xs font-medium text-gray-700 leading-tight">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">10 tipos de trabalho científico suportados</p>
      </section>

      {/* ── Como funciona ──────────────────────────────────── */}
      <section id="como-funciona" className="border-y bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Como funciona</p>
            <h2 className="text-3xl font-bold text-gray-900">Simples. Guiado. Acadêmico.</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* Linha conectora */}
            <div className="hidden sm:block absolute top-8 left-[calc(100%/6)] right-[calc(100%/6)] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="relative text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand text-white font-bold text-xl mx-auto shadow-lg">
                  {n}
                </div>
                <h3 className="font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recursos ───────────────────────────────────────── */}
      <section id="recursos" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Recursos</p>
            <h2 className="text-3xl font-bold text-gray-900">Tudo que você precisa para publicar</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Do rascunho inicial à exportação final em Word com formatação ABNT.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border rounded-2xl p-6 hover:shadow-md transition-shadow space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-brand">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Lista de detalhes */}
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              'Normas ABNT NBR 14724:2011 e NBR 6023:2018',
              'Citações em Vancouver e APA 7ª edição',
              'Diagrama PRISMA 2020 automático',
              'Módulo de Comitê de Ética (CEP)',
              'Exportação DOCX com margens ABNT',
              'Slides PowerPoint para defesa',
              'Resumo e palavras-chave automáticos',
              'Chat científico contextual por seção',
              'Validação com score e sugestões',
            ].map(item => (
              <div key={item} className="flex items-center gap-2.5 bg-gray-50 border rounded-lg px-4 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prova social ───────────────────────────────────── */}
      <section className="border-y gradient-brand-soft py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {[
              { valor: '10', label: 'tipos de trabalho científico', icon: FileText },
              { valor: 'ABNT + Vancouver + APA', label: 'formatos de citação suportados', icon: BookMarked },
              { valor: '100%', label: 'dos dados ficam seguros e privados', icon: Shield },
            ].map(({ valor, label, icon: Icon }) => (
              <div key={label} className="space-y-2">
                <Icon className="h-6 w-6 text-primary mx-auto" />
                <p className="text-3xl font-bold text-gray-900">{valor}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preços ─────────────────────────────────────────── */}
      <section id="precos" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Preços</p>
            <h2 className="text-3xl font-bold text-gray-900">Sem assinatura. Pague só para exportar.</h2>
            <p className="mt-3 text-muted-foreground">Use tudo de graça. Pague R$ 197 uma única vez quando quiser baixar o trabalho.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANOS.map(plano => (
              <div key={plano.nome} className={cn(
                'relative bg-white border-2 rounded-2xl p-6 flex flex-col',
                plano.destaque && 'border-primary shadow-xl shadow-primary/10 scale-[1.02]',
                !plano.destaque && 'border-border'
              )}>
                {plano.destaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" /> Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">{plano.nome}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">{plano.preco}</span>
                    {plano.periodo && <span className="text-sm text-muted-foreground">{plano.periodo}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">{plano.desc}</p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plano.itens.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                  {plano.nao.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground line-through">
                      <span className="h-4 w-4 shrink-0 mt-0.5 flex items-center justify-center text-gray-300">–</span>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plano.href}
                  className={cn(
                    buttonVariants({ variant: plano.destaque ? 'default' : 'outline' }),
                    'w-full justify-center gap-2'
                  )}
                >
                  {plano.destaque && <Sparkles className="h-4 w-4" />}
                  {plano.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section id="faq" className="border-t bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">FAQ</p>
            <h2 className="text-3xl font-bold text-gray-900">Perguntas frequentes</h2>
          </div>

          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group bg-white border rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-medium text-gray-900 text-sm">
                  {q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0 ml-4" />
                </summary>
                <div className="px-5 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────── */}
      <section className="gradient-brand py-20">
        <div className="mx-auto max-w-4xl px-6 text-center text-white">
          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Pronto para escrever seu próximo trabalho?
          </h2>
          <p className="text-teal-100 text-lg mb-8 max-w-xl mx-auto">
            Crie sua conta gratuita agora e comece o seu TCC, artigo ou dissertação em minutos. Sem assinatura.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/cadastro"
              className="inline-flex items-center justify-center gap-2 bg-white text-primary font-semibold text-base px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors">
              Criar conta gratuita <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold text-base px-8 py-3 rounded-lg hover:bg-white/10 transition-colors">
              Já tenho conta
            </Link>
          </div>
          <p className="mt-5 text-xs text-teal-200">
            Sem cartão de crédito · Escreva grátis · Pague só para exportar
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid sm:grid-cols-4 gap-8 mb-10">
            <div className="sm:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-gray-900">Científica AI</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                A plataforma de escrita científica com IA mais completa do Brasil.
                Do tema à defesa, com inteligência.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Produto</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#como-funciona" className="hover:text-foreground">Como funciona</a></li>
                <li><a href="#recursos" className="hover:text-foreground">Recursos</a></li>
                <li><a href="#precos" className="hover:text-foreground">Preços</a></li>
                <li><Link href="/cadastro" className="hover:text-foreground">Criar conta</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Suporte</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
                <li><a href="mailto:suporte@cientifica.ai" className="hover:text-foreground">Contato</a></li>
                <li><a href="#" className="hover:text-foreground">Termos de uso</a></li>
                <li><a href="#" className="hover:text-foreground">Privacidade</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Científica AI · Todos os direitos reservados</p>
            <p className="flex items-center gap-1">
              Feito com <span className="text-red-500">♥</span> para pesquisadores brasileiros
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
