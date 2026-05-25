'use client'

import { useState } from 'react'
import { CheckCircle2, Copy, MessageCircle, Lock, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

// Atualize com sua chave PIX
const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY ?? 'sandrodainez1@gmail.com'
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP ?? '5511999999999'
const PRECO = 'R$ 197'

interface PaywallProps {
  trabalhoId: string
  tituloTrabalho?: string
}

export function Paywall({ trabalhoId, tituloTrabalho }: PaywallProps) {
  const [copiado, setCopiado] = useState(false)
  const [jaPaguei, setJaPaguei] = useState(false)

  function copiarPix() {
    navigator.clipboard.writeText(PIX_KEY)
    setCopiado(true)
    toast.success('Chave PIX copiada!')
    setTimeout(() => setCopiado(false), 3000)
  }

  const whatsappMsg = encodeURIComponent(
    `Olá! Acabei de realizar o pagamento do trabalho "${tituloTrabalho ?? 'sem título'}" na plataforma Científica AI. ID do trabalho: ${trabalhoId}. Segue o comprovante.`
  )

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">

        {/* Ícone + título */}
        <div className="text-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand glow-teal mx-auto">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Trabalho pronto!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Seu trabalho foi gerado com sucesso. Para exportar o documento final em PDF ou Word,
            realize o pagamento abaixo.
          </p>
        </div>

        {/* Card preço — glass tem fundo sempre escuro, texto sempre branco */}
        <div className="glass rounded-2xl p-6 text-center glow-teal space-y-1">
          <p className="text-xs text-white/60 uppercase tracking-widest">Valor único</p>
          <p className="text-4xl font-bold text-white">{PRECO}</p>
          <p className="text-xs text-white/60">Acesso completo a este trabalho · Download ilimitado</p>
        </div>

        {/* Passo a passo */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">Como pagar:</p>

          {/* Passo 1 */}
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-brand text-white text-xs font-bold">1</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-foreground">Copie a chave PIX</p>
              <button
                onClick={copiarPix}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted border text-sm font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span className="truncate">{PIX_KEY}</span>
                {copiado
                  ? <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  : <Copy className="h-4 w-4 shrink-0" />
                }
              </button>
            </div>
          </div>

          {/* Passo 2 */}
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-brand text-white text-xs font-bold">2</span>
            <p className="text-sm text-foreground pt-0.5">
              Realize o pagamento de <strong className="text-primary">{PRECO}</strong> via PIX no seu banco
            </p>
          </div>

          {/* Passo 3 */}
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-brand text-white text-xs font-bold">3</span>
            <p className="text-sm text-foreground pt-0.5">
              Envie o comprovante pelo WhatsApp — liberei o download em até 15 minutos
            </p>
          </div>
        </div>

        {/* Botões */}
        <div className="space-y-3">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants(), 'w-full gap-2 justify-center')}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar comprovante pelo WhatsApp
          </a>

          {!jaPaguei ? (
            <button
              onClick={() => setJaPaguei(true)}
              className={cn(buttonVariants({ variant: 'ghost' }), 'w-full text-muted-foreground')}
            >
              Já realizei o pagamento
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-teal-900/30 border border-teal-800/50">
              <CheckCircle2 className="h-4 w-4 text-teal-400" />
              <p className="text-sm text-teal-300">
                Aguardando confirmação — você receberá acesso em breve.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Dúvidas? Fale conosco pelo WhatsApp · Resposta em até 15 min nos dias úteis
        </p>
      </div>
    </div>
  )
}
