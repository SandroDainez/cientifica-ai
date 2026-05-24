import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildSystemPrompt, buildGerarSecaoPrompt } from '@/lib/ai/prompts'
import { getSystemPromptEspecializado } from '@/lib/ai/prompts-secoes'
import { streamText } from '@/lib/ai/stream'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { buscarRefsExternas } from '@/lib/referencias/buscar-externo'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, Referencia, FormatoCitacao } from '@/types'

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

  // ── Auto-importação de referências ────────────────────────────────────────
  // Quando o trabalho não tem referências, busca automaticamente em CrossRef
  // + PubMed usando múltiplas queries paralelas (título, área, seção) para
  // garantir cobertura abrangente. Objetivo: ≥ 12 refs reais antes de gerar.

  function toEnglishQuery(titulo: string): string {
    const map: Array<[RegExp, string]> = [
      [/intelig[eê]ncia artificial/gi, 'artificial intelligence'],
      [/unidade[s]? de terapia intensiva/gi, 'intensive care unit'],
      [/\bUTI\b/g, 'ICU'],
      [/carga de trabalho/gi, 'workload'],
      [/profissionais de sa[uú]de/gi, 'healthcare professionals'],
      [/mortalidade/gi, 'mortality'],
      [/revis[aã]o sistem[aá]tica/gi, 'systematic review'],
      [/ensaio cl[ií]nico/gi, 'clinical trial'],
      [/enfermagem/gi, 'nursing'],
      [/medicina/gi, 'medicine'],
      [/pacientes cr[ií]ticos/gi, 'critical patients'],
    ]
    let q = titulo
    for (const [pt, en] of map) q = q.replace(pt, en)
    return q
  }

  // Auto-importa se não tem refs, ou se tem poucas (< 8) — garante cobertura mínima
  if (referencias.length < 8) {
    try {
      // Monta queries diversificadas para cobrir diferentes ângulos do tema
      const queries: string[] = []

      if (trabalho.titulo?.trim())            queries.push(trabalho.titulo.trim())
      const tituloEN = toEnglishQuery(trabalho.titulo?.trim() ?? '')
      if (tituloEN.toLowerCase() !== (trabalho.titulo?.trim() ?? '').toLowerCase()) {
        queries.push(tituloEN)
      }
      if (trabalho.area_conhecimento?.trim()) queries.push(trabalho.area_conhecimento.trim())

      // Query específica por seção para maior relevância
      const sectionKeywords: Record<string, string> = {
        introducao:          'introduction review',
        revisao_literatura:  'literature review',
        referencial_teorico: 'theoretical framework',
        metodologia:         'research methods methodology',
        resultados:          'results findings',
        discussao:           'discussion analysis',
        pergunta_pico:       'clinical research PICO',
        estrategia_busca:    'systematic search strategy',
      }
      const secKw = sectionKeywords[chaveSecao] ?? ''
      if (secKw && trabalho.area_conhecimento) {
        queries.push(`${trabalho.area_conhecimento} ${secKw}`)
      }

      // Tipos de trabalho com palavras-chave metodológicas adicionais
      const tipoKw: Record<string, string> = {
        revisao_sistematica: 'systematic review meta-analysis',
        artigo_original:     'original research clinical study',
        relato_caso:         'case report clinical case',
      }
      const tkw = tipoKw[trabalho.tipo_trabalho]
      if (tkw && trabalho.area_conhecimento) {
        queries.push(`${trabalho.area_conhecimento} ${tkw}`)
      }

      const queriesValidas = queries.filter(q => q.trim().length > 5).slice(0, 3)

      if (queriesValidas.length > 0) {
        console.log('[gerar-secao] Buscando referências automáticas para:', queriesValidas)

        // Busca paralela: cada query traz 6 candidatos → ~18 antes de deduplicar
        const resultados = await Promise.all(
          queriesValidas.map(q => buscarRefsExternas(q, 6))
        )

        // Achata e deduplica por DOI e título (inclui as que já existem no banco)
        const vistosDois  = new Set<string>(referencias.map(r => r.doi ?? '').filter(Boolean))
        const vistosTitulos = new Set<string>(referencias.map(r => r.titulo.toLowerCase().slice(0, 60)))
        const refsUnicas = resultados.flat().filter(ref => {
          const titleKey = ref.titulo.toLowerCase().slice(0, 60)
          if (vistosTitulos.has(titleKey)) return false
          vistosTitulos.add(titleKey)
          if (ref.doi) {
            if (vistosDois.has(ref.doi)) return false
            vistosDois.add(ref.doi)
          }
          return true
        }).slice(0, 15 - referencias.length)  // só importa o que falta para chegar em ~15

        if (refsUnicas.length > 0) {
          const formato = (trabalho.formato_citacao ?? 'abnt') as FormatoCitacao
          const inserir = refsUnicas.map(ref => {
            const parcial = {
              id: '', trabalho_id: trabalhoId, dados_extras: {},
              confiabilidade: 'alta' as const, created_at: '',
              referencia_formatada_abnt: '',
              referencia_formatada_vancouver: '',
              referencia_formatada_apa: '',
              ...ref,
            } as Referencia

            return {
              trabalho_id:  trabalhoId,
              tipo:         ref.tipo,
              titulo:       ref.titulo,
              autores:      ref.autores ?? [],
              ano:          ref.ano,
              journal:      ref.journal,
              volume:       ref.volume,
              numero:       ref.numero,
              paginas:      ref.paginas,
              doi:          ref.doi,
              pmid:         ref.pmid,
              editora:      ref.editora,
              isbn:         ref.isbn,
              dados_extras: {},
              fonte_tipo:   ref.fonte_tipo,
              confiabilidade: 'alta',
              referencia_formatada_abnt:      formatarReferencia(parcial, 'abnt'),
              referencia_formatada_vancouver: formatarReferencia(parcial, 'vancouver'),
              referencia_formatada_apa:       formatarReferencia(parcial, 'apa'),
            }
          })

          const { data: salvas } = await supabase
            .from('referencias')
            .insert(inserir)
            .select()

          if (salvas && salvas.length > 0) {
            // Adiciona as novas às que já existiam (não substitui)
            referencias = [...referencias, ...(salvas as Referencia[])]
            console.log(`[gerar-secao] ${salvas.length} novas refs importadas → total: ${referencias.length}`)
          }
        }
      }
    } catch (err) {
      // Falha silenciosa — gera a seção sem refs em vez de bloquear o usuário
      console.error('[gerar-secao] Falha na auto-importação de referências:', err)
    }
  }

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
  const systemPrompt = systemPromptEspecializado ?? buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  const userPrompt = buildGerarSecaoPrompt(fase, {
    titulo: trabalho.titulo,
    area: trabalho.area_conhecimento ?? undefined,
    orientador: trabalho.orientador ?? undefined,
    contexto_anterior: contexto_anterior || undefined,
    instrucoes_usuario,
    respostas_usuario,
    referencias: referencias.length > 0 ? referencias : undefined,
    formato_citacao: trabalho.formato_citacao,
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

  return streamText(systemPrompt, userPrompt, false)
}
