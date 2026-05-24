import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildSystemPrompt, buildValidarSecaoPrompt } from '@/lib/ai/prompts'
import { getTransversalPrompt } from '@/lib/ai/prompts-secoes'
import { callAI } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, ResultadoValidacao } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'validar-secao')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId, chaveSecao, conteudo } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    conteudo: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  if (!fase) return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 })

  const systemPrompt = getTransversalPrompt('T6') ?? buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  const userPrompt = buildValidarSecaoPrompt(fase, conteudo, trabalho.formato_citacao)

  try {
    // Usa modelo smart com tokens suficientes para textos longos (evita JSON truncado)
    const raw = await callAI(systemPrompt, userPrompt, false, 6000)

    // Extrai o JSON da resposta — tenta greedy primeiro, depois lazy
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Resposta da IA sem JSON:', raw.slice(0, 300))
      throw new Error('Resposta inválida da IA')
    }

    let resultado: ResultadoValidacao
    try {
      resultado = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      // JSON pode estar truncado — tenta extrair campos mínimos com regex
      console.error('JSON truncado, tentando recuperar:', parseErr)
      const scoreMatch  = raw.match(/"score"\s*:\s*(\d+)/)
      const aprovadoMatch = raw.match(/"aprovado"\s*:\s*(true|false)/)
      const comentariosMatch = raw.match(/"comentarios"\s*:\s*"([^"]*)"/)

      if (!scoreMatch) throw new Error('Resposta inválida da IA — não foi possível extrair score')

      resultado = {
        aprovado: aprovadoMatch ? aprovadoMatch[1] === 'true' : Number(scoreMatch[1]) >= 70,
        score: Number(scoreMatch[1]),
        comentarios: comentariosMatch?.[1] ?? 'Avaliação parcial — texto muito extenso.',
        sugestoes: [],
      }
    }

    // Salva sugestões na seção
    await supabase
      .from('secoes_trabalho')
      .update({
        sugestoes_ia: resultado.sugestoes,
        status: resultado.aprovado ? 'aprovado' : 'gerado',
      })
      .eq('trabalho_id', trabalhoId)
      .eq('chave_secao', chaveSecao)

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('Erro na validação:', err)
    return NextResponse.json({ error: 'Erro ao validar seção' }, { status: 500 })
  }
}
