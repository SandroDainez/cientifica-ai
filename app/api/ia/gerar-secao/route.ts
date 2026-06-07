import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildSystemPrompt, buildGerarSecaoPrompt } from '@/lib/ai/prompts'
import { getSystemPromptEspecializado } from '@/lib/ai/prompts-secoes'
import { streamText, callAI } from '@/lib/ai/stream'
import { HUMANIZADOR_SYSTEM, buildHumanizadorPrompt } from '@/lib/ai/humanizar'
import { validarCitacoesReais } from '@/lib/ai/validar-citacoes'

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

    // Ordena conforme formato
    const { ordenarReferencias } = await import('@/lib/referencias/formatar')
    const refsOrdenadas = ordenarReferencias(referencias, formato)

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

  // ── Auto-importação de referências ────────────────────────────────────────
  // Busca AGRESSIVA em CrossRef + PubMed com 6-8 queries especializadas.
  // Objetivo: ≥ 25 referências REAIS antes de gerar qualquer seção.
  // O sistema nunca inventa referências — só usa o que encontrar nas bases.

  // Traduz termos acadêmicos PT → EN para melhorar buscas em bases internacionais.
  // Cobre TODAS as grandes áreas do conhecimento — não apenas medicina.
  function toEnglishQuery(texto: string): string {
    const map: Array<[RegExp, string]> = [
      // ── SAÚDE / MEDICINA ────────────────────────────────────────────────────
      [/intelig[eê]ncia artificial/gi, 'artificial intelligence'],
      [/aprendizado de m[aá]quina/gi, 'machine learning'],
      [/processamento de linguagem natural/gi, 'natural language processing'],
      [/unidade[s]? de terapia intensiva/gi, 'intensive care unit'],
      [/\bUTI\b/g, 'ICU'],
      [/carga de trabalho/gi, 'workload'],
      [/profissionais de sa[uú]de/gi, 'healthcare professionals'],
      [/mortalidade/gi, 'mortality'],
      [/morbidade/gi, 'morbidity'],
      [/esvaziamento g[aá]strico/gi, 'gastric emptying'],
      [/tirezepatida|tirzepatida/gi, 'tirzepatide'],
      [/agonista[s]? (do|dos|de) (receptor[es]? )?GLP/gi, 'GLP-1 receptor agonist'],
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
      [/neoplas[ia]/gi, 'neoplasm'],
      [/cirurgia/gi, 'surgery'],
      [/sa[uú]de mental/gi, 'mental health'],
      [/enfermagem/gi, 'nursing'],
      [/pacientes cr[ií]ticos/gi, 'critically ill patients'],
      [/odontologia/gi, 'dentistry'],
      [/peri?odontal/gi, 'periodontal'],
      [/farmac[êe]utico/gi, 'pharmaceutical'],
      [/veterinária/gi, 'veterinary medicine'],
      // ── DIREITO / CIÊNCIAS JURÍDICAS ───────────────────────────────────────
      [/jurisprud[eê]ncia/gi, 'case law jurisprudence'],
      [/direito constitucional/gi, 'constitutional law'],
      [/direito penal/gi, 'criminal law'],
      [/direito civil/gi, 'civil law'],
      [/direito do trabalho/gi, 'labor law'],
      [/direito tributário/gi, 'tax law'],
      [/direito administrativo/gi, 'administrative law'],
      [/direito ambiental/gi, 'environmental law'],
      [/direito internacional/gi, 'international law'],
      [/direito (de família|família)/gi, 'family law'],
      [/processo (civil|judicial)/gi, 'civil procedure'],
      [/processo penal/gi, 'criminal procedure'],
      [/senten[cç]a judicial/gi, 'judicial decision'],
      [/recurso (de apelaçã|extraordin|especial|de)/gi, 'judicial appeal'],
      [/habeas corpus/gi, 'habeas corpus'],
      [/contrato/gi, 'contract law'],
      [/responsabilidade civil/gi, 'civil liability'],
      [/propriedade intelectual/gi, 'intellectual property'],
      // ── EDUCAÇÃO / PEDAGOGIA ───────────────────────────────────────────────
      [/educa[cç][aã]o física/gi, 'physical education'],
      [/educa[cç][aã]o básica/gi, 'basic education'],
      [/educa[cç][aã]o superior/gi, 'higher education'],
      [/educa[cç][aã]o especial/gi, 'special education'],
      [/pedagogia/gi, 'pedagogy'],
      [/did[aá]tica/gi, 'didactics teaching methods'],
      [/curr[ií]culo escolar/gi, 'school curriculum'],
      [/aprendizagem/gi, 'learning'],
      [/letramento/gi, 'literacy'],
      [/alfabetiza[cç][aã]o/gi, 'literacy reading acquisition'],
      [/forma[cç][aã]o de professores/gi, 'teacher training education'],
      [/evas[aã]o escolar/gi, 'school dropout'],
      [/inclus[aã]o escolar/gi, 'school inclusion'],
      [/tecnologia educacional/gi, 'educational technology'],
      [/ensino a dist[aâ]ncia/gi, 'distance learning e-learning'],
      // ── AGRONOMIA / CIÊNCIAS AGRÁRIAS ──────────────────────────────────────
      [/agronomia/gi, 'agronomy'],
      [/agricultura (familiar)?/gi, 'agriculture'],
      [/zootecnia/gi, 'animal science zootechnics'],
      [/pecu[aá]ria/gi, 'livestock cattle production'],
      [/solo[s]? agr[ií]cola[s]?/gi, 'agricultural soil'],
      [/fertirreda[cç][aã]o|fertilizante/gi, 'fertilization fertilizer'],
      [/pesticida|agrot[oó]xico/gi, 'pesticide herbicide'],
      [/irriga[cç][aã]o/gi, 'irrigation water management'],
      [/colheita|safra/gi, 'harvest crop yield'],
      [/cultivar|variedade/gi, 'cultivar variety crop'],
      [/soja/gi, 'soybean'],
      [/milho/gi, 'corn maize'],
      [/cana-de-a[cç][uú]car/gi, 'sugarcane'],
      [/fitopatologia/gi, 'plant pathology'],
      [/fitoss?anidade/gi, 'plant health phytosanitary'],
      [/biot?ecnologia vegetal/gi, 'plant biotechnology'],
      [/gest[aã]o ambiental/gi, 'environmental management'],
      // ── EDUCAÇÃO FÍSICA / ESPORTE / CIÊNCIAS DO ESPORTE ───────────────────
      [/treinamento (esportivo|desportivo|f[ií]sico)/gi, 'sports training physical conditioning'],
      [/exerc[ií]cio f[ií]sico/gi, 'physical exercise'],
      [/atividade f[ií]sica/gi, 'physical activity'],
      [/condicionamento f[ií]sico/gi, 'physical conditioning fitness'],
      [/performance (esportiva)?/gi, 'athletic performance'],
      [/biomec[aâ]nica/gi, 'biomechanics'],
      [/fisiologia do exerc[ií]cio/gi, 'exercise physiology'],
      [/reabilita[cç][aã]o f[ií]sica/gi, 'physical rehabilitation'],
      [/obesidade/gi, 'obesity'],
      [/sedentarismo/gi, 'physical inactivity sedentary behavior'],
      // ── PSICOLOGIA ──────────────────────────────────────────────────────────
      [/psicologia/gi, 'psychology'],
      [/comportamento humano/gi, 'human behavior'],
      [/cogni[cç][aã]o|cognitivo/gi, 'cognition cognitive'],
      [/transtorno mental/gi, 'mental disorder'],
      [/ansiedade/gi, 'anxiety disorder'],
      [/depress[aã]o/gi, 'depression'],
      [/autismo|transtorno do espectro autista/gi, 'autism spectrum disorder'],
      [/terapia cognitivo-comportamental/gi, 'cognitive behavioral therapy CBT'],
      [/psicoterapia/gi, 'psychotherapy'],
      [/burnout/gi, 'burnout occupational stress'],
      // ── ENGENHARIA ──────────────────────────────────────────────────────────
      [/engenharia civil/gi, 'civil engineering'],
      [/engenharia mec[aâ]nica/gi, 'mechanical engineering'],
      [/engenharia el[eé]trica/gi, 'electrical engineering'],
      [/engenharia de software/gi, 'software engineering'],
      [/engenharia qu[ií]mica/gi, 'chemical engineering'],
      [/engenharia de produ[cç][aã]o/gi, 'production engineering industrial engineering'],
      [/resist[eê]ncia dos materiais/gi, 'materials strength mechanics'],
      [/concreto armado/gi, 'reinforced concrete structural engineering'],
      [/efici[eê]ncia energ[eé]tica/gi, 'energy efficiency'],
      [/energia renovável/gi, 'renewable energy'],
      [/circuito el[eé]trico/gi, 'electrical circuit'],
      [/automa[cç][aã]o industrial/gi, 'industrial automation'],
      // ── ADMINISTRAÇÃO / GESTÃO / CONTABILIDADE ──────────────────────────────
      [/administra[cç][aã]o/gi, 'business administration management'],
      [/gest[aã]o/gi, 'management'],
      [/marketing digital/gi, 'digital marketing'],
      [/marketing/gi, 'marketing'],
      [/lideran[cç]a/gi, 'leadership'],
      [/gest[aã]o de pessoas|recursos humanos/gi, 'human resources management'],
      [/contabilidade/gi, 'accounting'],
      [/finan[cç]as/gi, 'finance'],
      [/log[ií]stica/gi, 'logistics supply chain'],
      [/planejamento estrat[eé]gico/gi, 'strategic planning'],
      [/inova[cç][aã]o/gi, 'innovation entrepreneurship'],
      [/empreendedorismo/gi, 'entrepreneurship'],
      [/responsabilidade social/gi, 'corporate social responsibility'],
      // ── NUTRIÇÃO / ALIMENTAÇÃO ──────────────────────────────────────────────
      [/nutri[cç][aã]o/gi, 'nutrition'],
      [/dieta mediterr[aâ]nea/gi, 'Mediterranean diet'],
      [/alimento[s]? ultraprocessado[s]?/gi, 'ultra-processed food'],
      [/seguran[cç]a alimentar/gi, 'food security'],
      [/microbiota intestinal/gi, 'gut microbiota'],
      [/vitamina[s]?/gi, 'vitamins minerals supplementation'],
      // ── CIÊNCIAS SOCIAIS / HUMANAS ──────────────────────────────────────────
      [/sociologia/gi, 'sociology'],
      [/antropologia/gi, 'anthropology'],
      [/pol[ií]tica (p[uú]blica)?/gi, 'public policy'],
      [/desigualdade social/gi, 'social inequality'],
      [/movimentos sociais/gi, 'social movements'],
      [/g[eê]nero/gi, 'gender studies'],
      [/racismo|preconceito racial/gi, 'racism racial discrimination'],
      [/economia/gi, 'economics'],
      [/desenvolvimento econ[oô]mico/gi, 'economic development'],
      [/pobreza/gi, 'poverty'],
      [/hist[oó]ria/gi, 'history historical'],
      [/comunicação (social)?/gi, 'communication media studies'],
      // ── METODOLOGIA CIENTÍFICA (qualquer área) ──────────────────────────────
      [/revis[aã]o sistem[aá]tica/gi, 'systematic review'],
      [/meta-an[aá]lise/gi, 'meta-analysis'],
      [/ensaio cl[ií]nico randomizado/gi, 'randomized controlled trial'],
      [/ensaio cl[ií]nico/gi, 'clinical trial'],
      [/estudo (observacional|transversal)/gi, 'observational study cross-sectional'],
      [/estudo de caso/gi, 'case study'],
      [/coorte/gi, 'cohort study'],
      [/pesquisa qualitativa/gi, 'qualitative research'],
      [/pesquisa quantitativa/gi, 'quantitative research'],
      [/pesquisa-a[cç][aã]o/gi, 'action research'],
      [/etnografia/gi, 'ethnography'],
      [/grupos focais/gi, 'focus groups'],
      [/question[aá]rio/gi, 'questionnaire survey'],
      [/an[aá]lise de conte[uú]do/gi, 'content analysis'],
      [/an[aá]lise de discurso/gi, 'discourse analysis'],
    ]
    let q = texto
    for (const [pt, en] of map) q = q.replace(pt, en)
    return q
  }

  // Detecta se a área é biomédica (PubMed é útil) ou de outra área (CrossRef apenas)
  function isBiomedical(texto: string): boolean {
    const bioTerms = /sa[uú]de|m[eé]dico|medicina|cl[ií]nico|hospital|enfermagem|farmac|nutri[cç]|odontol|veterinári|fisioterapia|psicologia|biologia|bioqu[ií]mica|fisiologia/i
    return bioTerms.test(texto)
  }

  // Keywords por seção — campo-neutras, funcionam em QUALQUER área do conhecimento
  const SECAO_KEYWORDS: Record<string, string[]> = {
    introducao:            ['review', 'background', 'context', 'state of the art'],
    revisao_literatura:    ['review', 'evidence', 'analysis', 'literature'],
    referencial_teorico:   ['theory', 'theoretical framework', 'conceptual model'],
    metodologia:           ['methods', 'methodology', 'research design', 'data collection'],
    metodos_delineamento:  ['study design', 'research design', 'sampling', 'protocol'],
    metodos_coleta:        ['data collection', 'instrument', 'measurement', 'validation'],
    resultados:            ['results', 'findings', 'data', 'outcomes'],
    discussao:             ['discussion', 'analysis', 'implications', 'comparison'],
    conclusao:             ['conclusions', 'recommendations', 'future research'],
    aspectos_eticos:       ['ethics', 'informed consent', 'research ethics'],
    estrategia_busca:      ['search strategy', 'systematic search', 'database', 'PRISMA'],
    pergunta_pico:         ['research question', 'PICO', 'PICOS', 'clinical question'],
    risco_vies:            ['bias assessment', 'quality assessment', 'risk of bias'],
    desenvolvimento:       ['analysis', 'discussion', 'theoretical analysis'],
    consideracoes_finais:  ['conclusion', 'final considerations', 'implications'],
    justificativa:         ['relevance', 'rationale', 'significance', 'importance'],
    objetivos:             ['objectives', 'aims', 'goals', 'hypothesis'],
    problema:              ['problem', 'research gap', 'knowledge gap'],
    tema:                  ['topic', 'research area', 'subject'],
    resumo:                ['abstract', 'summary', 'overview'],
  }

  // Alvo: 30 referências reais. Roda se tiver menos de 25.
  const META_REFS = 30
  const LIMIAR_IMPORTAR = 25

  if (referencias.length < LIMIAR_IMPORTAR) {
    try {
      const queries: string[] = []
      const area = trabalho.area_conhecimento?.trim() ?? ''
      const titulo = trabalho.titulo?.trim() ?? ''
      const tituloEN = toEnglishQuery(titulo)
      const areaEN = toEnglishQuery(area)
      const pergunta = dados_projeto?.pergunta_pesquisa?.trim() ?? ''
      const perguntaEN = toEnglishQuery(pergunta)

      // Detecta se é área biomédica — PubMed é útil só para saúde/biologia
      const ehBiomedico = isBiomedical(area + ' ' + titulo)

      // Query 1: título traduzido para inglês
      if (tituloEN && tituloEN.length > 8) queries.push(tituloEN)

      // Query 2: título em português (CrossRef indexa artigos BR muito bem)
      if (titulo && titulo !== tituloEN && titulo.length > 8) queries.push(titulo)

      // Query 3: pergunta de pesquisa traduzida
      if (perguntaEN && perguntaEN.length > 10 && perguntaEN !== tituloEN) queries.push(perguntaEN.slice(0, 120))

      // Query 4: área + keywords específicas da seção
      const secKws = SECAO_KEYWORDS[chaveSecao] ?? ['research']
      if (areaEN) queries.push(`${areaEN} ${secKws[0]}`)
      if (area && area !== areaEN) queries.push(`${area} ${secKws[0]}`)

      // Query 5: tipo de trabalho + área — usa design de estudo apropriado para cada campo
      const tipoKwBio: Record<string, string> = {
        revisao_sistematica:   'systematic review meta-analysis',
        artigo_original:       'original research clinical study',
        relato_caso:           'case report',
      }
      const tipoKwGeral: Record<string, string> = {
        revisao_sistematica:   'systematic review literature analysis',
        artigo_original:       'original research empirical study',
        relato_caso:           'case study single case',
        dissertacao_mestrado:  'master thesis empirical study',
        tese_doutorado:        'doctoral thesis original research',
      }
      const tkw = ehBiomedico
        ? (tipoKwBio[trabalho.tipo_trabalho] ?? tipoKwGeral[trabalho.tipo_trabalho])
        : tipoKwGeral[trabalho.tipo_trabalho]
      if (tkw && areaEN) queries.push(`${areaEN} ${tkw}`)

      // Query 6: seção específica + área em inglês
      if (areaEN && secKws[1]) queries.push(`${areaEN} ${secKws[1]}`)

      // Filtra queries válidas (mínimo 6 chars, sem repetições)
      const queriesSet = new Set<string>()
      const queriesValidas = queries
        .map(q => q.trim())
        .filter(q => q.length >= 6 && !queriesSet.has(q.toLowerCase().slice(0, 50)) && queriesSet.add(q.toLowerCase().slice(0, 50)))
        .slice(0, 6)

      if (queriesValidas.length > 0) {
        console.log(`[gerar-secao] Auto-import: ${queriesValidas.length} queries, biomedico=${ehBiomedico}, meta: ${META_REFS}`)

        // Busca paralela: para áreas não-biomédicas usa CrossRef com mais resultados
        // (PubMed retorna 0 para direito, educação, agronomia, etc.)
        const resultados = await Promise.all(
          queriesValidas.map(q => buscarRefsExternas(q, 8, !ehBiomedico))
        )

        // Achata e deduplica por DOI (primário) e título truncado (fallback)
        const vistosDois    = new Set<string>(referencias.map(r => r.doi ?? '').filter(Boolean))
        const vistosTitulos = new Set<string>(referencias.map(r => r.titulo.toLowerCase().slice(0, 80)))

        const refsUnicas = resultados.flat().filter(ref => {
          if (!ref.titulo || ref.titulo.length < 5) return false
          const titleKey = ref.titulo.toLowerCase().slice(0, 80)
          if (vistosTitulos.has(titleKey)) return false
          vistosTitulos.add(titleKey)
          if (ref.doi) {
            if (vistosDois.has(ref.doi)) return false
            vistosDois.add(ref.doi)
          }
          return true
        }).slice(0, META_REFS - referencias.length)

        if (refsUnicas.length > 0) {
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
    trabalho.formato_citacao,
    trabalho.area_conhecimento ?? undefined,
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
