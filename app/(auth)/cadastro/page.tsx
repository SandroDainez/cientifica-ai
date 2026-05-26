'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const AREAS = [
  'Ciências Exatas e da Terra',
  'Ciências Biológicas',
  'Engenharias',
  'Ciências da Saúde',
  'Ciências Agrárias',
  'Ciências Sociais Aplicadas',
  'Ciências Humanas',
  'Linguística, Letras e Artes',
  'Multidisciplinar',
]

const NIVEIS = [
  { value: 'graduacao',      label: 'Graduando(a)' },
  { value: 'especializacao', label: 'Especialização / MBA' },
  { value: 'mestrado',       label: 'Mestrando(a)' },
  { value: 'doutorado',      label: 'Doutorando(a)' },
  { value: 'professor',      label: 'Professor(a) / Pesquisador(a)' },
]

const schema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmarSenha: z.string(),
  nivelAcademico: z.string().min(1, 'Selecione seu nível acadêmico'),
  areaConhecimento: z.string().min(1, 'Selecione sua área'),
  instituicao: z.string().optional(),
  termos: z.boolean().refine(v => v === true, 'Aceite os termos para continuar'),
}).refine(d => d.senha === d.confirmarSenha, {
  message: 'As senhas não conferem',
  path: ['confirmarSenha'],
})
type FormData = z.infer<typeof schema>

export default function CadastroPage() {
  const supabase = createClient()
  const [showSenha, setShowSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { termos: false },
  })

  async function onSubmit(data: FormData) {
    setErro('')
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.senha,
      options: {
        data: {
          nome: data.nome,
          nivel_academico: data.nivelAcademico,
          area_conhecimento: data.areaConhecimento,
          instituicao: data.instituicao ?? '',
        },
      },
    })

    if (error) {
      setErro(
        error.message.includes('already registered')
          ? 'Este e-mail já está cadastrado. Tente entrar.'
          : 'Erro ao criar conta. Tente novamente.'
      )
      return
    }

    setSucesso(true)
  }

  const selectCls = [
    'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground',
    'focus:outline-none focus:ring-2 focus:ring-primary/50',
  ].join(' ')

  if (sucesso) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Conta criada!</h2>
        <p className="text-muted-foreground text-sm">
          Enviamos um link de confirmação para o seu e-mail.<br />
          Clique no link para ativar sua conta.
        </p>
        <Link href="/login" className="text-primary text-sm font-medium hover:underline block">
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Criar conta gratuita</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Já tem conta?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Nome */}
        <div className="space-y-1.5">
          <label htmlFor="nome" className="text-sm font-medium text-foreground">Nome completo</label>
          <Input id="nome" placeholder="Seu nome completo" {...register('nome')} />
          {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</label>
          <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
          <label htmlFor="senha" className="text-sm font-medium text-foreground">Senha</label>
          <div className="relative">
            <Input
              id="senha"
              type={showSenha ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              {...register('senha')}
            />
            <button
              type="button"
              onClick={() => setShowSenha(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.senha && <p className="text-xs text-destructive">{errors.senha.message}</p>}
        </div>

        {/* Confirmar senha */}
        <div className="space-y-1.5">
          <label htmlFor="confirmarSenha" className="text-sm font-medium text-foreground">Confirmar senha</label>
          <Input
            id="confirmarSenha"
            type="password"
            placeholder="Repita a senha"
            {...register('confirmarSenha')}
          />
          {errors.confirmarSenha && <p className="text-xs text-destructive">{errors.confirmarSenha.message}</p>}
        </div>

        {/* Nível acadêmico */}
        <div className="space-y-1.5">
          <label htmlFor="nivelAcademico" className="text-sm font-medium text-foreground">Nível acadêmico</label>
          <select id="nivelAcademico" {...register('nivelAcademico')} className={selectCls}>
            <option value="">Selecione...</option>
            {NIVEIS.map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
          {errors.nivelAcademico && <p className="text-xs text-destructive">{errors.nivelAcademico.message}</p>}
        </div>

        {/* Área */}
        <div className="space-y-1.5">
          <label htmlFor="areaConhecimento" className="text-sm font-medium text-foreground">Grande área de conhecimento</label>
          <select id="areaConhecimento" {...register('areaConhecimento')} className={selectCls}>
            <option value="">Selecione...</option>
            {AREAS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {errors.areaConhecimento && <p className="text-xs text-destructive">{errors.areaConhecimento.message}</p>}
        </div>

        {/* Instituição */}
        <div className="space-y-1.5">
          <label htmlFor="instituicao" className="text-sm font-medium text-foreground">
            Instituição de ensino <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <Input id="instituicao" placeholder="Ex: USP, UNICAMP, UFMG..." {...register('instituicao')} />
        </div>

        {/* Termos */}
        <div className="flex items-start gap-2">
          <input
            id="termos"
            type="checkbox"
            {...register('termos')}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
          />
          <label htmlFor="termos" className="text-xs text-muted-foreground leading-relaxed">
            Concordo com os{' '}
            <Link href="/termos" className="text-primary hover:underline">Termos de Uso</Link>
            {' '}e a{' '}
            <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
          </label>
        </div>
        {errors.termos && <p className="text-xs text-destructive">{errors.termos.message}</p>}

        {erro && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {erro}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Criar conta
        </Button>
      </form>
    </div>
  )
}
