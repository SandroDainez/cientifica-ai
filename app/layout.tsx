import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
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
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
