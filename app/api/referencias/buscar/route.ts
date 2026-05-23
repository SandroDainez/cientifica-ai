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
import { buscarCrossRef as crossRefLib, buscarPubMed as pubMedLib } from '@/lib/referencias/buscar-externo'
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
// Mantido apenas para uso interno pelo OpenAlex (CrossRef e PubMed agora usam buscar-externo.ts)

function calcIniciais(nome: string): string {
  return nome.trim().split(/\s+/).map(n => n.charAt(0).toUpperCase()).join('')
}

// ── CrossRef e PubMed — usa lib compartilhada ─────────────────────────────────

async function buscarCrossRef(query: string, limite: number): Promise<ResultadoBusca[]> {
  const refs = await crossRefLib(query, limite)
  return refs.map(r => ({ ...r, confiabilidade: 'alta' as const }))
}

async function buscarPubMed(query: string, limite: number): Promise<ResultadoBusca[]> {
  const refs = await pubMedLib(query, limite)
  return refs.map(r => ({ ...r, confiabilidade: 'alta' as const }))
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
