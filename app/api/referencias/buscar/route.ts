/**
 * /api/referencias/buscar
 *
 * Busca referências REAIS em bases acadêmicas externas:
 *   - CrossRef  (130M+ artigos, livros, conferências)
 *   - PubMed    (NCBI — saúde, biomedicina, ciências da vida)
 *   - OpenAlex  (acesso aberto, multidisciplinar)
 *
 * Normaliza os resultados para o formato interno Referencia
 * sem salvar nada — o cliente escolhe o que importar.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AutorReferencia, TipoReferencia } from '@/types'

// ── Tipos internos ─────────────────────────────────────────────────────────────

export type ResultadoBusca = {
  tipo: TipoReferencia
  titulo: string
  autores?: AutorReferencia[]
  ano?: number
  journal?: string
  volume?: string
  numero?: string
  paginas?: string
  doi?: string
  pmid?: string
  url?: string
  editora?: string
  cidade?: string
  isbn?: string
  fonte_tipo: 'crossref' | 'pubmed' | 'openalex'
  confiabilidade: 'alta' | 'media' | 'baixa'
}

// ── Helper: extrai iniciais sem pontos (para formatadores) ─────────────────────

function calcIniciais(nome: string): string {
  return nome.trim().split(/\s+/).map(n => n.charAt(0).toUpperCase()).join('')
}

// ── CrossRef ───────────────────────────────────────────────────────────────────

async function buscarCrossRef(query: string, limite: number): Promise<ResultadoBusca[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(Math.min(limite, 20)),
      select: 'DOI,title,author,published,container-title,volume,issue,page,type,publisher,ISBN',
      // Polite pool — identifica a aplicação
      mailto: 'app@cientifica-ai.com',
    })

    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: { 'User-Agent': 'Cientifica-AI/1.0 (mailto:app@cientifica-ai.com)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return []
    const data = await res.json()
    const items: unknown[] = data?.message?.items ?? []

    const mapped: Array<ResultadoBusca | null> = items.map((item: unknown) => {
        const it = item as Record<string, unknown>
        const title = (it.title as string[])?.[0] ?? ''
        if (!title) return null

        const rawAuthors = (it.author as Array<Record<string, string>> | undefined) ?? []
        const autores: AutorReferencia[] = rawAuthors
          .filter(a => a.family)
          .map(a => ({
            nome:      a.given ?? '',
            sobrenome: a.family,
            iniciais:  calcIniciais(a.given ?? ''),
          }))

        const dateparts = (it.published as Record<string, unknown> | undefined)?.['date-parts'] as number[][] | undefined
        const ano = dateparts?.[0]?.[0]

        const containerTitles = it['container-title'] as string[] | undefined
        const journal = containerTitles?.[0]

        const rawType = (it.type as string) ?? 'journal-article'
        let tipo: TipoReferencia = 'artigo'
        if (rawType === 'book' || rawType === 'monograph') tipo = 'livro'
        else if (rawType === 'book-chapter') tipo = 'capitulo_livro'
        else if (rawType === 'proceedings-article') tipo = 'anais'

        const isbn = (it.ISBN as string[] | undefined)?.[0]

        const r: ResultadoBusca = {
          tipo,
          titulo:    title,
          autores:   autores.length ? autores : undefined,
          ano,
          journal:   tipo === 'artigo' || tipo === 'anais' ? journal : undefined,
          editora:   tipo === 'livro' || tipo === 'capitulo_livro' ? (it.publisher as string | undefined) ?? journal : undefined,
          volume:    it.volume as string | undefined,
          numero:    it.issue  as string | undefined,
          paginas:   it.page   as string | undefined,
          doi:       it.DOI    as string | undefined,
          isbn,
          fonte_tipo: 'crossref',
          confiabilidade: 'alta',
        }
        return r
      })
    return mapped.filter((r): r is ResultadoBusca => r !== null && Boolean(r.titulo))
  } catch (err) {
    console.error('[CrossRef] Erro:', err)
    return []
  }
}

// ── PubMed (NCBI Entrez) ───────────────────────────────────────────────────────

async function buscarPubMed(query: string, limite: number): Promise<ResultadoBusca[]> {
  try {
    // Passo 1 — busca IDs
    const searchParams = new URLSearchParams({
      db:      'pubmed',
      term:    query,
      retmax:  String(Math.min(limite, 20)),
      retmode: 'json',
    })
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!searchRes.ok) return []

    const searchData = await searchRes.json()
    const ids: string[] = searchData?.esearchresult?.idlist ?? []
    if (!ids.length) return []

    // Passo 2 — sumários
    const summaryParams = new URLSearchParams({
      db:      'pubmed',
      id:      ids.join(','),
      retmode: 'json',
    })
    const summaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!summaryRes.ok) return []

    const summaryData = await summaryRes.json()
    const articles = (summaryData?.result ?? {}) as Record<string, Record<string, unknown>>

    const pubmedResults: ResultadoBusca[] = []
    for (const id of ids) {
        const art = articles[id]
        if (!art || typeof art !== 'object') continue

        const rawAuthors = (art.authors as Array<Record<string, string>> | undefined) ?? []
        const autores: AutorReferencia[] = rawAuthors
          .filter(a => a.authtype === 'Author' && a.name)
          .map(a => {
            const parts = (a.name as string).split(' ')
            const sobrenome = parts[0] ?? ''
            const iniciais  = (parts.slice(1).join('') || '').toUpperCase()
            return { nome: iniciais, sobrenome, iniciais }
          })

        const articleIds = (art.articleids as Array<Record<string, string>> | undefined) ?? []
        const doi = articleIds.find(aid => aid.idtype === 'doi')?.value

        const pubdate = (art.pubdate as string | undefined) ?? ''
        const anoRaw = pubdate ? parseInt(pubdate.split(' ')[0]) : undefined
        const ano = anoRaw && !isNaN(anoRaw) ? anoRaw : undefined

        const titulo = ((art.title as string) ?? '').replace(/\.$/, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        if (!titulo) continue

        pubmedResults.push({
          tipo: 'artigo',
          titulo,
          autores: autores.length ? autores : undefined,
          ano,
          journal: art.source as string | undefined,
          volume:  art.volume as string | undefined,
          numero:  art.issue  as string | undefined,
          paginas: art.pages  as string | undefined,
          doi,
          pmid:    id,
          fonte_tipo:     'pubmed',
          confiabilidade: 'alta',
        })
      }
    return pubmedResults
  } catch (err) {
    console.error('[PubMed] Erro:', err)
    return []
  }
}

// ── OpenAlex ───────────────────────────────────────────────────────────────────

async function buscarOpenAlex(query: string, limite: number): Promise<ResultadoBusca[]> {
  try {
    const params = new URLSearchParams({
      search:     query,
      'per-page': String(Math.min(limite, 20)),
      select:     'title,authorships,publication_year,doi,primary_location,biblio,type',
    })

    const res = await fetch(`https://api.openalex.org/works?${params}`, {
      headers: { 'User-Agent': 'Cientifica-AI/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []

    const data = await res.json()
    const results = (data?.results ?? []) as Array<Record<string, unknown>>

    const openAlexResults: ResultadoBusca[] = []
    for (const item of results) {
        const titulo = (item.title as string | undefined) ?? ''
        if (!titulo) continue

        const authorships = (item.authorships as Array<Record<string, unknown>> | undefined) ?? []
        const autores: AutorReferencia[] = authorships
          .map(a => {
            const displayName = ((a.author as Record<string, string> | undefined)?.display_name ?? '').trim()
            if (!displayName) return null
            const parts = displayName.split(' ')
            const sobrenome = parts[parts.length - 1] ?? displayName
            const nome = parts.slice(0, -1).join(' ')
            return { nome, sobrenome, iniciais: calcIniciais(nome) } as AutorReferencia
          })
          .filter((a): a is AutorReferencia => a !== null)

        const doi = (item.doi as string | undefined)?.replace('https://doi.org/', '')
        const journal = ((item.primary_location as Record<string, unknown> | undefined)
          ?.source as Record<string, string> | undefined)?.display_name
        const biblio = (item.biblio as Record<string, string | undefined> | undefined) ?? {}

        const paginas = biblio.first_page && biblio.last_page
          ? `${biblio.first_page}-${biblio.last_page}`
          : biblio.first_page

        const rawType = (item.type as string) ?? 'article'
        let tipo: TipoReferencia = 'artigo'
        if (rawType === 'book') tipo = 'livro'
        else if (rawType === 'book-chapter') tipo = 'capitulo_livro'

        openAlexResults.push({
          tipo,
          titulo,
          autores: autores.length ? autores : undefined,
          ano:    item.publication_year as number | undefined,
          journal: tipo === 'artigo' ? journal : undefined,
          volume: biblio.volume,
          numero: biblio.issue,
          paginas,
          doi,
          fonte_tipo:    'openalex',
          confiabilidade: 'alta',
        })
      }
    return openAlexResults
  } catch (err) {
    console.error('[OpenAlex] Erro:', err)
    return []
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json() as {
    query:  string
    fonte?: 'todos' | 'crossref' | 'pubmed' | 'openalex'
    limite?: number
  }

  const { query, fonte = 'todos', limite = 12 } = body
  if (!query?.trim()) return NextResponse.json({ error: 'Query obrigatória' }, { status: 400 })

  // Busca em paralelo conforme a fonte solicitada
  const perFonte = fonte === 'todos' ? Math.ceil(limite / 2) : limite

  const [crossref, pubmed, openalex] = await Promise.all([
    (fonte === 'crossref' || fonte === 'todos') ? buscarCrossRef(query, perFonte) : Promise.resolve([]),
    (fonte === 'pubmed'   || fonte === 'todos') ? buscarPubMed(query, perFonte)   : Promise.resolve([]),
    (fonte === 'openalex')                      ? buscarOpenAlex(query, perFonte)  : Promise.resolve([]),
  ])

  // Intercala resultados para diversidade de fontes
  let resultados: ResultadoBusca[] = []
  const maxLen = Math.max(crossref.length, pubmed.length, openalex.length)
  for (let i = 0; i < maxLen; i++) {
    if (crossref[i])  resultados.push(crossref[i])
    if (pubmed[i])    resultados.push(pubmed[i])
    if (openalex[i])  resultados.push(openalex[i])
  }

  // Remove duplicatas pelo DOI
  const vistos = new Set<string>()
  resultados = resultados.filter(r => {
    if (!r.doi) return true
    if (vistos.has(r.doi)) return false
    vistos.add(r.doi)
    return true
  })

  return NextResponse.json({ resultados: resultados.slice(0, limite) })
}
