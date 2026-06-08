import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildSystemPrompt, buildGerarSecaoPrompt } from '@/lib/ai/prompts'
import { getSystemPromptEspecializado } from '@/lib/ai/prompts-secoes'
import { streamText, callAI } from '@/lib/ai/stream'
import { HUMANIZADOR_SYSTEM, buildHumanizadorPrompt } from '@/lib/ai/humanizar'
import { validarCitacoesReais } from '@/lib/ai/validar-citacoes'
import { garantirReferenciasReais, filtrarRefsCitaveis } from '@/lib/referencias/auto-import'

export const maxDuration = 300
import { extrairTextoSecao } from '@/lib/ai/utils'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { buscarRefsExternas } from '@/lib/referencias/buscar-externo'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, Referencia } from '@/types'

/** Transmite uma string já pronta com efeito de digitação (chunks pequenos). */
function streamStringComEfeito(texto: string): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      // Emite em blocos de ~24 caracteres para dar sensação de digitação fluida
      const tamanho = 24
      for (let i = 0; i < texto.length; i += tamanho) {
        controller.enqueue(encoder.encode(texto.slice(i, i + tamanho)))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Rate limiting: 8 gerações por minuto por usuário
  const rl = await checkRateLimit(supabase, user.id, 'gerar-secao')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas gerações em sequência. Aguarde um momento antes de tentar novamente.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId, chaveSecao, instrucoes_usuario, respostas_usuario } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    instrucoes_usuario?: string
    respostas_usuario?: Record<string, string>
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
  const dados_projeto = ((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as import('@/types').DadosProjeto | undefined) ?? null

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  if (!fase) return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 })

  // Carrega referências bibliográficas do trabalho
  const { data: referenciasData } = await supabase
    .from('referencias')
    .select('*')
    .eq('trabalho_id', trabalhoId)
    .order('created_at')
  let referencias = (referenciasData ?? []) as Referencia[]

  // ── Fast-path: seção "Referências" não usa IA — compila direto do banco ──────
  if (chaveSecao === 'referencias') {
    const formato = trabalho.formato_citacao ?? 'abnt'

    // Upsert da seção antes de retornar
    const faseIndex = fluxo!.fases.findIndex(f => f.chave_secao === 'referencias')
    await supabase.from('secoes_trabalho').upsert({
      trabalho_id: trabalhoId,
      nome_secao: 'Referências',
      chave_secao: 'referencias',
      ordem: faseIndex,
      status: 'gerado',
      sugestoes_ia: [],
      metadados: {},
    }, { onConflict: 'trabalho_id,chave_secao' })

    // Se não tem referências suficientes, importa antes de montar a lista
    if (referencias.length < 10) {
      try {
        const area = trabalho.area_conhecimento?.trim() ?? ''
        const titulo = trabalho.titulo?.trim() ?? ''
        const queries = [titulo, area].filter(q => q.length >= 6).slice(0, 2)
        if (queries.length > 0) {
          const resultados = await Promise.all(queries.map(q => buscarRefsExternas(q, 8)))
          const vistosDois = new Set<string>(referencias.map(r => r.doi ?? '').filter(Boolean))
          const vistosTitulos = new Set<string>(referencias.map(r => r.titulo.toLowerCase().slice(0, 80)))
          const novas = resultados.flat().filter(ref => {
            if (!ref.titulo) return false
            const tk = ref.titulo.toLowerCase().slice(0, 80)
            if (vistosTitulos.has(tk)) return false
            vistosTitulos.add(tk)
            if (ref.doi) { if (vistosDois.has(ref.doi)) return false; vistosDois.add(ref.doi) }
            return true
          }).slice(0, 20)
          if (novas.length > 0) {
            const rows = novas.map(ref => {
              const parcial = { id: '', trabalho_id: trabalhoId, dados_extras: {}, confiabilidade: 'alta' as const, created_at: '', referencia_formatada_abnt: '', referencia_formatada_vancouver: '', referencia_formatada_apa: '', ...ref } as Referencia
              return { trabalho_id: trabalhoId, tipo: ref.tipo, titulo: ref.titulo, autores: ref.autores ?? [], ano: ref.ano, journal: ref.journal, volume: ref.volume, numero: ref.numero, paginas: ref.paginas, doi: ref.doi, pmid: ref.pmid, editora: ref.editora, isbn: ref.isbn, dados_extras: {}, fonte_tipo: ref.fonte_tipo, confiabilidade: 'alta', referencia_formatada_abnt: formatarReferencia(parcial, 'abnt'), referencia_formatada_vancouver: formatarReferencia(parcial, 'vancouver'), referencia_formatada_apa: formatarReferencia(parcial, 'apa') }
            })
            const { data: salvas } = await supabase.from('referencias').insert(rows).select()
            if (salvas?.length) referencias = [...referencias, ...(salvas as Referencia[])]
          }
        }
      } catch { /* falha silenciosa */ }
    }

    if (referencias.length === 0) {
      const aviso = '> ⚠️ Não foi possível encontrar referências para este trabalho nas bases PubMed e CrossRef. Acesse o painel de Referências para adicionar suas fontes manualmente e clique em "Gerar" novamente.'
      const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(aviso)); c.close() } })
      await supabase.from('secoes_trabalho').update({ conteudo: aviso, status: 'gerado' }).eq('trabalho_id', trabalhoId).eq('chave_secao', 'referencias')
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // Ordena conforme formato (somente referências de qualidade)
    const { ordenarReferencias } = await import('@/lib/referencias/formatar')
    const refsOrdenadas = ordenarReferencias(filtrarRefsCitaveis(referencias), formato)

    // Formata cada referência
    const linhas = refsOrdenadas.map((ref, i) =>
      formatarReferencia(ref, formato, formato === 'vancouver' ? i + 1 : undefined)
    )

    // Monta o texto final
    const cabecalho = formato === 'vancouver'
      ? '## Referências\n\n'
      : '## REFERÊNCIAS\n\n'

    const corpo = formato === 'vancouver'
      ? linhas.map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, '')}`).join('\n\n')
      : linhas.join('\n\n')

    const textoFinal = cabecalho + corpo

    // Salva e transmite
    await supabase.from('secoes_trabalho').update({ conteudo: textoFinal, status: 'gerado' })
      .eq('trabalho_id', trabalhoId).eq('chave_secao', 'referencias')

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(textoFinal))
        controller.close()
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // ── Auto-importação de referências reais (módulo compartilhado) ────────────
  // Garante ~40 referências REAIS (CrossRef + PubMed) antes de gerar a seção.
  // Filtra refs sem autor/ano para citações limpas. Nunca inventa.
  const refsResult = await garantirReferenciasReais({
    supabase,
    trabalhoId,
    titulo: trabalho.titulo,
    area: trabalho.area_conhecimento,
    tipoTrabalho: trabalho.tipo_trabalho,
    chaveSecao,
    pergunta: dados_projeto?.pergunta_pesquisa,
    refsExistentes: referencias,
  })
  referencias = refsResult.referencias
  const guardrail = refsResult.guardrail


  // Carrega conteúdo das seções anteriores para contexto
  const { data: secoesAnteriores } = await supabase
    .from('secoes_trabalho')
    .select('nome_secao, conteudo')
    .eq('trabalho_id', trabalhoId)
    .in('status', ['gerado', 'editado', 'aprovado'])
    .order('ordem')

  const contexto_anterior = secoesAnteriores
    ?.map(s => {
      const textoLimpo = extrairTextoSecao(s.conteudo ?? '')
      return `**${s.nome_secao}**:\n${textoLimpo.substring(0, 1500)}`
    })
    .join('\n\n') ?? ''

  const systemPromptEspecializado = getSystemPromptEspecializado(
    trabalho.tipo_trabalho,
    chaveSecao
  )
  const systemPromptBase = systemPromptEspecializado ?? buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao,
    trabalho.area_conhecimento ?? undefined,
  )
  // Guardrail de referências validadas (passo 8 do briefing): força a IA a usar
  // somente as referências reais validadas e a nunca inventar fontes.
  const systemPrompt = guardrail + '\n\n' + systemPromptBase

  // Só cita referências de qualidade (com autor e ano) — evita "(s.d.)" e títulos-como-autor
  const refsCitaveis = filtrarRefsCitaveis(referencias)

  const userPrompt = buildGerarSecaoPrompt(fase, {
    titulo: trabalho.titulo,
    area: trabalho.area_conhecimento ?? undefined,
    orientador: trabalho.orientador ?? undefined,
    contexto_anterior: contexto_anterior || undefined,
    instrucoes_usuario,
    respostas_usuario,
    referencias: refsCitaveis.length > 0 ? refsCitaveis : undefined,
    formato_citacao: trabalho.formato_citacao,
    dados_projeto: dados_projeto ?? undefined,
  })

  // Garante que a seção existe na tabela (upsert)
  const faseIndex = fluxo!.fases.findIndex(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  await supabase.from('secoes_trabalho').upsert({
    trabalho_id: trabalhoId,
    nome_secao: fase.nome,
    chave_secao: fase.chave_secao,
    ordem: faseIndex,
    status: 'gerando',
    sugestoes_ia: [],
    metadados: {},
  }, { onConflict: 'trabalho_id,chave_secao' })

  // ── Seções que passam pela 2ª passagem de humanização ─────────────────────
  // Seções textuais substanciais → gera rascunho → humaniza → streama.
  // Seções estruturais (checklist, cronograma, orçamento) → streaming direto.
  // NOTA: 'objetivos' e seções estruturadas NÃO entram aqui — precisam manter
  // a estrutura rígida de lista, que a humanização (prosa/burstiness) quebraria.
  const SECOES_HUMANIZAR = new Set([
    'introducao', 'revisao_literatura', 'referencial_teorico',
    'metodologia', 'metodos_delineamento', 'metodos_coleta',
    'resultados', 'discussao', 'conclusao', 'resumo',
    'desenvolvimento', 'consideracoes_finais',
    'justificativa', 'problema', 'tema',
    'sintese', 'metanalise', 'discussao_grade',
    'apresentacao_caso', 'investigacao_diagnostica',
    'conduta_tratamento', 'evolucao_desfecho',
    'aspectos_eticos', 'consentimento_paciente',
    'perspectivas', 'formacao', 'resultados_esperados',
    'limitacoes', 'tema_originalidade', 'revisao_estado_arte',
  ])

  const deveHumanizar = SECOES_HUMANIZAR.has(chaveSecao)
  const minPalavrasHumanizar = fase.min_palavras ?? 0
  const formato = trabalho.formato_citacao

  if (deveHumanizar && minPalavrasHumanizar >= 80) {
    const maxTokensDraft = Math.max(8000, (fase.max_palavras ?? 2000) * 2)
    try {
      // Passagem 1: rascunho técnico com as referências reais
      const rascunho = await callAI(systemPrompt, userPrompt, false, maxTokensDraft)
      if (rascunho && rascunho.trim().split(/\s+/).length >= 50) {
        // Passagem 2: humaniza (preservando citações verbatim)
        const maxTokensHuman = Math.max(8000, rascunho.split(/\s+/).length * 2)
        let humanizado = rascunho
        try {
          const out = await callAI(HUMANIZADOR_SYSTEM, buildHumanizadorPrompt(rascunho), false, maxTokensHuman)
          if (out && out.trim().split(/\s+/).length >= 40) humanizado = out
        } catch (e) {
          console.error('[gerar-secao] Humanização falhou — usa rascunho:', e)
        }
        // Camada final: valida TODAS as citações contra as referências reais.
        // Qualquer citação inventada (sobrenome não cadastrado) vira (SOBRENOME, ANO).
        const validado = validarCitacoesReais(humanizado, referencias, formato)
        return streamStringComEfeito(validado)
      }
    } catch (err) {
      console.error('[gerar-secao] Falha na geração de duas passagens — fallback:', err)
    }
  }

  // Seções estruturadas / fallback: gera direto, valida citações, transmite
  try {
    const textoUnico = await callAI(systemPrompt, userPrompt, false, Math.max(6000, (fase.max_palavras ?? 1500) * 2))
    if (textoUnico && textoUnico.trim().length > 20) {
      const validado = validarCitacoesReais(textoUnico, referencias, formato)
      return streamStringComEfeito(validado)
    }
  } catch (err) {
    console.error('[gerar-secao] Falha no single-pass — streaming direto:', err)
  }

  // Último recurso: streaming direto da IA (sem validação pós)
  return streamText(systemPrompt, userPrompt, false)
}
