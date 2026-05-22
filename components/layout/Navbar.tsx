'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GraduationCap, LayoutDashboard, FolderOpen, PlusCircle, User, Settings, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'

const navLinks = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/trabalhos',     label: 'Meus Trabalhos', icon: FolderOpen },
  { href: '/novo-trabalho', label: 'Novo Trabalho',  icon: PlusCircle },
]

interface NavbarProps {
  userName?: string
  userEmail?: string
}

export function Navbar({ userName, userEmail }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/8 bg-[#0b1620]/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-white text-base">Científica AI</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">Do tema à defesa</span>
            </div>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Avatar + mobile toggle */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-8 w-8 items-center justify-center rounded-full gradient-brand text-white text-xs font-bold hover:opacity-90 transition-opacity"
                aria-label="Menu do usuário"
              >
                {initials}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/perfil')} className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" /> Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/configuracoes')} className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 flex items-center gap-2 cursor-pointer">
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded-md text-slate-400 hover:bg-white/10"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="md:hidden border-t py-3 flex flex-col gap-1 animate-fade-in">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </header>
  )
}
