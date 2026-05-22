import type { Referencia, AutorReferencia, FormatoCitacao } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function autoresAbnt(autores: AutorReferencia[] = []): string {
  if (!autores.length) return ''
  return autores
    .map(a => `${a.sobrenome.toUpperCase()}, ${a.nome}`)
    .join('; ')
}

function autoresVancouver(autores: AutorReferencia[] = []): string {
  if (!autores.length) return ''
  const formatados = autores.map(a => `${a.sobrenome} ${a.iniciais ?? a.nome.charAt(0)}`)
  if (formatados.length > 6) {
    return formatados.slice(0, 6).join(', ') + ', et al'
  }
  return formatados.join(', ')
}

function autoresApa(autores: AutorReferencia[] = []): string {
  if (!autores.length) return ''
  const formatados = autores.map(a => `${a.sobrenome}, ${a.iniciais ?? a.nome.charAt(0)}.`)
  if (formatados.length > 3) {
    return formatados.slice(0, 1).join('') + ' et al.'
  }
  return formatados.join(', ')
}

// ── Formatadores por tipo ─────────────────────────────────────────────────────

function formatarArtigoAbnt(r: Referencia): string {
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores) + '.')
  partes.push(r.titulo + '.')
  if (r.journal) partes.push(`**${r.journal}**,`)
  if (r.cidade) partes.push(r.cidade + ',')
  if (r.volume) partes.push(`v. ${r.volume},`)
  if (r.numero) partes.push(`n. ${r.numero},`)
  if (r.paginas) partes.push(`p. ${r.paginas},`)
  if (r.ano) partes.push(`${r.ano}.`)
  if (r.doi) partes.push(`DOI: ${r.doi}.`)
  return partes.join(' ')
}

function formatarLivroAbnt(r: Referencia): string {
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores) + '.')
  partes.push(`**${r.titulo}**.`)
  if (r.cidade) partes.push(r.cidade + ':')
  if (r.editora) partes.push(r.editora + ',')
  if (r.ano) partes.push(`${r.ano}.`)
  if (r.isbn) partes.push(`ISBN: ${r.isbn}.`)
  return partes.join(' ')
}

function formatarSiteAbnt(r: Referencia): string {
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores) + '.')
  partes.push(`**${r.titulo}**.`)
  if (r.url) partes.push(`Disponível em: ${r.url}.`)
  if (r.ano) partes.push(`Acesso em: ${r.ano}.`)
  return partes.join(' ')
}

function formatarTeseAbnt(r: Referencia): string {
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores) + '.')
  partes.push(`**${r.titulo}**.`)
  if (r.ano) partes.push(`${r.ano}.`)
  const tipoDesc = r.tipo === 'tese' ? 'Tese (Doutorado)' : 'Dissertação (Mestrado)'
  if (r.editora) partes.push(`${tipoDesc} — ${r.editora},`)
  if (r.cidade) partes.push(r.cidade + '.')
  return partes.join(' ')
}

// ── Formatador principal ──────────────────────────────────────────────────────

export function formatarReferencia(r: Referencia, formato: FormatoCitacao): string {
  // Se já tiver pré-formatada, usa
  const preFormatada = {
    abnt: r.referencia_formatada_abnt,
    vancouver: r.referencia_formatada_vancouver,
    apa: r.referencia_formatada_apa,
  }[formato]
  if (preFormatada) return preFormatada

  if (formato === 'abnt') {
    if (r.tipo === 'artigo') return formatarArtigoAbnt(r)
    if (r.tipo === 'livro' || r.tipo === 'capitulo_livro') return formatarLivroAbnt(r)
    if (r.tipo === 'site') return formatarSiteAbnt(r)
    if (r.tipo === 'tese' || r.tipo === 'dissertacao') return formatarTeseAbnt(r)
    return formatarArtigoAbnt(r)
  }

  if (formato === 'vancouver') {
    const autStr = autoresVancouver(r.autores)
    if (r.tipo === 'artigo') {
      return [
        autStr ? autStr + '.' : '',
        r.titulo + '.',
        r.journal ? r.journal + '.' : '',
        r.ano ? `${r.ano}` : '',
        r.volume ? `;${r.volume}` : '',
        r.numero ? `(${r.numero})` : '',
        r.paginas ? `:${r.paginas}.` : '.',
        r.doi ? `doi:${r.doi}` : '',
      ].filter(Boolean).join(' ')
    }
    return [autStr ? autStr + '.' : '', r.titulo + '.', r.editora ?? '', r.ano ? `${r.ano}.` : ''].filter(Boolean).join(' ')
  }

  if (formato === 'apa') {
    const autStr = autoresApa(r.autores)
    if (r.tipo === 'artigo') {
      return [
        autStr ? autStr + (r.ano ? ` (${r.ano}).` : '') : '',
        r.titulo + '.',
        r.journal ? `*${r.journal}*,` : '',
        r.volume ? `*${r.volume}*` : '',
        r.numero ? `(${r.numero}),` : '',
        r.paginas ? `${r.paginas}.` : '.',
        r.doi ? `https://doi.org/${r.doi}` : '',
      ].filter(Boolean).join(' ')
    }
    return [
      autStr ? autStr + (r.ano ? ` (${r.ano}).` : '') : '',
      `*${r.titulo}*.`,
      r.editora ?? '',
    ].filter(Boolean).join(' ')
  }

  return r.titulo
}

export function abreviarReferencia(r: Referencia): string {
  const primeiro = r.autores?.[0]
  const autor = primeiro ? primeiro.sobrenome : 'Anônimo'
  return `${autor}, ${r.ano ?? 's.d.'} — ${r.titulo.substring(0, 60)}${r.titulo.length > 60 ? '…' : ''}`
}
