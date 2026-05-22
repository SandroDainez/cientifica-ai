import Link from 'next/link'
import { GraduationCap, FileText, BookOpen, FlaskConical, Award, ArrowRight, CheckCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const features = [
  { icon: FileText,     title: 'TCC e Monografia',    desc: 'Do tema à defesa em etapas guiadas' },
  { icon: BookOpen,     title: 'Artigos Científicos',  desc: 'Originais, revisões e relatos de caso' },
  { icon: FlaskConical, title: 'Revisão Sistemática',  desc: 'Com PRISMA, GRADE e meta-análise' },
  { icon: Award,        title: 'Mestrado e Doutorado', desc: 'Dissertações e teses com rigor máximo' },
]

const steps = [
  { n: '1', title: 'Escolha o tipo',     desc: 'TCC, artigo, dissertação, tese e mais 6 tipos' },
  { n: '2', title: 'Responda as etapas', desc: 'A IA guia você seção por seção, com dicas e exemplos' },
  { n: '3', title: 'Exporte e defenda',  desc: 'DOCX formatado em ABNT, Vancouver ou APA + slides' },
]

const benefits = [
  'Normas ABNT NBR 14724:2011 e NBR 6023:2018',
  'Referências reais via PubMed, CrossRef e OpenAlex',
  'Módulo de Comitê de Ética (CEP / Plataforma Brasil)',
  'Diagrama PRISMA 2020 automático',
  'Exportação Word + slides de apresentação',
  'Resumo estruturado e abstract em inglês',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Científica AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>Entrar</Link>
            <Link href="/cadastro" className={buttonVariants()}>Criar conta grátis</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-blue-200">
          <FlaskConical className="h-3.5 w-3.5" />
          Powered by DeepSeek AI
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Escreva trabalhos científicos<br />
          <span className="text-primary">de qualidade com IA</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Do tema à defesa, com inteligência. Crie TCCs, artigos, dissertações e teses
          seguindo rigorosamente as normas ABNT, Vancouver e APA.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'text-base px-8 gap-2')}>
            Começar agora — grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'text-base px-8')}>
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="gradient-brand-soft border-y py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Para todos os tipos de trabalho científico
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-brand mb-4">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Como funciona</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {steps.map(({ n, title, desc }) => (
            <div key={n} className="text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-brand text-white font-bold text-lg mx-auto mb-4">
                {n}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="gradient-brand-soft border-y py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Tudo que você precisa para publicar
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {benefits.map(b => (
              <div key={b} className="flex items-start gap-3 bg-white rounded-lg p-4 border">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Pronto para começar seu trabalho?
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          Crie sua conta gratuita e comece agora mesmo.
        </p>
        <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'text-base px-10 gap-2')}>
          Criar conta gratuita <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2025 Científica AI · Do tema à defesa, com inteligência
      </footer>
    </div>
  )
}
