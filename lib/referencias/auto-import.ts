/**
 * lib/referencias/auto-import.ts
 * Versão com validação automática integrada.
 * Backup do original em: auto-import.original.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Referencia } from '@/types'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { buscarRefsExternas } from '@/lib/referencias/buscar-externo'
import { callAI } from '@/lib/ai/stream'
import { buildReferenceGuardrail, type ReferenceValidationResult, type ValidationStatus } from './referenceValidator'

async function gerarQueriesIA(titulo: string, area: string, pergunta: string): Promise<string[]> {
  const tema = [titulo, pergunta, area].filter(Boolean).join('. ').slice(0, 600)
  if (tema.length < 10) return []
  try {
    const system = 'Você é um bibliotecário de pesquisa científica especialista em estratégias de busca em PubMed e CrossRef.'
    const user = `Tema de pesquisa (em português):\n"${tema}"\n\nGere de 4 a 6 QUERIES de busca em INGLÊS para encontrar artigos científicos reais sobre este tema em PubMed e CrossRef.\nREGRAS:\n- Use os termos científicos/técnicos corretos em inglês (estilo MeSH quando aplicável).\n- Cada query: 2 a 5 palavras-chave essenciais (sem frases longas, sem palavras em português, sem pontuação).\n- Cubra os diferentes ângulos do tema (intervenção, desfecho, população, método).\n- Não inclua aspas, operadores booleanos nem números.\n\nResponda APENAS com um array JSON de strings.`
    const raw = await callAI(system, user, true, 500)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const arr = JSON.parse(match[0]) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((q): q is string => typeof q === 'string').map(q => q.trim()).filter(q => q.length >= 4 && q.length <= 100).slice(0, 6)
  } catch (err) {
    console.error('[auto-import] gerarQueriesIA falhou:', err)
    return []
  }
}

export function toEnglishQuery(texto: string): string {
  const map: Array<[RegExp, string]> = [
    [/intelig[eê]ncia artificial/gi, 'artificial intelligence'],
    [/aprendizado de m[aá]quina/gi, 'machine learning'],
    [/unidade[s]? de terapia intensiva/gi, 'intensive care unit'],
    [/\bUTI\b/g, 'ICU'],
    [/profissionais de sa[uú]de/gi, 'healthcare professionals'],
    [/mortalidade/gi, 'mortality'],
    [/morbidade/gi, 'morbidity'],
    [/esvaziamento g[aá]strico/gi, 'gastric emptying'],
    [/analgesia peridural|peridural/gi, 'epidural analgesia'],
    [/trabalho de parto/gi, 'labor'],
    [/parto/gi, 'childbirth delivery'],
    [/sedação/gi, 'sedation'],
    [/anestesia/gi, 'anesthesia'],
    [/sepse/gi, 'sepsis'],
    [/infarto( agudo)? do mioc[aá]rdio/gi, 'myocardial infarction'],
    [/acidente vascular (cerebral|encef[aá]lico)/gi, 'stroke'],
    [/\bAVC\b|\bAVE\b/gi, 'stroke'],
    [/hipertens[aã]o arterial/gi, 'arterial hypertension'],
    [/hipertens[aã]o/gi, 'hypertension'],
    [/diabetes (mellitus)?/gi, 'diabetes mellitus'],
    [/c[aâ]ncer/gi, 'cancer'],
    [/cirurgia/gi, 'surgery'],
    [/sa[uú]de mental/gi, 'mental health'],
    [/obesidade/gi, 'obesity'],
    [/revis[aã]o sistem[aá]tica/gi, 'systematic review'],
    [/meta-an[aá]lise/gi, 'meta-analysis'],
    [/ensaio cl[ií]nico randomizado/gi, 'randomized controlled trial'],
    [/ensaio cl[ií]nico/gi, 'clinical trial'],
    [/estudo (observacional|transversal)/gi, 'observational study'],
    [/coorte/gi, 'cohort study'],
    [/pesquisa qualitativa/gi, 'qualitative research'],
    [/question[aá]rio/gi, 'questionnaire survey'],
  ]
  let q = texto
  for (const [pt, en] of map) q = q.replace(pt, en)
  return q
}

export function filtrarRefsCitaveis(refs: Referencia[]): Referencia[] {
  return refs.filter(r => {
    const sobrenome = r.autores?.[0]?.sobrenome?.trim() ?? ''
    const temAutor = sobrenome.length > 1
    const adicionadaManual = (r.fonte_tipo as string | undefined) === 'manual' || !r.fonte_tipo
    if (!temAutor) return false
    if (!adicionadaManual && !r.ano) return false
    if (!adicionadaManual) {
      const palavrasSobrenome = sobrenome.split(/\s+/).filter(w => w.length > 1)
      if (palavrasSobrenome.length >= 4) return false
    }
    return true
  })
}

export function isBiomedical(texto: string): boolean {
  return /sa[uú]de|m[eé]dic|medicina|cl[ií]nic|hospital|enfermagem|farmac|nutri[cç]|odontol|veterin|fisioterap|psicolog|biolog|bioqu[ií]m|fisiolog|obstet|anestesi|cirurg/i.test(texto)
}

const SECAO_KEYWORDS: Record<string, string[]> = {
  introducao: ['review', 'background', 'epidemiology', 'prevalence'],
  revisao_literatura: ['review', 'evidence', 'systematic review', 'literature'],
  referencial_teorico: ['theory', 'theoretical framework', 'conceptual model'],
  metodologia: ['methods', 'methodology', 'research design', 'validation'],
  resultados: ['results', 'findings', 'outcomes', 'data'],
  discussao: ['discussion', 'comparison', 'implications', 'mechanism'],
  conclusao: ['conclusions', 'recommendations', 'future research'],
}

// Status de validação JÁ PERSISTIDO em dados_extras (sem chamadas de rede).
// A validação ao vivo no Crossref roda no IMPORT (gerar-referencias) e no botão
// "Revalidar" da tela de referências — NUNCA no caminho de geração de seção, para
// não adicionar 10–25s de latência a cada geração.
function resultsPersistidos(refs: Referencia[]): ReferenceValidationResult[] {
  return refs.map(r => {
    const status = (r.dados_extras as Record<string, unknown> | undefined)?.validation_status as ValidationStatus | undefined
    return { referenceId: r.id, status: status ?? 'UNVERIFIED', errors: [], warnings: [], checkedAt: '' }
  })
}

/** Constrói o guardrail a partir do status persistido — síncrono, sem rede. */
function guardrailRapido(refs: Referencia[]): string {
  return buildReferenceGuardrail(refs, resultsPersistidos(refs), false)
}

