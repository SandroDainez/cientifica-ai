import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { detectarCampo, getRegrasCampoAcademico } from '@/lib/ai/campos-academicos'
import { streamText } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, DadosProjeto } from '@/types'

export const maxDuration = 120

/**
 * Monta uma ou mais TABELAS CIENTÍFICAS reais a partir dos dados da planilha,
 * seguindo as normas ABNT/área. Retorna markdown com título (Tabela N — ...),
 * a tabela formatada e a fonte. Usa SOMENTE os números reais fornecidos.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'sugerir-melhorias')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId, chaveSecao, dadosPlanilha } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    dadosPlanilha: string
  }

  if (!dadosPlanilha?.trim() || dadosPlanilha.trim().length < 10) {
    return NextResponse.json({ error: 'Adicione dados na planilha antes de gerar a tabela.' }, { status: 400 })
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho
  const dadosProjeto = ((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as DadosProjeto | undefined) ?? null

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  const nomeSecao = fase?.nome ?? 'Resultados'

  const campo = detectarCampo(trabalho.area_conhecimento ?? '')
  const regrasCampo = getRegrasCampoAcademico(campo, trabalho.tipo_trabalho)

  const systemPrompt = `Você é um especialista em apresentação de dados científicos na área de ${trabalho.area_conhecimento ?? 'pesquisa'}. Monta tabelas seguindo rigorosamente as normas ABNT (IBGE) e as convenções da área.
${regrasCampo}`

  const userPrompt = `Monte a(s) TABELA(S) CIENTÍFICA(S) apropriada(s) a partir dos dados reais abaixo. Siga as normas rigorosas de tabela científica.

CONTEXTO:
- Tipo de trabalho: ${trabalho.tipo_trabalho}
- Área: ${trabalho.area_conhecimento ?? '—'}
- Seção atual: ${nomeSecao}
${dadosProjeto?.pergunta_pesquisa ? `- Pergunta: ${dadosProjeto.pergunta_pesquisa}` : ''}
${dadosProjeto?.objetivo_geral ? `- Objetivo: ${dadosProjeto.objetivo_geral}` : ''}

DADOS REAIS DA PLANILHA:
${dadosPlanilha.slice(0, 8000)}

NORMAS OBRIGATÓRIAS DE TABELA CIENTÍFICA (ABNT NBR 14724 / IBGE):
1. TÍTULO acima da tabela: "**Tabela 1 — [título descritivo do conteúdo]**" (numeração sequencial; título conciso e autoexplicativo).
2. Use formato markdown de tabela (| coluna | coluna |) para a estrutura.
3. Cabeçalho de colunas claro, com unidades entre parênteses quando aplicável (ex: "Idade (anos)", "Peso (kg)").
4. Variáveis quantitativas: apresente como média ± desvio-padrão OU mediana [intervalo interquartil] conforme apropriado.
5. Variáveis categóricas: apresente como n (%).
6. Quando houver comparação entre grupos: inclua coluna de valor-p e indique o teste usado em nota de rodapé.
7. FONTE abaixo da tabela: "Fonte: dados da pesquisa (${new Date().getFullYear()})." ou "Fonte: elaborada pelo(a) autor(a)."
8. Notas de rodapé abaixo da fonte quando necessário (legendas de siglas, testes estatísticos, significância).

REGRAS CRÍTICAS:
- Use EXCLUSIVAMENTE os números reais da planilha. Se um valor não puder ser calculado a partir dos dados, NÃO o invente — omita ou marque como "—".
- Se os dados permitirem, crie a "Tabela 1 — Caracterização da amostra" (padrão em trabalhos científicos).
- Calcule corretamente as estatísticas (médias, percentuais, etc.) a partir dos dados brutos.
- Se houver poucos dados, monte a tabela possível e indique em nota o que falta.
- Responda APENAS com a(s) tabela(s) formatada(s) — título, tabela markdown, fonte e notas. Sem texto explicativo antes ou depois.
- Após a tabela, em UMA linha, sugira: "💡 No texto, descreva esta tabela assim: [exemplo de 1 frase de chamada da tabela no corpo do texto]."`

  return streamText(systemPrompt, userPrompt, false, 3000)
}
