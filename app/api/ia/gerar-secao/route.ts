import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildSystemPrompt, buildGerarSecaoPrompt } from '@/lib/ai/prompts'
import { getSystemPromptEspecializado } from '@/lib/ai/prompts-secoes'
import { streamText, callAI } from '@/lib/ai/stream'
import { HUMANIZADOR_SYSTEM, buildHumanizadorPrompt } from '@/lib/ai/humanizar'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { garantirReferenciasReais, filtrarRefsCitaveis } from '@/lib/referencias/auto-import'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { buscarRefsExternas, enriquecerAbstractsFaltantes } from '@/lib/referencias/buscar-externo'
import { ehReferenciaUtilizavel, ehFonteFraca } from '@/lib/referencias/qualidade'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { buildGenerationEvidencePolicy } from '@/lib/research-os/generation-evidence'
import { selectSafeScientificRewrite, semanticLockMetadata } from '@/lib/research-os/safe-scientific-rewrite'
import type { EvidenceMapResult } from '@/lib/research-os/evidence-engine'
import type { ResearchProjectState } from '@/lib/research-os/types'
import type { Trabalho, Referencia } from '@/types'

export const maxDuration = 300

function streamStringComEfeito(texto: string): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
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

  const rl = await checkRateLimit(supabase, user.id, 'gerar-secao')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas gerações em sequência. Aguarde um momento antes de tentar novamente.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } },
    )
  }

  const { trabalhoId, chaveSecao, instrucoes_usuario, respostas_usuario, outlineAprovado } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    instrucoes_usuario?: string
    respostas_usuario?: Record<string, string>
    outlineAprovado?: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho
  const dadosTrabalho = (trabalho.dados_trabalho as Record<string, unknown>) ?? {}
  const dados_projeto = (dadosTrabalho.dados_projeto as import('@/types').DadosProjeto | undefined) ?? null
  const researchOs = (dadosTrabalho.research_os as Record<string, unknown>) ?? null
  const researchProjectState = (researchOs?.project_state as ResearchProjectState | undefined) ?? null
  const evidenceMap = (researchOs?.evidence_map as EvidenceMapResult | undefined) ?? null

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  if (!fase) return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 })

  const { data: referenciasData } = await supabase
    .from('referencias')
    .select('*')
    .eq('trabalho_id', trabalhoId)
    .order('created_at')
  let referencias = (referenciasData ?? []) as Referencia[]

  if (chaveSecao === 'referencias') {
    const formato = trabalho.formato_citacao ?? 'abnt'
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

    if (referencias.length < 10) {
      try {
        const area = trabalho.area_conhecimento?.trim() ?? ''
        const titulo = trabalho.titulo?.trim() ?? ''
        const queries = [titulo, area].filter(q => q.length >= 6).slice(0, 2)
        if (queries.length > 0) {
          const resultados = await Promise.all(queries.map(q => buscarRefsExternas(q, 8)))
          const vistosDois = new Set<string>(referencias.map(r => r.doi ?? '').filter(Boolean))
          const vistosTitulos = new Set<string>(referencias.map(r => r.titulo.toLowerCase().slice(0, 80)))
          const anoAtual = new Date().getFullYear()
          const novas = resultados.flat().filter(ref => {
            if (!ref.titulo || !ehReferenciaUtilizavel(ref)) return false
            if (!ref.ano || ref.ano < 1950 || ref.ano > anoAtual) return false
            const tk = ref.titulo.toLowerCase().slice(0, 80)
            if (vistosTitulos.has(tk)) return false
            vistosTitulos.add(tk)
            if (ref.doi) {
              if (vistosDois.has(ref.doi)) return false
              vistosDois.add(ref.doi)
            }
            return true
          })
            .sort((a, b) => Number(ehFonteFraca(a)) - Number(ehFonteFraca(b)))
            .slice(0, 20)

          if (novas.length > 0) {
            const rows = novas.map(ref => {
              const parcial = {
                id: '', trabalho_id: trabalhoId, dados_extras: {}, confiabilidade: 'alta' as const,
                created_at: '', referencia_formatada_abnt: '', referencia_formatada_vancouver: '',
                referencia_formatada_apa: '', ...ref,
              } as Referencia
              return {
                trabalho_id: trabalhoId, tipo: ref.tipo, titulo: ref.titulo, autores: ref.autores ?? [],
                ano: ref.ano, journal: ref.journal, volume: ref.volume, numero: ref.numero, paginas: ref.paginas,
                doi: ref.doi, pmid: ref.pmid, editora: ref.editora, isbn: ref.isbn, dados_extras: {},
                fonte_tipo: ref.fonte_tipo, confiabilidade: 'alta',
                referencia_formatada_abnt: formatarReferencia(parcial, 'abnt'),
                referencia_formatada_vancouver: formatarReferencia(parcial, 'vancouver'),
                referencia_formatada_apa: formatarReferencia(parcial, 'apa'),
              }
            })
            const { data: salvas } = await supabase.from('referencias').insert(rows).select()
            if (salvas?.length) referencias = [...referencias, ...(salvas as Referencia[])]
          }
        }
      } catch { /* falha silenciosa */ }
    }

    if (referencias.length === 0) {
      const aviso = '> ⚠️ Não foi possível encontrar referências para este trabalho nas bases PubMed e CrossRef. Acesse o painel de Referências para adicionar suas fontes manualmente e clique em "Gerar" novamente.'
      await supabase.from('secoes_trabalho').update({ conteudo: aviso, status: 'gerado' })
        .eq('trabalho_id', trabalhoId).eq('chave_secao', 'referencias')
      return streamStringComEfeito(aviso)
    }

    const { ordenarReferencias } = await import('@/lib/referencias/formatar')
    const refsOrdenadas = ordenarReferencias(filtrarRefsCitaveis(referencias), formato)
    const linhas = refsOrdenadas.map((ref, i) =>
      formatarReferencia(ref, formato, formato === 'vancouver' ? i + 1 : undefined),
    )
    const cabecalho = formato === 'vancouver' ? '## Referências\n\n' : '## REFERÊNCIAS\n\n'
    const corpo = formato === 'vancouver'
      ? linhas.map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, '')}`).join('\n\n')
      : linhas.join('\n\n')
    const textoFinal = cabecalho + corpo

    await supabase.from('secoes_trabalho').update({ conteudo: textoFinal, status: 'gerado' })
      .eq('trabalho_id', trabalhoId).eq('chave_secao', 'referencias')
    return streamStringComEfeito(textoFinal)
  }

  const evidencePolicy = buildGenerationEvidencePolicy({
    sectionKey: chaveSecao,
    researchProjectState,
    evidenceMap,
    currentReferenceIds: referencias.map(r => r.id),
  })

  if (evidencePolicy.researchOsActive && !evidencePolicy.decision.allowed) {
    return NextResponse.json({
      error: `Research OS bloqueou a geração de "${fase.nome}" até a base de evidência ser auditada. ${evidencePolicy.decision.reasons.join(' ')}`,
      code: 'EVIDENCE_GATE_BLOCKED',
      evidenceGate: evidencePolicy.decision,
      action: {
        label: 'Abrir Research OS / Evidence Map',
        href: `/trabalhos/${trabalhoId}/research-os`,
      },
    }, { status: 409 })
  }

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

  try {
    const novosAbstracts = await enriquecerAbstractsFaltantes(
      referencias.map(r => ({ id: r.id, doi: r.doi, pmid: r.pmid, abstract: r.abstract })),
    )
    if (novosAbstracts.size > 0) {
      await Promise.allSettled(
        [...novosAbstracts].map(([id, abstract]) =>
          supabase.from('referencias').update({ abstract }).eq('id', id)),
      )
      referencias = referencias.map(r => novosAbstracts.has(r.id) ? { ...r, abstract: novosAbstracts.get(r.id) } : r)
      console.log(`[gerar-secao] backfill de abstracts: +${novosAbstracts.size}`)
    }
  } catch (e) {
    console.error('[gerar-secao] backfill de abstracts falhou (segue sem):', e)
  }

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

  const systemPromptEspecializado = getSystemPromptEspecializado(trabalho.tipo_trabalho, chaveSecao)
  const systemPromptBase = systemPromptEspecializado ?? buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao,
    trabalho.area_conhecimento ?? undefined,
  )

  const systemPrompt = [
    guardrail,
    evidencePolicy.promptGuardrail,
    systemPromptBase,
  ].filter(Boolean).join('\n\n')

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
    outlineAprovado,
  })

  const faseIndex = fluxo!.fases.findIndex(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  await supabase.from('secoes_trabalho').upsert({
    trabalho_id: trabalhoId,
    nome_secao: fase.nome,
    chave_secao: fase.chave_secao,
    ordem: faseIndex,
    status: 'gerando',
    sugestoes_ia: [],
    metadados: {
      evidence_gate: evidencePolicy.researchOsActive ? evidencePolicy.decision : undefined,
    },
  }, { onConflict: 'trabalho_id,chave_secao' })

  const SECOES_HUMANIZAR = new Set([
    'introducao', 'revisao_literatura', 'referencial_teorico',
    'metodologia', 'metodos_delineamento', 'metodos_coleta',
    'resultados', 'discussao', 'conclusao', 'resumo',
    'desenvolvimento', 'consideracoes_finais', 'justificativa', 'problema', 'tema',
    'sintese', 'metanalise', 'discussao_grade', 'apresentacao_caso', 'investigacao_diagnostica',
    'conduta_tratamento', 'evolucao_desfecho', 'aspectos_eticos', 'consentimento_paciente',
    'perspectivas', 'formacao', 'resultados_esperados', 'limitacoes', 'tema_originalidade',
    'revisao_estado_arte',
  ])

  const deveHumanizar = SECOES_HUMANIZAR.has(chaveSecao)
  const minPalavrasHumanizar = fase.min_palavras ?? 0
  const formato = trabalho.formato_citacao

  const persistirSecaoGerada = async (texto: string, semanticLock?: ReturnType<typeof semanticLockMetadata>) => {
    if (chaveSecao === 'resumo' || !texto?.trim()) return
    const { error } = await supabase
      .from('secoes_trabalho')
      .update({
        conteudo: texto,
        conteudo_ia: texto,
        status: 'gerado',
        metadados: {
          evidence_gate: evidencePolicy.researchOsActive ? evidencePolicy.decision : undefined,
          generated_with_research_os: evidencePolicy.researchOsActive,
          semantic_lock: semanticLock,
        },
      })
      .eq('trabalho_id', trabalhoId)
      .eq('chave_secao', chaveSecao)
    if (error) console.error('[gerar-secao] falha ao persistir conteúdo gerado:', error)
  }

  if (deveHumanizar && minPalavrasHumanizar >= 80) {
    const maxTokensDraft = Math.max(12000, (fase.max_palavras ?? 2000) * 3)
    try {
      const rascunho = await callAI(systemPrompt, userPrompt, false, maxTokensDraft)
      if (rascunho && rascunho.trim().split(/\s+/).length >= 50) {
        const maxTokensHuman = Math.max(12000, rascunho.split(/\s+/).length * 3)
        let candidato: string | null = null
        try {
          const out = await callAI(HUMANIZADOR_SYSTEM, buildHumanizadorPrompt(rascunho), false, maxTokensHuman)
          if (out && out.trim().split(/\s+/).length >= 40) candidato = out
        } catch (e) {
          console.error('[gerar-secao] Revisão linguística falhou — usa rascunho:', e)
        }

        const safe = selectSafeScientificRewrite(rascunho, candidato)
        if (!safe.usedRewrite && candidato) {
          console.warn('[gerar-secao] Semantic Lock rejeitou revisão; rascunho preservado:', safe.semanticLock.reasons)
        }

        const validado = posProcessarTextoGerado(safe.selectedText, referencias, formato)
        await persistirSecaoGerada(validado, semanticLockMetadata(safe))
        return streamStringComEfeito(validado)
      }
    } catch (err) {
      console.error('[gerar-secao] Falha na geração de duas passagens — fallback:', err)
    }
  }

  try {
    const textoUnico = await callAI(systemPrompt, userPrompt, false, Math.max(6000, (fase.max_palavras ?? 1500) * 2))
    if (textoUnico && textoUnico.trim().length > 20) {
      const validado = posProcessarTextoGerado(textoUnico, referencias, formato)
      await persistirSecaoGerada(validado)
      return streamStringComEfeito(validado)
    }
  } catch (err) {
    console.error('[gerar-secao] Falha no single-pass — streaming direto:', err)
  }

  return streamText(systemPrompt, userPrompt, false)
}
