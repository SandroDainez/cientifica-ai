import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho } from '@/types'

export interface InconsistenciaEncontrada {
  tipo: 'critico' | 'atencao'
  secoes_envolvidas: string[]
  descricao: string
  sugestao: string
}

export interface RelatorioCoerencia {
  consistente: boolean
  inconsistencias: InconsistenciaEncontrada[]
  resumo: string
  verificado_em: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'relatorio-qualidade')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId } = await request.json() as { trabalhoId: string }

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const { data: secoes } = await supabase
    .from('secoes_trabalho').select('*').eq('trabalho_id', trabalhoId).order('ordem')

  if (!secoes || secoes.length < 2) {
    return NextResponse.json({
      relatorio: {
        consistente: true,
        inconsistencias: [],
        resumo: 'Seções insuficientes para verificar coerência.',
        verificado_em: new Date().toISOString(),
      } as RelatorioCoerencia
    })
  }

  // Monta resumo de cada seção para o prompt
  const resumoSecoes = secoes
    .filter(s => s.conteudo?.trim())
    .map(s => {
      const texto = extrairTextoSecao(s.conteudo ?? '')
      return `## ${s.nome_secao} (${s.chave_secao})\n${texto.slice(0, 800)}`
    })
    .join('\n\n')

  const system = `Você é um revisor científico especialista em coerência interna de trabalhos acadêmicos.
Sua tarefa é identificar INCONSISTÊNCIAS REAIS entre seções — não fazer críticas de estilo ou conteúdo.

Inconsistências a detectar:
- Número de participantes/amostras diferente entre Métodos, Resultados e Conclusão
- Objetivos específicos não respondidos na Conclusão
- Delineamento descrito nos Métodos incompatível com os Resultados apresentados
- Variáveis mencionadas nos Métodos que não aparecem nos Resultados
- Afirmações na Conclusão sem base nos Resultados
- Período de coleta nos Métodos incompatível com datas nos Resultados
- Hipótese levantada na Introdução não discutida na Discussão

Responda APENAS com JSON válido no formato:
{
  "consistente": boolean,
  "inconsistencias": [
    {
      "tipo": "critico" | "atencao",
      "secoes_envolvidas": ["nome_secao_1", "nome_secao_2"],
      "descricao": "descrição objetiva da inconsistência encontrada",
      "sugestao": "como corrigir em uma frase"
    }
  ],
  "resumo": "frase resumindo o estado geral de coerência"
}`

  const userPrompt = `Trabalho: ${trabalho.tipo_trabalho}
Título: ${trabalho.titulo ?? 'Sem título'}

SEÇÕES DO TRABALHO:
${resumoSecoes}

Identifique inconsistências entre as seções.`

  let relatorio: RelatorioCoerencia = {
    consistente: true,
    inconsistencias: [],
    resumo: 'Não foi possível verificar automaticamente.',
    verificado_em: new Date().toISOString(),
  }

  try {
    const raw = await callAI(system, userPrompt, false, 2000)
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      relatorio = {
        consistente: Boolean(parsed.consistente),
        inconsistencias: Array.isArray(parsed.inconsistencias) ? parsed.inconsistencias : [],
        resumo: parsed.resumo ?? '',
        verificado_em: new Date().toISOString(),
      }
    }
  } catch (err) {
    console.error('[verificar-coerencia]', err)
  }

  return NextResponse.json({ relatorio })
}
