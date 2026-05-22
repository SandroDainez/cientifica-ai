'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showSenha, setShowSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.senha,
    })
    if (error) {
      setErro(
        error.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : error.message.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar.'
          : 'Erro ao entrar. Tente novamente.'
      )
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function loginGoogle() {
    setLoadingGoogle(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Entrar na sua conta</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Não tem conta?{' '}
          <Link href="/cadastro" className="text-primary font-medium hover:underline">
            Cadastre-se grátis
          </Link>
        </p>
      </div>

      {/* Google */}
      <button
        onClick={loginGoogle}
        disabled={loadingGoogle}
        className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {loadingGoogle ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continuar com Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-muted-foreground">ou entre com e-mail</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="senha">Senha</Label>
            <Link href="/recuperar-senha" className="text-xs text-primary hover:underline">
              Esqueci a senha
            </Link>
          </div>
          <div className="relative">
            <Input
              id="senha"
              type={showSenha ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
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

        {erro && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {erro}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Entrar
        </Button>
      </form>
    </div>
  )
}
