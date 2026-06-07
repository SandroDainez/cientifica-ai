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

  const { texto, area, idioma } = await request.json() as { texto: string; area: string; idioma?: 'pt' | 'en' }
  if (!texto?.trim()) return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })

  const prompt = buildSugerirPalavrasChavePrompt(texto, area, idioma ?? 'pt')
  // Em inglês, NÃO usar o prompt transversal T7 (em português) — usar um system
  // prompt que força descritores MeSH em inglês.
  const palavrasChaveSystem = idioma === 'en'
    ? 'You are an expert in scientific indexing and bibliographic descriptors. Suggest English MeSH keywords ONLY. Respond only with valid JSON. Never use Portuguese.'
    : (getTransversalPrompt('T7')
      ?? 'Você é um especialista em indexação científica e descritores bibliográficos. Responda apenas com JSON válido.')
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
