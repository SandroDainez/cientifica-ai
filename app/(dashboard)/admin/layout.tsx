import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LayoutDashboard, Users, FolderOpen, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

const ADMIN_EMAIL = 'sandrodainez1@gmail.com'

const adminNav = [
  { href: '/admin',          label: 'Métricas',   icon: LayoutDashboard },
  { href: '/admin/usuarios', label: 'Usuários',   icon: Users },
  { href: '/admin/trabalhos',label: 'Trabalhos',  icon: FolderOpen },
]

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) redirect('/dashboard')

  return (
    <div className="flex min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Sidebar admin */}
      <aside className="w-56 shrink-0 hidden lg:flex flex-col border-r bg-sidebar h-[calc(100vh-4rem)] sticky top-16">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {adminNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Voltar ao app
          </Link>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 overflow-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}
