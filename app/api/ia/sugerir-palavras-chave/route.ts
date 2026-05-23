import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSugerirPalavrasChavePrompt } from '@/lib/ai/prompts'
import { getTransversalPrompt } from '@/lib/ai/prompts-secoes'
import { callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'sugerir-palavras-chave')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { texto, area } = await request.json() as { texto: string; area: string }
  if (!texto?.trim()) return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })

  const prompt = buildSugerirPalavrasChavePrompt(texto, area)
  const palavrasChaveSystem = getTransversalPrompt('T7')
    ?? 'Você é um especialista em indexação científica e descritores bibliográficos. Responda apenas com JSON válido.'
  const resposta = await callAI(palavrasChaveSystem, prompt, true)

  try {
    const json = JSON.parse(resposta.trim()) as { palavras: string[] }
    return NextResponse.json(json)
  } catch (err) {
    console.error('[sugerir-palavras-chave] Erro:', err)
    const match = resposta.match(/"palavras"\s*:\s*\[([^\]]+)\]/)
    if (match) {
      const palavras = match[1].split(',').map(p => p.trim().replace(/^"|"$/g, '')).filter(Boolean)
      return NextResponse.json({ palavras })
    }
    return NextResponse.json({ palavras: [] })
  }
}
