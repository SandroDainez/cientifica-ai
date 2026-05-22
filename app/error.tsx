'use client'

import { useEffect } from 'react'
import { GraduationCap, RefreshCw } from 'lucide-react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Algo deu errado</h1>
        <p className="text-gray-500 mb-2">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">Código: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    </div>
  )
}
