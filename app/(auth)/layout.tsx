import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GraduationCap } from 'lucide-react'
import type { ReactNode } from 'react'

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen gradient-brand-soft flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-brand shadow-lg">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Científica AI</h1>
          <p className="text-xs text-muted-foreground">Do tema à defesa, com inteligência</p>
        </div>
      </div>

      {/* Card central */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-border/50 p-8 animate-slide-up">
        {children}
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        © 2025 Científica AI · Todos os direitos reservados
      </p>
    </div>
  )
}
