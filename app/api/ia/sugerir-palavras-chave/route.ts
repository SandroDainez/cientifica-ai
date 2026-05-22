import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSugerirPalavrasChavePrompt } from '@/lib/ai/prompts'
import { getTransversalPrompt } from '@/lib/ai/prompts-secoes'
import { callAI } from '@/lib/ai/stream'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { texto, area } = await request.json() as { texto: string; area: string }
  if (!texto?.trim()) return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })

  const prompt = buildSugerirPalavrasChavePrompt(texto, area)
  const palavrasChaveSystem = getTransversalPrompt('T7')
    ?? 'Você é um especialista em indexação científica e descritores bibliográficos. Responda apenas com JSON válido.'
  const resposta = await callAI(palavrasChaveSystem, prompt, true)

  try {
    const json = JSON.parse(resposta.trim()) as { palavras: string[] }
    return NextResponse.json(json)
  } catch {
    const match = resposta.match(/"palavras"\s*:\s*\[([^\]]+)\]/)
    if (match) {
      const palavras = match[1].split(',').map(p => p.trim().replace(/^"|"$/g, '')).filter(Boolean)
      return NextResponse.json({ palavras })
    }
    return NextResponse.json({ palavras: [] })
  }
}
