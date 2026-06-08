import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { buscarRefsExternas } from '@/lib/referencias/buscar-externo'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import {
  validateReference,
  validateCitations,
  type ReferenceValidationResult,
  type ValidationReport,
} from '@/lib/referencias/referenceValidator'
import type { Trabalho, Referencia } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-referencias')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde.' }, { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } })
  }

  const { trabalhoId, tema } = await request.json() as { trabalhoId: string; tema?: string }

  const { data: trabalhoData } = await supabase.from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const queryCandidates: string[] = []
  const queryPrincipal = tema?.trim() || trabalho.titulo?.trim()
  if (queryPrincipal) queryCandidates.push(queryPrincipal)
  if (trabalho.area_conhecimento?.trim() && trabalho.area_conhecimento !== queryPrincipal) queryCandidates.push(trabalho.area_conhecimento.trim())
  if (trabalho.area_conhecimento && trabalho.tipo_trabalho) {
    const tipoKeywords: Record<string, string> = {
      revisao_sistematica: 'systematic review', artigo_original: 'original research',
      tcc: '', dissertacao_mestrado: 'dissertation', tese_doutorado: 'thesis',
      relato_caso: 'case report', projeto_pesquisa: 'research protocol',
      artigo_revisao: 'review article', monografia: '', relatorio_ic: 'scientific initiation',
    }
    const kw = tipoKeywords[trabalho.tipo_trabalho] ?? ''
    if (kw) queryCandidates.push(`${trabalho.area_conhecimento} ${kw}`.trim())
  }

  if (queryCandidates.length === 0) return NextResponse.json({ error: 'Informações insuficientes para buscar referências' }, { status: 400 })

  const refsPerQuery = Math.max(6, Math.ceil(15 / queryCandidates.length))
  const resultadosBrutos = await Promise.all(queryCandidates.map(q => buscarRefsExternas(q, refsPerQuery)))

  const vistosDois = new Set<string>()
  const vistosTitle = new Set<string>()
  const refsUnicas = resultadosBrutos.flat().filter(ref => {
    const titleKey = ref.titulo.toLowerCase().slice(0, 60)
    if (vistosTitle.has(titleKey)) return false
    vistosTitle.add(titleKey)
    if (ref.doi) { if (vistosDois.has(ref.doi)) return false; vistosDois.add(ref.doi) }
    return true
  }).slice(0, 15)

  if (refsUnicas.length === 0) return NextResponse.json({ referencias: [], validationReport: null, mensagem: 'Nenhuma referência encontrada.' })

  const { data: existentes } = await supabase.from('referencias').select('doi').eq('trabalho_id', trabalhoId)
  const doisExistentes = new Set((existentes ?? []).map((r: { doi: string | null }) => r.doi).filter(Boolean))
  const novas = refsUnicas.filter(ref => !ref.doi || !doisExistentes.has(ref.doi))

  if (novas.length === 0) {
    const { data: refsBD } = await supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId)
    const refs = (refsBD ?? []) as Referencia[]
    const existingReport = await buildValidationReport(refs)
    return NextResponse.json({ referencias: refs, validationReport: existingReport.report, mensagem: 'Referências já importadas.' })
  }

  const inserir = novas.map(ref => {
    const parcial = { id: '', trabalho_id: trabalhoId, dados_extras: {}, confiabilidade: 'alta' as const, created_at: '', referencia_formatada_abnt: '', referencia_formatada_vancouver: '', referencia_formatada_apa: '', ...ref } as Referencia
    return {
      trabalho_id: trabalhoId, tipo: ref.tipo, titulo: ref.titulo,
      autores: ref.autores ?? [], ano: ref.ano, journal: ref.journal,
      volume: ref.volume, numero: ref.numero, paginas: ref.paginas,
      doi: ref.doi, pmid: ref.pmid, editora: ref.editora, isbn: ref.isbn,
      dados_extras: {}, fonte_tipo: ref.fonte_tipo, confiabilidade: 'alta',
      referencia_formatada_abnt: formatarReferencia(parcial, 'abnt'),
      referencia_formatada_vancouver: formatarReferencia(parcial, 'vancouver'),
      referencia_formatada_apa: formatarReferencia(parcial, 'apa'),
    }
  })

  const { data: salvas, error } = await supabase.from('referencias').insert(inserir).select()
  if (error) { console.error('[gerar-referencias] Erro ao salvar:', error); return NextResponse.json({ error: 'Erro ao salvar referências' }, { status: 500 }) }

  const refsSalvas = (salvas ?? []) as Referencia[]
  const validationReport = await buildValidationReport(refsSalvas)
  await persistValidationStatus(supabase, refsSalvas, validationReport.results)

  console.log(`[gerar-referencias] ${refsSalvas.length} refs | ✓${validationReport.report.validated} ~${validationReport.report.partiallyValidated} ?${validationReport.report.unverified} ✗${validationReport.report.rejected}`)
  return NextResponse.json({ referencias: refsSalvas, validationReport: validationReport.report, mensagem: `${refsSalvas.length} referências importadas e validadas automaticamente.` })
}

async function buildValidationReport(refs: Referencia[]): Promise<{ results: ReferenceValidationResult[]; report: ValidationReport }> {
  const results: ReferenceValidationResult[] = []
  for (const ref of refs) {
    const result = await validateReference(ref, { useExternalValidation: true })
    results.push(result)
    if (ref.doi) await new Promise(r => setTimeout(r, 120))
  }
  const report: ValidationReport = {
    totalReferences: refs.length,
    validated: results.filter(r => r.status === 'VALIDATED').length,
    partiallyValidated: results.filter(r => r.status === 'PARTIALLY_VALIDATED').length,
    unverified: results.filter(r => r.status === 'UNVERIFIED').length,
    rejected: results.filter(r => r.status === 'REJECTED').length,
    criticalErrors: results.filter(r => r.status === 'REJECTED').map(r => ({ referenceId: r.referenceId, error: r.errors[0], message: r.message ?? '' })),
    warnings: results.filter(r => r.warnings.length > 0).flatMap(r => r.warnings.map(w => ({ referenceId: r.referenceId, error: w, message: `${r.referenceId}: ${w}` }))),
    citationErrors: validateCitations('', refs, 'abnt'),
    generatedAt: new Date().toISOString(),
  }
  return { results, report }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistValidationStatus(supabase: any, refs: Referencia[], results: ReferenceValidationResult[]) {
  await Promise.allSettled(results.map(r => {
    const confiabilidade = r.status === 'VALIDATED' ? 'alta' : r.status === 'PARTIALLY_VALIDATED' ? 'media' : r.status === 'UNVERIFIED' ? 'media' : 'baixa'
    return supabase.from('referencias').update({ confiabilidade, dados_extras: { validation_status: r.status, validation_checked_at: r.checkedAt } }).eq('id', r.referenceId)
  }))
}
