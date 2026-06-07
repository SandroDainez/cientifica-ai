/**
 * Auto-importação de referências reais (CrossRef + PubMed).
 *
 * Módulo compartilhado entre /api/ia/gerar-secao (editor) e
 * /api/ia/gerar-documento-projeto (documentos do roadmap). Garante que TODO
 * texto científico gerado tenha um conjunto de referências REAIS disponível,
 * para que as citações no texto sejam reais — nunca inventadas.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Referencia } from '@/types'
import { formatarReferencia } from '@/lib/referencias/formatar'
import { buscarRefsExternas } from '@/lib/referencias/buscar-externo'

/** Traduz termos acadêmicos PT → EN para melhorar buscas internacionais (todas as áreas). */
export function toEnglishQuery(texto: string): string {
  const map: Array<[RegExp, string]> = [
    // Saúde / Medicina
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
    [/sufentanil/gi, 'sufentanil'],
    [/fentanil/gi, 'fentanyl'],
    [/pH (umbilical|fetal|da art[eé]ria umbilical)/gi, 'umbilical cord pH fetal'],
    [/acidose (fetal|neonatal)/gi, 'fetal acidosis'],
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
    [/enfermagem/gi, 'nursing'],
    [/odontologia/gi, 'dentistry'],
    [/farmac[êe]utico/gi, 'pharmaceutical'],
    [/obstetr[íi]cia|obst[eé]trico/gi, 'obstetrics'],
    [/gesta[cç][aã]o|gestante/gi, 'pregnancy'],
    [/neonatal|rec[eé]m-nascido/gi, 'neonatal newborn'],
    // Direito
    [/jurisprud[eê]ncia/gi, 'case law jurisprudence'],
    [/direito constitucional/gi, 'constitutional law'],
    [/direito penal/gi, 'criminal law'],
    [/direito civil/gi, 'civil law'],
    [/direito do trabalho/gi, 'labor law'],
    [/direito tribut[aá]rio/gi, 'tax law'],
    [/direito administrativo/gi, 'administrative law'],
    [/direito ambiental/gi, 'environmental law'],
    [/responsabilidade civil/gi, 'civil liability'],
    [/propriedade intelectual/gi, 'intellectual property'],
    // Educação
    [/educa[cç][aã]o física/gi, 'physical education'],
    [/educa[cç][aã]o básica/gi, 'basic education'],
    [/educa[cç][aã]o superior/gi, 'higher education'],
    [/pedagogia/gi, 'pedagogy'],
    [/did[aá]tica/gi, 'didactics teaching methods'],
    [/alfabetiza[cç][aã]o/gi, 'literacy reading acquisition'],
    [/forma[cç][aã]o de professores/gi, 'teacher training education'],
    [/tecnologia educacional/gi, 'educational technology'],
    // Agronomia
    [/agronomia/gi, 'agronomy'],
    [/agricultura/gi, 'agriculture'],
    [/zootecnia/gi, 'animal science'],
    [/irriga[cç][aã]o/gi, 'irrigation water management'],
    [/colheita|safra/gi, 'harvest crop yield'],
    [/soja/gi, 'soybean'],
    [/milho/gi, 'corn maize'],
    [/fitopatologia/gi, 'plant pathology'],
    // Ed. Física / Esporte
    [/treinamento (esportivo|desportivo|f[ií]sico)/gi, 'sports training'],
    [/exerc[ií]cio f[ií]sico/gi, 'physical exercise'],
    [/atividade f[ií]sica/gi, 'physical activity'],
    [/biomec[aâ]nica/gi, 'biomechanics'],
    [/obesidade/gi, 'obesity'],
    // Psicologia
    [/psicologia/gi, 'psychology'],
    [/ansiedade/gi, 'anxiety disorder'],
    [/depress[aã]o/gi, 'depression'],
    [/autismo|transtorno do espectro autista/gi, 'autism spectrum disorder'],
    [/burnout/gi, 'burnout occupational stress'],
    // Engenharia
    [/engenharia civil/gi, 'civil engineering'],
    [/engenharia mec[aâ]nica/gi, 'mechanical engineering'],
    [/engenharia el[eé]trica/gi, 'electrical engineering'],
    [/engenharia de software/gi, 'software engineering'],
    [/concreto armado/gi, 'reinforced concrete'],
    [/energia renov[aá]vel/gi, 'renewable energy'],
    // Administração
    [/administra[cç][aã]o/gi, 'business administration management'],
    [/gest[aã]o/gi, 'management'],
    [/marketing/gi, 'marketing'],
    [/lideran[cç]a/gi, 'leadership'],
    [/contabilidade/gi, 'accounting'],
    [/log[ií]stica/gi, 'logistics supply chain'],
    [/empreendedorismo/gi, 'entrepreneurship'],
    // Nutrição
    [/nutri[cç][aã]o/gi, 'nutrition'],
    [/alimento[s]? ultraprocessado[s]?/gi, 'ultra-processed food'],
    [/seguran[cç]a alimentar/gi, 'food security'],
    // Sociais / Humanas
    [/sociologia/gi, 'sociology'],
    [/antropologia/gi, 'anthropology'],
    [/pol[ií]tica (p[uú]blica)?/gi, 'public policy'],
    [/desigualdade social/gi, 'social inequality'],
    [/economia/gi, 'economics'],
    // Metodologia (qualquer área)
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

/** Detecta área biomédica — PubMed só é útil para saúde/biologia. */
export function isBiomedical(texto: string): boolean {
  return /sa[uú]de|m[eé]dic|medicina|cl[ií]nic|hospital|enfermagem|farmac|nutri[cç]|odontol|veterin|fisioterap|psicolog|biolog|bioqu[ií]m|fisiolog|obstet|anestesi|cirurg/i.test(texto)
}

const SECAO_KEYWORDS: Record<string, string[]> = {
  introducao:           ['review', 'background', 'epidemiology', 'prevalence'],
  revisao_literatura:   ['review', 'evidence', 'systematic review', 'literature'],
  referencial_teorico:  ['theory', 'theoretical framework', 'conceptual model'],
  metodologia:          ['methods', 'methodology', 'research design', 'validation'],
  resultados:           ['results', 'findings', 'outcomes', 'data'],
  discussao:            ['discussion', 'comparison', 'implications', 'mechanism'],
  conclusao:            ['conclusions', 'recommendations', 'future research'],
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

/**
 * Garante que o trabalho tenha um conjunto de referências reais.
 * Se já houver ≥ `limiar`, retorna as existentes. Caso contrário, busca em
 * CrossRef/PubMed, salva no banco e retorna a lista combinada.
 */
export async function garantirReferenciasReais({
  supabase,
  trabalhoId,
  titulo,
  area,
  tipoTrabalho,
  chaveSecao = 'revisao_literatura',
  pergunta,
  refsExistentes,
  meta = 40,
  limiar = 30,
}: GarantirRefsParams): Promise<Referencia[]> {
  let referencias = [...refsExistentes]
  if (referencias.length >= limiar) return referencias

  try {
    const areaStr = (area ?? '').trim()
    const tituloStr = (titulo ?? '').trim()
    const perguntaStr = (pergunta ?? '').trim()
    const tituloEN = toEnglishQuery(tituloStr)
    const areaEN = toEnglishQuery(areaStr)
    const perguntaEN = toEnglishQuery(perguntaStr)
    const ehBiomedico = isBiomedical(`${areaStr} ${tituloStr} ${perguntaStr}`)

    const queries: string[] = []
    if (tituloEN.length > 8) queries.push(tituloEN)
    if (tituloStr && tituloStr !== tituloEN && tituloStr.length > 8) queries.push(tituloStr)
    if (perguntaEN.length > 10 && perguntaEN !== tituloEN) queries.push(perguntaEN.slice(0, 120))
    const secKws = SECAO_KEYWORDS[chaveSecao] ?? ['research']
    if (areaEN) queries.push(`${areaEN} ${secKws[0]}`)
    if (areaStr && areaStr !== areaEN) queries.push(`${areaStr} ${secKws[0]}`)
    const tipoKw: Record<string, string> = {
      revisao_sistematica: 'systematic review meta-analysis',
      artigo_original:     'original research clinical study',
      relato_caso:         'case report',
      dissertacao_mestrado: 'cohort study',
      tese_doutorado:      'clinical trial',
    }
    if (tipoTrabalho && tipoKw[tipoTrabalho] && areaEN) queries.push(`${areaEN} ${tipoKw[tipoTrabalho]}`)
    if (areaEN && secKws[1]) queries.push(`${areaEN} ${secKws[1]}`)

    const seen = new Set<string>()
    const queriesValidas = queries
      .map(q => q.trim())
      .filter(q => q.length >= 6 && !seen.has(q.toLowerCase().slice(0, 50)) && seen.add(q.toLowerCase().slice(0, 50)))
      .slice(0, 6)

    if (queriesValidas.length === 0) return referencias

    const resultados = await Promise.all(
      queriesValidas.map(q => buscarRefsExternas(q, 8, !ehBiomedico))
    )

    const vistosDois = new Set<string>(referencias.map(r => r.doi ?? '').filter(Boolean))
    const vistosTitulos = new Set<string>(referencias.map(r => r.titulo.toLowerCase().slice(0, 80)))

    const refsUnicas = resultados.flat().filter(ref => {
      if (!ref.titulo || ref.titulo.length < 5) return false
      const tk = ref.titulo.toLowerCase().slice(0, 80)
      if (vistosTitulos.has(tk)) return false
      vistosTitulos.add(tk)
      if (ref.doi) {
        if (vistosDois.has(ref.doi)) return false
        vistosDois.add(ref.doi)
      }
      return true
    }).slice(0, meta - referencias.length)

    if (refsUnicas.length === 0) return referencias

    const inserir = refsUnicas.map(ref => {
      const parcial = {
        id: '', trabalho_id: trabalhoId, dados_extras: {},
        confiabilidade: 'alta' as const, created_at: '',
        referencia_formatada_abnt: '', referencia_formatada_vancouver: '', referencia_formatada_apa: '',
        ...ref,
      } as Referencia
      return {
        trabalho_id: trabalhoId,
        tipo: ref.tipo,
        titulo: ref.titulo,
        autores: ref.autores ?? [],
        ano: ref.ano,
        journal: ref.journal,
        volume: ref.volume,
        numero: ref.numero,
        paginas: ref.paginas,
        doi: ref.doi,
        pmid: ref.pmid,
        editora: ref.editora,
        isbn: ref.isbn,
        dados_extras: {},
        fonte_tipo: ref.fonte_tipo,
        confiabilidade: 'alta',
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
  } catch (err) {
    console.error('[auto-import] Falha:', err)
  }

  return referencias
}
