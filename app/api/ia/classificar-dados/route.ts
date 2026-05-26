import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/stream'
import type { Trabalho } from '@/types'

// ── Mapeamento campo → rótulo humano ─────────────────────────────────────────
export const CAMPOS_LABEL: Record<string, { label: string; descricao: string }> = {
  notas_contexto:     { label: 'Contexto / Justificativa', descricao: 'Alimenta Introdução e Justificativa' },
  notas_metodologia:  { label: 'Notas de Metodologia',    descricao: 'Alimenta Metodologia e Métodos' },
  dados_coletados:    { label: 'Dados Coletados',         descricao: 'Alimenta Resultados' },
  notas_interpretacao:{ label: 'Interpretação / Discussão', descricao: 'Alimenta Discussão e Conclusão' },
  n_participantes:    { label: 'N.º de Participantes',    descricao: 'Campo de Metodologia' },
  software_analise:   { label: 'Software de Análise',     descricao: 'Campo de Metodologia' },
  taxa_resposta:      { label: 'Taxa de Resposta',        descricao: 'Campo de Resultados' },
}

export interface ClassificacaoDado {
  tipo_dado: string
  campo: string
  secoes_alvo: string[]
  secoes_nomes: string[]
  relevancia: 'alta' | 'media' | 'baixa'
  razao: string
  trecho_resumido: string
}

export interface ResultadoClassificacao {
  classificacoes: ClassificacaoDado[]
  resumo_tipo: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId, texto } = await request.json() as {
    trabalhoId: string
    texto: string
  }

  if (!texto?.trim() || texto.trim().length < 10) {
    return NextResponse.json({ error: 'Texto muito curto para análise' }, { status: 400 })
  }

  // Carrega trabalho e valida ownership
  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  // Carrega seções para contexto
  const { data: secoesData } = await supabase
    .from('secoes_trabalho')
    .select('nome_secao, chave_secao, ordem')
    .eq('trabalho_id', trabalhoId)
    .order('ordem')

  const secoesExistentes = (secoesData ?? [])
    .map(s => `${s.chave_secao}: ${s.nome_secao}`)
    .join('\n')

  const systemPrompt = `Você é um especialista em pesquisa científica. Analisa dados inseridos por pesquisadores e identifica em qual campo do sistema eles devem ser armazenados, para depois alimentar a geração de texto das seções do trabalho.

CAMPOS DISPONÍVEIS (campo → onde é usado):
- notas_contexto: Introdução, Justificativa (contexto, dados epidemiológicos, dados de outros estudos, motivação da pesquisa)
- notas_metodologia: Metodologia, Métodos (como a coleta foi feita, instrumentos usados, protocolo, critérios)
- dados_coletados: Resultados (dados do próprio pesquisador: frequências, percentuais, médias, testes estatísticos)
- notas_interpretacao: Discussão, Conclusão (interpretação dos achados, comparação com literatura, limitações)
- n_participantes: Metodologia — apenas quando informar o número exato de participantes/casos
- software_analise: Metodologia — apenas quando informar o software utilizado para análise
- taxa_resposta: Resultados — apenas quando informar taxa de resposta ou adesão

Retorne SOMENTE JSON válido:
{
  "classificacoes": [
    {
      "tipo_dado": "estatistica_resultado|dado_metodologico|contexto_justificativa|achado_interpretacao|dado_participantes|referencia_bibliografica",
      "campo": "<nome_do_campo>",
      "secoes_alvo": ["<chave_secao1>"],
      "secoes_nomes": ["<nome legível da seção>"],
      "relevancia": "alta|media|baixa",
      "razao": "<1-2 frases explicando por que este dado vai para este campo>",
      "trecho_resumido": "<trecho representativo com máx. 80 chars>"
    }
  ],
  "resumo_tipo": "<1 frase descrevendo o tipo geral do dado>"
}`

  const userPrompt = `TRABALHO: "${trabalho.titulo ?? 'Sem título'}"
TIPO: ${trabalho.tipo_trabalho} | ÁREA: ${trabalho.area_conhecimento ?? 'não informada'}

SEÇÕES DO TRABALHO:
${secoesExistentes || 'Nenhuma seção cadastrada ainda'}

TEXTO/DADOS INSERIDOS PELO PESQUISADOR:
"""
${texto.trim().substring(0, 3000)}
"""

Se o texto contém múltiplos tipos de dados, retorne até 3 classificações (as mais relevantes). Priorize relevância "alta".`

  const resposta = await callAI(systemPrompt, userPrompt, true, 1024)

  try {
    const jsonMatch = resposta.match(/\{[\s\S]+\}/)
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta')
    const resultado = JSON.parse(jsonMatch[0]) as ResultadoClassificacao
    return NextResponse.json(resultado)
  } catch {
    console.error('[classificar-dados] Falha ao parsear resposta:', resposta.substring(0, 300))
    return NextResponse.json({ error: 'Erro ao classificar os dados. Tente novamente.' }, { status: 500 })
  }
}
