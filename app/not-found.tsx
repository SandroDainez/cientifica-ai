import Link from 'next/link'
import { GraduationCap, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl gradient-brand flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-3">Página não encontrada</h2>
        <p className="text-gray-500 mb-8">
          Esta página não existe ou foi removida. Volte ao dashboard e continue seu trabalho.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Ir para o Dashboard
        </Link>
      </div>
    </div>
  )
}
