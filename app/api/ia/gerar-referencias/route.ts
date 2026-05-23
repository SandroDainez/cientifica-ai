/**
 * /api/ia/gerar-referencias
 *
 * Busca e salva referências REAIS em CrossRef + PubMed para um trabalho.
 * Utiliza múltiplas queries paralelas para cobrir diferentes ângulos do tema
 * (título, área, tipo de trabalho) e retorna as referências salvas.
 *
 * Substituiu a versão anterior que pedia à IA para "inventar exemplos
 * ilustrativos" — referências inventadas são inaceitáveis em trabalhos
 * acadêmicos.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { buscarRefsExternas } from '@/lib/referencias/buscar-externo'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, Referencia, FormatoCitacao } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-referencias')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { trabalhoId, tema } = await request.json() as {
    trabalhoId: string
    tema?: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  // ── Build de queries múltiplas para cobertura abrangente ──────────────────
  const queryCandidates: string[] = []

  // 1. Tema explícito (passado pelo chamador) ou título do trabalho
  const queryPrincipal = tema?.trim() || trabalho.titulo?.trim()
  if (queryPrincipal) queryCandidates.push(queryPrincipal)

  // 2. Área de conhecimento (cobre fontes que não têm o título exato)
  if (trabalho.area_conhecimento?.trim() && trabalho.area_conhecimento !== queryPrincipal) {
    queryCandidates.push(trabalho.area_conhecimento.trim())
  }

  // 3. Combinação área + tipo (para metodologia e revisões)
  if (trabalho.area_conhecimento && trabalho.tipo_trabalho) {
    const tipoKeywords: Record<string, string> = {
      revisao_sistematica:  'systematic review',
      artigo_original:      'original research',
      tcc:                  '',
      dissertacao_mestrado: 'dissertation',
      tese_doutorado:       'thesis',
      relato_caso:          'case report',
      projeto_pesquisa:     'research protocol',
      artigo_revisao:       'review article',
      monografia:           '',
      relatorio_ic:         'scientific initiation',
    }
    const kw = tipoKeywords[trabalho.tipo_trabalho] ?? ''
    if (kw) {
      queryCandidates.push(`${trabalho.area_conhecimento} ${kw}`.trim())
    }
  }

  if (queryCandidates.length === 0) {
    return NextResponse.json({ error: 'Não há informações suficientes para buscar referências' }, { status: 400 })
  }

  // ── Busca paralela com todas as queries ───────────────────────────────────
  // Cada query busca 6 refs para totalizar ~18 candidatas antes de deduplicar
  const refsPerQuery = Math.max(6, Math.ceil(15 / queryCandidates.length))
  const resultadosBrutos = await Promise.all(
    queryCandidates.map(q => buscarRefsExternas(q, refsPerQuery))
  )

  // Achata e deduplica por DOI
  const vistosDois = new Set<string>()
  const vistosTitle = new Set<string>()
  const refsUnicas = resultadosBrutos.flat().filter(ref => {
    const titleKey = ref.titulo.toLowerCase().slice(0, 60)
    if (vistosTitle.has(titleKey)) return false
    vistosTitle.add(titleKey)
    if (ref.doi) {
      if (vistosDois.has(ref.doi)) return false
      vistosDois.add(ref.doi)
    }
    return true
  }).slice(0, 15)

  if (refsUnicas.length === 0) {
    return NextResponse.json({ referencias: [], mensagem: 'Nenhuma referência encontrada nas bases acadêmicas para este tema.' })
  }

  // ── Salva no banco ────────────────────────────────────────────────────────
  // Verifica DOIs já existentes para evitar duplicatas no banco
  const { data: existentes } = await supabase
    .from('referencias')
    .select('doi')
    .eq('trabalho_id', trabalhoId)
  const doisExistentes = new Set((existentes ?? []).map((r: { doi: string | null }) => r.doi).filter(Boolean))

  const novas = refsUnicas.filter(ref => !ref.doi || !doisExistentes.has(ref.doi))
  if (novas.length === 0) {
    const { data: refsBD } = await supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId)
    return NextResponse.json({ referencias: refsBD ?? [], mensagem: 'Referências já importadas anteriormente.' })
  }

  const formato = (trabalho.formato_citacao ?? 'abnt') as FormatoCitacao
  const inserir = novas.map(ref => {
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

  const { data: salvas, error } = await supabase
    .from('referencias')
    .insert(inserir)
    .select()

  if (error) {
    console.error('[gerar-referencias] Erro ao salvar:', error)
    return NextResponse.json({ error: 'Erro ao salvar referências' }, { status: 500 })
  }

  console.log(`[gerar-referencias] ${salvas?.length ?? 0} refs reais salvas para trabalho ${trabalhoId}`)
  return NextResponse.json({
    referencias: salvas ?? [],
    mensagem: `${salvas?.length ?? 0} referências reais importadas de CrossRef e PubMed.`,
  })
}