interface GarantirRefsParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
  trabalhoId: string
  titulo?: string | null
  area?: string | null
  tipoTrabalho?: string | null
  chaveSecao?: string
  pergunta?: string | null
  refsExistentes: Referencia[]
  meta?: number
  limiar?: number
}

export async function garantirReferenciasReais({
  supabase, trabalhoId, titulo, area, tipoTrabalho,
  chaveSecao = 'revisao_literatura', pergunta,
  refsExistentes, meta = 40, limiar = 30,
}: GarantirRefsParams): Promise<{ referencias: Referencia[]; guardrail: string }> {
  let referencias = [...refsExistentes]

  const citaveis = filtrarRefsCitaveis(referencias)
  if (citaveis.length >= limiar) {
    return { referencias, guardrail: guardrailRapido(citaveis) }
  }

  try {
    const areaStr = (area ?? '').trim()
    const tituloStr = (titulo ?? '').trim()
    const perguntaStr = (pergunta ?? '').trim()
    const tituloEN = toEnglishQuery(tituloStr)
    const areaEN = toEnglishQuery(areaStr)
    const perguntaEN = toEnglishQuery(perguntaStr)
    const ehBiomedico = isBiomedical(`${areaStr} ${tituloStr} ${perguntaStr}`)
    const secKws = SECAO_KEYWORDS[chaveSecao] ?? ['research']

    const queriesIA = await gerarQueriesIA(tituloStr, areaStr, perguntaStr)
    const queriesRegex: string[] = []
    if (tituloEN.length > 8) queriesRegex.push(tituloEN.split(/\s+/).slice(0, 8).join(' '))
    if (perguntaEN.length > 10 && perguntaEN.toLowerCase() !== tituloEN.toLowerCase()) queriesRegex.push(perguntaEN.split(/\s+/).slice(0, 8).join(' '))
    if (tituloEN.length > 8) queriesRegex.push(`${tituloEN.split(/\s+/).slice(0, 6).join(' ')} ${secKws[0]}`)
    if (areaEN) queriesRegex.push(`${areaEN} ${secKws[0]}`)

    const seen = new Set<string>()
    const queriesValidas = [...queriesIA, ...queriesRegex]
      .map(q => q.trim())
      .filter(q => q.length >= 4 && !seen.has(q.toLowerCase().slice(0, 50)) && seen.add(q.toLowerCase().slice(0, 50)))
      .slice(0, 6)

    if (queriesValidas.length === 0) {
      return { referencias, guardrail: guardrailRapido(filtrarRefsCitaveis(referencias)) }
    }

    const resultados: Awaited<ReturnType<typeof buscarRefsExternas>>[] = []
    for (let i = 0; i < queriesValidas.length; i += 2) {
      const lote = queriesValidas.slice(i, i + 2)
      const r = await Promise.all(lote.map(q => buscarRefsExternas(q, 12, !ehBiomedico)))
      resultados.push(...r)
    }

    const vistosDois = new Set<string>(referencias.map(r => r.doi ?? '').filter(Boolean))
    const vistosTitulos = new Set<string>(referencias.map(r => r.titulo.toLowerCase().slice(0, 80)))
    const anoAtual = new Date().getFullYear()

    const refsUnicas = resultados.flat().filter(ref => {
      if (!ref.titulo || ref.titulo.length < 8) return false
      if (!ref.autores || ref.autores.length === 0 || !ref.autores[0]?.sobrenome) return false
      if (!ref.ano || ref.ano < 1950 || ref.ano > anoAtual) return false
      const tk = ref.titulo.toLowerCase().slice(0, 80)
      if (vistosTitulos.has(tk)) return false
      vistosTitulos.add(tk)
      if (ref.doi) { if (vistosDois.has(ref.doi)) return false; vistosDois.add(ref.doi) }
      return true
    }).slice(0, meta - referencias.length)

    if (refsUnicas.length > 0) {
      const inserir = refsUnicas.map(ref => {
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
      const { data: salvas } = await supabase.from('referencias').insert(inserir).select()
      if (salvas && salvas.length > 0) {
        referencias = [...referencias, ...(salvas as Referencia[])]
        console.log(`[auto-import] ${salvas.length} refs importadas → total: ${referencias.length}`)
      }
    }
  } catch (err) {
    console.error('[auto-import] Falha na busca:', err)
  }

  // Guardrail a partir do status persistido (sem rede). As refs recém-importadas
  // entram como UNVERIFIED (permitidas em modo não-estrito) e serão validadas no
  // Crossref de forma assíncrona na tela de Referências ("Revalidar") ou no import.
  const citaveisFinais = filtrarRefsCitaveis(referencias)
  const guardrail = guardrailRapido(citaveisFinais)
  return { referencias, guardrail }
}
