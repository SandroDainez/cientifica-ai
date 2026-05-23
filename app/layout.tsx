import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Científica AI — Do tema à defesa, com inteligência',
  description: 'Plataforma de geração de trabalhos científicos com inteligência artificial. TCC, artigos, dissertações, teses e muito mais.',
  keywords: ['TCC', 'trabalho científico', 'inteligência artificial', 'artigo científico', 'dissertação', 'tese', 'ABNT'],
  openGraph: {
    title: 'Científica AI',
    description: 'Do tema à defesa, com inteligência',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {/* Ambient light blobs — visíveis só no modo escuro */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden" style={{ zIndex: 0 }}>
            <div className="ambient-blob-1 absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-teal-500/10 blur-3xl" />
            <div className="ambient-blob-2 absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-teal-400/8 blur-3xl" />
            <div className="ambient-blob-3 absolute -bottom-32 left-1/3 w-80 h-80 rounded-full bg-teal-600/6 blur-3xl" />
          </div>

          <div className="relative flex flex-col min-h-full" style={{ zIndex: 1 }}>
            {children}
          </div>
        </ThemeProvider>

        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
