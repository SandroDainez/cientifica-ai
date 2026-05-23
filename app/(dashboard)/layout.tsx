import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, email, is_admin')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userName={profile?.nome ?? user.email?.split('@')[0]}
        userEmail={profile?.email ?? user.email}
        isAdmin={profile?.is_admin === true}
      />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  )
}
