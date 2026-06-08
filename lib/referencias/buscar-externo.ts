/**
 * lib/referencias/buscar-externo.ts
 *
 * Funções de busca em bases acadêmicas externas (CrossRef, PubMed).
 * Usadas tanto pela rota manual /api/referencias/buscar quanto pela
 * geração automática em /api/ia/gerar-secao (quando o trabalho não tem refs).
 */

import type { AutorReferencia, TipoReferencia } from '@/types'
import { limparAutoresPlaceholder, ehTituloDescartavel } from './qualidade'

export interface RefExterna {
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
  editora?: string
  isbn?: string
  url?: string
  fonte_tipo: 'crossref' | 'pubmed' | 'openalex'
}

// ── Helper ──────────────────────────────────────────────────────────────────

function calcIniciais(nome: string): string {
  return nome.trim().split(/\s+/).map(n => n.charAt(0).toUpperCase()).join('')
}

// ── CrossRef ────────────────────────────────────────────────────────────────

export async function buscarCrossRef(query: string, limite: number): Promise<RefExterna[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows:   String(Math.min(limite, 20)),
      select: 'DOI,title,author,published,container-title,volume,issue,page,type,publisher,ISBN',
      mailto: 'app@cientifica-ai.com',
    })

    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: { 'User-Agent': 'Cientifica-AI/1.0 (mailto:app@cientifica-ai.com)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const items: unknown[] = data?.message?.items ?? []

    const mapped: Array<RefExterna | null> = items.map((item: unknown) => {
      const it = item as Record<string, unknown>
      const title = (it.title as string[])?.[0] ?? ''
      if (!title) return null
      // Descarta registros que não são o artigo original (recomendação Faculty
      // Opinions, errata, retratação, comentário, resposta de autor…).
      if (ehTituloDescartavel(title)) return null

      const rawAuthors = (it.author as Array<Record<string, string>> | undefined) ?? []
      const autores: AutorReferencia[] = limparAutoresPlaceholder(
        rawAuthors
          .filter(a => a.family)
          .map(a => ({ nome: a.given ?? '', sobrenome: a.family, iniciais: calcIniciais(a.given ?? '') })),
      )
      // Sem nenhum autor real (ex.: "Reactions Weekly" com autor "&NA;") → descarta.
      if (autores.length === 0) return null

      const dateparts = (it.published as Record<string, unknown> | undefined)?.['date-parts'] as number[][] | undefined
      const ano = dateparts?.[0]?.[0]

      const journal = (it['container-title'] as string[] | undefined)?.[0]
      const rawType = (it.type as string) ?? 'journal-article'
      let tipo: TipoReferencia = 'artigo'
      if (rawType === 'book' || rawType === 'monograph') tipo = 'livro'
      else if (rawType === 'book-chapter') tipo = 'capitulo_livro'
      else if (rawType === 'proceedings-article') tipo = 'anais'

      return {
        tipo,
        titulo:  title,
        autores: autores.length ? autores : undefined,
        ano,
        // Para capítulo de livro, container-title é o TÍTULO DO LIVRO → guardamos
        // em `journal` (o formatador ABNT usa como título do livro). Editora = só publisher.
        journal:  tipo === 'artigo' || tipo === 'anais' || tipo === 'capitulo_livro' ? journal : undefined,
        editora:  tipo === 'livro' || tipo === 'capitulo_livro'
          ? (it.publisher as string | undefined)
          : undefined,
        volume:   it.volume as string | undefined,
        numero:   it.issue  as string | undefined,
        paginas:  it.page   as string | undefined,
        doi:      it.DOI    as string | undefined,
        isbn:     (it.ISBN as string[] | undefined)?.[0],
        fonte_tipo: 'crossref' as const,
      }
    })

    return mapped.filter((r): r is RefExterna => r !== null)
  } catch (err) {
    console.error('[CrossRef] Erro:', err)
    return []
  }
}

// ── PubMed ──────────────────────────────────────────────────────────────────

