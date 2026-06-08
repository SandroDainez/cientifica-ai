import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI, streamText } from '@/lib/ai/stream'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildDocumentoPrompt } from '@/lib/ai/prompts/documentos-projeto'
import { HUMANIZADOR_SYSTEM, buildHumanizadorPrompt } from '@/lib/ai/humanizar'
import { garantirReferenciasReais, filtrarRefsCitaveis } from '@/lib/referencias/auto-import'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { substituirListaReferencias } from '@/lib/referencias/lista-referencias'
import type { Trabalho, DadosProjeto, TipoDocumento, Referencia, FormatoCitacao } from '@/types'

/** Tipos de documento que devem ser embasados em referências reais e citados no texto. */
const DOCS_COM_REFERENCIAS = new Set<TipoDocumento>([
  'revisao_literatura', 'protocolo_cep', 'calculo_amostral', 'guia_analise',
])

/** Transmite uma string já pronta com efeito de digitação. */
function streamStringComEfeito(texto: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      for (let i = 0; i < texto.length; i += 24) controller.enqueue(enc.encode(texto.slice(i, i + 24)))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' },
  })
}

// Documentos acadêmicos são longos — aumentar timeout da função Vercel
export const maxDuration = 300

// Tokens por tipo de documento — documentos estruturados longos precisam de mais
const MAX_TOKENS_POR_TIPO: Partial<Record<TipoDocumento, number>> = {
  revisao_literatura:  6000,
  protocolo_cep:       6000,
  tcle:                4000,
  carta_anuencia:      2000,
  instrumento_coleta:  4000,
  calculo_amostral:    3000,
  guia_coleta:         4000,
  guia_analise:        5000,
  sugestoes_periodicos: 3000,
  carta_submissao:     2000,
  checklist_submissao: 4000,
}

