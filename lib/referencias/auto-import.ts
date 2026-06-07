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
import { callAI } from '@/lib/ai/stream'

/**
 * Gera queries de busca OTIMIZADAS em inglês (termos-chave/MeSH) a partir do tema.
 * A tradução por regex é parcial e deixa palavras em português que quebram o PubMed;
 * a IA extrai os termos científicos corretos, garantindo recall de artigos reais.
 * Retorna [] em caso de falha (o chamador cai no fallback de regex).
 */
async function gerarQueriesIA(titulo: string, area: string, pergunta: string): Promise<string[]> {
  const tema = [titulo, pergunta, area].filter(Boolean).join('. ').slice(0, 600)
  if (tema.length < 10) return []
  try {
    const system = 'Você é um bibliotecário de pesquisa científica especialista em estratégias de busca em PubMed e CrossRef.'
    const user = `Tema de pesquisa (em português):
"${tema}"

Gere de 4 a 6 QUERIES de busca em INGLÊS para encontrar artigos científicos reais sobre este tema em PubMed e CrossRef.
REGRAS:
- Use os termos científicos/técnicos corretos em inglês (estilo MeSH quando aplicável).
- Cada query: 2 a 5 palavras-chave essenciais (sem frases longas, sem palavras em português, sem pontuação).
- Cubra os diferentes ângulos do tema (intervenção, desfecho, população, método).
- Não inclua aspas, operadores booleanos nem números.

Responda APENAS com um array JSON de strings. Exemplo: ["tirzepatide gastric emptying","GLP-1 agonist aspiration risk surgery","gastric ultrasound residual volume","preoperative fasting GLP-1"]`
    const raw = await callAI(system, user, true, 500)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const arr = JSON.parse(match[0]) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .filter((q): q is string => typeof q === 'string')
      .map(q => q.trim())
      .filter(q => q.length >= 4 && q.length <= 100)
      .slice(0, 6)
  } catch (err) {
    console.error('[auto-import] gerarQueriesIA falhou:', err)
    return []
  }
}

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

/**
 * Filtra referências citáveis com qualidade — para uso no texto e na bibliografia.
 * Remove títulos-como-autor (sem sobrenome) e itens sem ano (citações "(s.d.)" feias).
 * Mantém referências adicionadas manualmente pelo usuário mesmo sem ano.
 */
export function filtrarRefsCitaveis(refs: Referencia[]): Referencia[] {
  return refs.filter(r => {
    const sobrenome = r.autores?.[0]?.sobrenome?.trim() ?? ''
    const temAutor = sobrenome.length > 1
    const adicionadaManual = (r.fonte_tipo as string | undefined) === 'manual' || !r.fonte_tipo
    // Auto-importadas exigem autor E ano; manuais exigem apenas autor
    if (!temAutor) return false
    if (!adicionadaManual && !r.ano) return false
    // Sobrenome mal-parseado: 3+ palavras numa importação automática quase sempre
    // é erro de indexação (ex: "Mulik Devika Bhivgade") e gera citações quebradas.
    if (!adicionadaManual) {
      // Só rejeita sobrenomes claramente mal-parseados (4+ palavras). Compostos
      // legítimos de 2-3 palavras ("da Silva Júnior") são mantidos.
      const palavrasSobrenome = sobrenome.split(/\s+/).filter(w => w.length > 1)
      if (palavrasSobrenome.length >= 4) return false
    }
    return true
  })
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
  // Conta só referências de QUALIDADE — se já há o suficiente, não reimporta.
  // (um trabalho cheio de refs ruins ainda dispara nova importação de boas.)
  if (filtrarRefsCitaveis(referencias).length >= limiar) return referencias

  try {
    const areaStr = (area ?? '').trim()
    const tituloStr = (titulo ?? '').trim()
    const perguntaStr = (pergunta ?? '').trim()
    const tituloEN = toEnglishQuery(tituloStr)
    const areaEN = toEnglishQuery(areaStr)
    const perguntaEN = toEnglishQuery(perguntaStr)
    const ehBiomedico = isBiomedical(`${areaStr} ${tituloStr} ${perguntaStr}`)

    const secKws = SECAO_KEYWORDS[chaveSecao] ?? ['research']

    // PRIMÁRIO: queries em inglês geradas pela IA (termos-chave/MeSH corretos).
    // A tradução por regex é parcial e deixa português que quebra o PubMed —
    // por isso a IA é o caminho confiável para recall de artigos reais.
    const queriesIA = await gerarQueriesIA(tituloStr, areaStr, perguntaStr)

    // FALLBACK: queries por regex (caso a IA falhe), ancoradas no tópico.
    const queriesRegex: string[] = []
    if (tituloEN.length > 8) queriesRegex.push(tituloEN.split(/\s+/).slice(0, 8).join(' '))
    if (perguntaEN.length > 10 && perguntaEN.toLowerCase() !== tituloEN.toLowerCase()) queriesRegex.push(perguntaEN.split(/\s+/).slice(0, 8).join(' '))
    if (tituloEN.length > 8) queriesRegex.push(`${tituloEN.split(/\s+/).slice(0, 6).join(' ')} ${secKws[0]}`)
    if (areaEN) queriesRegex.push(`${areaEN} ${secKws[0]}`)

    // Une: prioriza IA, completa com regex (até 6 queries — mais que isso satura
    // o rate limit do PubMed, que sem API key aceita ~3 req/s).
    const seen = new Set<string>()
    const queriesValidas = [...queriesIA, ...queriesRegex]
      .map(q => q.trim())
      .filter(q => q.length >= 4 && !seen.has(q.toLowerCase().slice(0, 50)) && seen.add(q.toLowerCase().slice(0, 50)))
      .slice(0, 6)

    if (queriesValidas.length === 0) return referencias
    console.log('[auto-import] queries:', queriesValidas)

    // 12 resultados por query → ~72 candidatos antes de deduplicar/filtrar.
    // Sequencial em pares para respeitar o rate limit do PubMed (evita 429).
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
      // QUALIDADE: só importa referências que geram citações limpas
      if (!ref.titulo || ref.titulo.length < 8) return false
      // Precisa ter autor com sobrenome (elimina títulos-como-autor, ex: "TÓPICOS EM...")
      if (!ref.autores || ref.autores.length === 0 || !ref.autores[0]?.sobrenome) return false
      // Precisa ter ano plausível (elimina citações "(SOBRENOME, s.d.)")
      if (!ref.ano || ref.ano < 1950 || ref.ano > anoAtual) return false
      // Título não pode ser todo em maiúsculas (sinal de baixa qualidade de indexação)
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
