'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})
type FormData = z.infer<typeof schema>

export default function RecuperarSenhaPage() {
  const supabase = createClient()
  const [enviado, setEnviado] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <MailCheck className="h-16 w-16 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-white">E-mail enviado!</h2>
        <p className="text-sm text-slate-400">
          Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
        </p>
        <Link href="/login" className="text-primary text-sm font-medium hover:underline flex items-center justify-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Recuperar senha</h2>
        <p className="text-sm text-slate-400 mt-1">
          Informe seu e-mail e enviaremos um link de recuperação.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-200">E-mail cadastrado</label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-primary"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Enviar link de recuperação
        </Button>
      </form>

      <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
      </Link>
    </div>
  )
}
