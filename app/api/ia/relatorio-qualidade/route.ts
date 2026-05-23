import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTransversalPrompt } from '@/lib/ai/prompts-secoes'
import { callAI } from '@/lib/ai/stream'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho } from '@/types'

export interface RelatorioQualidade {
  score_geral: number
  secoes: {
    nome: string
    chave: string
    score: number
    status: 'aprovado' | 'atencao' | 'critico'
    observacao: string
  }[]
  pontos_fortes: string[]
  pontos_melhoria: string[]
  pontos_criticos: string[]
  coerencia_objetivos_conclusao: boolean
  referencias_suficientes: boolean
  recomendacao_export: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'relatorio-qualidade')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
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

  const { data: refs } = await supabase
    .from('referencias').select('id').eq('trabalho_id', trabalhoId)

  const secoesInfo = secoes?.map(s => ({
    nome: s.nome_secao,
    chave: s.chave_secao ?? s.nome_secao,
    status: s.status,
    palavras: s.conteudo ? extrairTextoSecao(s.conteudo).trim().split(/\s+/).length : 0,
    primeiras_palavras: extrairTextoSecao(s.conteudo ?? '').substring(0, 300),
  })) ?? []

  const prompt = `Analise o seguinte trabalho científico (${trabalho.tipo_trabalho}) e gere um relatório de qualidade.

**Título:** ${trabalho.titulo ?? 'Sem título'}
**Tipo:** ${trabalho.tipo_trabalho}
**Referências cadastradas:** ${refs?.length ?? 0}

**Seções:**
${secoesInfo.map(s => `
- ${s.nome} [${s.chave}]: ${s.status} | ${s.palavras} palavras
  Trecho: "${s.primeiras_palavras}..."
`).join('')}

Gere um relatório de qualidade completo. Responda APENAS com JSON válido:
{
  "score_geral": number (0-100),
  "secoes": [
    {
      "nome": "string",
      "chave": "string",
      "score": number (0-100),
      "status": "aprovado" | "atencao" | "critico",
      "observacao": "string curta (1-2 frases)"
    }
  ],
  "pontos_fortes": ["string", ...],
  "pontos_melhoria": ["string", ...],
  "pontos_criticos": ["string", ...],
  "coerencia_objetivos_conclusao": boolean,
  "referencias_suficientes": boolean,
  "recomendacao_export": boolean
}

Para score_geral: pondere completude (40%), qualidade das seções (40%), coerência do trabalho (20%).
Seja objetivo e construtivo. Identifique problemas reais com base nos trechos fornecidos.`

  try {
    const validadorSystem = getTransversalPrompt('T2')
      ?? 'Você é um especialista em avaliação de trabalhos científicos. Responda apenas com JSON válido.'
    const resposta = await callAI(validadorSystem, prompt, true)

    const jsonStr = resposta.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const relatorio = JSON.parse(jsonStr) as RelatorioQualidade
    return NextResponse.json(relatorio)
  } catch (err) {
    console.error('[relatorio-qualidade] Erro:', err)
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 })
  }
}