// Documentos que passam pela humanização em 2 etapas.
// Documentos 100% estruturados (formulários, checklists de checkboxes) são excluídos
// porque a segunda passagem pode quebrar a formatação de caixas de marcação.
const HUMANIZAR_TIPOS = new Set<TipoDocumento>([
  'revisao_literatura',
  'guia_analise',
  'guia_coleta',
  'calculo_amostral',
  'sugestoes_periodicos',
  'carta_submissao',
  'protocolo_cep',  // tem seções narrativas longas
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-documento')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429 }
    )
  }

  const body = await request.json() as {
    trabalhoId: string
    tipoDocumento: TipoDocumento
  }

  const { trabalhoId, tipoDocumento } = body

  if (!trabalhoId || !tipoDocumento) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  // Validate ownership and load dados_projeto
  const { data: trabalhoRow } = await supabase
    .from('trabalhos')
    .select('id, titulo, dados_trabalho, area_conhecimento, tipo_trabalho, formato_citacao')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoRow) {
    return NextResponse.json({ error: 'Trabalho não encontrado.' }, { status: 404 })
  }

  const trabalho = trabalhoRow as Pick<Trabalho, 'id' | 'titulo' | 'dados_trabalho' | 'area_conhecimento' | 'tipo_trabalho' | 'formato_citacao'>
  const dadosTrabalho = (trabalho.dados_trabalho as Record<string, unknown>) ?? {}
  const dadosProjeto = dadosTrabalho['dados_projeto'] as DadosProjeto | undefined

  if (!dadosProjeto) {
    return NextResponse.json(
      { error: 'Projeto não encontrado. Gere o plano do projeto primeiro.' },
      { status: 400 }
    )
  }

  const formato: FormatoCitacao = trabalho.formato_citacao ?? 'abnt'

  // ── Referências do trabalho ────────────────────────────────────────────────
  // Carrega as referências existentes para TODOS os tipos de documento, de modo
  // que a resolução de citações (resolver/limpar "(SOBRENOME, ANO)") rode também
  // em instrumento, TCLE, guia etc. — não só nos documentos "de referência".
  const { data: refsData } = await supabase
    .from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at')
  let referencias: Referencia[] = filtrarRefsCitaveis((refsData ?? []) as Referencia[])
  let guardrail = ''
  if (DOCS_COM_REFERENCIAS.has(tipoDocumento)) {
    // Só estes documentos disparam a importação automática (quando faltam refs).
    const refsResult = await garantirReferenciasReais({
      supabase,
      trabalhoId,
      titulo: trabalho.titulo ?? dadosProjeto.titulo_provisorio,
      area: trabalho.area_conhecimento,
      tipoTrabalho: trabalho.tipo_trabalho,
      chaveSecao: 'revisao_literatura',
      pergunta: dadosProjeto.pergunta_pesquisa,
      refsExistentes: (refsData ?? []) as Referencia[],
    })
    referencias = filtrarRefsCitaveis(refsResult.referencias)
    guardrail = refsResult.guardrail
  }

  const { system: systemBase, user: userPrompt } = buildDocumentoPrompt(
    tipoDocumento,
    dadosProjeto,
    trabalho.titulo ?? undefined,
    referencias,
    formato,
  )
  // Guardrail de referências validadas (passo 9 do briefing)
  const system = guardrail ? guardrail + '\n\n' + systemBase : systemBase

  const maxTokens = MAX_TOKENS_POR_TIPO[tipoDocumento] ?? 4000

  // ── Two-pass: gera rascunho → humaniza → stream ──────────────────────────
  // Documentos narrativos passam por uma segunda chamada de IA que aplica
  // transformações estruturais (burstiness, variação lexical, remoção de
  // conectivos de IA) que reduzem o score nos detectores para < 30%.
  // Valida citações no texto E substitui a lista final de referências pela lista
  // real formatada no estilo correto (ABNT alfabético / Vancouver numerado).
  const temListaRefs = tipoDocumento === 'revisao_literatura' || tipoDocumento === 'protocolo_cep'
  const validar = (texto: string) => {
    // Pós-processamento PADRONIZADO (mesma camada do editor): corrige código R,
    // remove travessões, resolve citações contra refs reais e elimina placeholders
    // residuais — em TODOS os documentos (instrumento, TCLE, guia…).
    let t = posProcessarTextoGerado(texto, referencias, formato)
    // Substitui a lista final de referências pela lista real formatada (só nos
    // documentos que têm seção de referências).
    if (temListaRefs && referencias.length > 0) t = substituirListaReferencias(t, referencias, formato)
    return t
  }

  if (HUMANIZAR_TIPOS.has(tipoDocumento)) {
    try {
      // Passagem 1 — gera rascunho completo (sem stream, coleta tudo)
      const rascunho = await callAI(system, userPrompt, false, maxTokens)

      if (!rascunho || rascunho.trim().length < 100) {
        return streamText(system, userPrompt, false, maxTokens)
      }

      // Passagem 2 — humaniza (preservando citações verbatim)
      let humanizado = rascunho
      try {
        const out = await callAI(HUMANIZADOR_SYSTEM, buildHumanizadorPrompt(rascunho), false, maxTokens)
        if (out && out.trim().length >= 100) humanizado = out
      } catch { /* usa rascunho */ }

      // Camada final: valida citações contra as referências reais e transmite
      return streamStringComEfeito(validar(humanizado))
    } catch {
      return streamText(system, userPrompt, false, maxTokens)
    }
  }

  // Demais documentos (com ou sem referências, sem humanização — ex.: protocolo_cep,
  // calculo_amostral, instrumento_coleta, tcle): gera, passa SEMPRE pelo validar()
  // (limpa travessões, resolve/remove citações placeholder) e transmite.
  try {
    const texto = await callAI(system, userPrompt, false, maxTokens)
    if (texto && texto.trim().length > 50) return streamStringComEfeito(validar(texto))
  } catch { /* fallback abaixo */ }

  // Documentos puramente estruturados (TCLE, instrumentos, checklists): passagem única
  return streamText(system, userPrompt, false, maxTokens)
}