export async function buscarPubMed(query: string, limite: number): Promise<RefExterna[]> {
  try {
    const searchParams = new URLSearchParams({
      db: 'pubmed', term: query, retmax: String(Math.min(limite, 20)), retmode: 'json',
    })
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      { signal: AbortSignal.timeout(6000) },
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const ids: string[] = searchData?.esearchresult?.idlist ?? []
    if (!ids.length) return []

    const summaryParams = new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'json' })
    const summaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`,
      { signal: AbortSignal.timeout(6000) },
    )
    if (!summaryRes.ok) return []
    const summaryData = await summaryRes.json()
    const articles = (summaryData?.result ?? {}) as Record<string, Record<string, unknown>>

    const results: RefExterna[] = []
    for (const id of ids) {
      const art = articles[id]
      if (!art) continue

      const rawAuthors = (art.authors as Array<Record<string, string>> | undefined) ?? []
      const autores: AutorReferencia[] = limparAutoresPlaceholder(
        rawAuthors
          // Inclui qualquer autor com nome que NÃO seja nome coletivo (mais permissivo
          // que exigir authtype === 'Author', que descartava refs válidas).
          .filter(a => a.name && a.authtype !== 'CollectiveName')
          .map(a => {
            const parts = (a.name as string).trim().split(/\s+/)
            // Formato PubMed: "Sobrenome Iniciais" (ex: "Smith JD") → sobrenome = parts[0]
            return { nome: parts.slice(1).join(' '), sobrenome: parts[0] ?? '', iniciais: parts.slice(1).join('').toUpperCase() }
          }),
      )

      const articleIds = (art.articleids as Array<Record<string, string>> | undefined) ?? []
      const doi = articleIds.find(a => a.idtype === 'doi')?.value

      // Ano: tenta pubdate, depois epubdate, depois sortpubdate — pega o 1º com 4 dígitos
      const datas = [art.pubdate, art.epubdate, art.sortpubdate].filter(Boolean) as string[]
      let ano: number | undefined
      for (const d of datas) {
        const m = d.match(/(19|20)\d{2}/)
        if (m) { ano = parseInt(m[0]); break }
      }

      const titulo = ((art.title as string) ?? '').replace(/\.$/, '')
      if (!titulo) continue
      // Descarta não-originais (errata, recomendação…) e registros sem autor real.
      if (ehTituloDescartavel(titulo)) continue
      if (autores.length === 0) continue

      results.push({
        tipo:        'artigo',
        titulo,
        autores:     autores.length ? autores : undefined,
        ano,
        journal:     art.source as string | undefined,
        volume:      art.volume as string | undefined,
        numero:      art.issue  as string | undefined,
        paginas:     art.pages  as string | undefined,
        doi,
        pmid:        id,
        fonte_tipo:  'pubmed' as const,
      })
    }
    return results
  } catch (err) {
    console.error('[PubMed] Erro:', err)
    return []
  }
}

// ── Combina e deduplica ──────────────────────────────────────────────────────

/**
 * @param preferirCrossRef - true para áreas não-biomédicas (direito, educação, agronomia, etc.)
 *   PubMed só indexa ciências biomédicas; para outras áreas usar CrossRef exclusivamente.
 */
export async function buscarRefsExternas(
  query: string,
  limite = 8,
  preferirCrossRef = false,
): Promise<RefExterna[]> {
  let crossref: RefExterna[] = []
  let pubmed: RefExterna[] = []

  if (preferirCrossRef) {
    // Áreas não-biomédicas: CrossRef cobre todas as disciplinas académicas
    crossref = await buscarCrossRef(query, limite)
  } else {
    // Áreas biomédicas: CrossRef + PubMed 50/50
    const half = Math.ceil(limite / 2)
    const results = await Promise.all([
      buscarCrossRef(query, half),
      buscarPubMed(query, half),
    ])
    crossref = results[0]
    pubmed = results[1]
  }

  // Intercala para diversidade de fontes
  const merged: RefExterna[] = []
  const maxLen = Math.max(crossref.length, pubmed.length)
  for (let i = 0; i < maxLen; i++) {
    if (crossref[i]) merged.push(crossref[i])
    if (pubmed[i])   merged.push(pubmed[i])
  }

  // Remove duplicatas por DOI
  const vistos = new Set<string>()
  return merged.filter(r => {
    if (!r.doi) return true
    if (vistos.has(r.doi)) return false
    vistos.add(r.doi)
    return true
  }).slice(0, limite)
}
