import type { Referencia, AutorReferencia, FormatoCitacao } from '@/types'

// ── Helpers de autores ────────────────────────────────────────────────────────

/**
 * ABNT NBR 6023: SOBRENOME, Nome Completo
 * Ex: SILVA, João Antônio; COSTA, Maria Lúcia
 */
function autoresAbnt(autores: AutorReferencia[] = []): string {
  if (!autores.length) return ''
  return autores
    .map(a => {
      const nome = (a.nome ?? '').trim()
      // Entidade coletiva (sem prenome): ABNT NBR 6023 → nome por extenso em
      // CAIXA ALTA, SEM inversão e SEM vírgula. Ex.: "NATIONAL ACTION PLAN
      // WORKING GROUP" (e não "NATIONAL ACTION PLAN WORKING GROUP, ").
      if (!nome) return (a.sobrenome ?? '').toUpperCase().trim()
      return `${a.sobrenome.toUpperCase()}, ${nome}`
    })
    .join('; ')
}

/**
 * Vancouver/ICMJE: Sobrenome Iniciais (sem pontos entre iniciais)
 * Ex: Silva JA, Costa ML — máximo 6 autores, depois et al
 */
function autoresVancouver(autores: AutorReferencia[] = []): string {
  if (!autores.length) return ''
  const formatados = autores.map(a => {
    // Entidade coletiva (sem prenome/iniciais, ex.: "WHO"): nome por extenso, sem iniciais.
    if (!(a.nome ?? '').trim() && !(a.iniciais ?? '').trim()) return (a.sobrenome ?? '').trim()
    // Remove periods and spaces from initials → "J." → "J", "J. A." → "JA"
    const iniciais = (a.iniciais ?? (a.nome ?? '').charAt(0))
      .replace(/\./g, '')
      .replace(/\s+/g, '')
      .toUpperCase()
    return `${a.sobrenome} ${iniciais}`.trim()
  })
  if (formatados.length > 6) {
    return formatados.slice(0, 6).join(', ') + ', et al'
  }
  return formatados.join(', ')
}

/**
 * APA 7ª Ed: Sobrenome, N. N. — usa & antes do último autor
 * Até 20 autores: lista todos com & antes do último
 * >20 autores: primeiros 19, ..., & último
 */
function autoresApa(autores: AutorReferencia[] = []): string {
  if (!autores.length) return ''
  const formatados = autores.map(a => {
    // Entidade coletiva (sem prenome/iniciais, ex.: "WHO"): nome por extenso, sem vírgula/iniciais.
    if (!(a.nome ?? '').trim() && !(a.iniciais ?? '').trim()) return (a.sobrenome ?? '').trim()
    // "JA" → "J. A." | "J." → "J." | "J" → "J."
    const raw = (a.iniciais ?? (a.nome ?? '').charAt(0)).replace(/\./g, '').replace(/\s+/g, '')
    const iniciais = raw.split('').map(c => c.toUpperCase() + '.').join(' ')
    return `${a.sobrenome}, ${iniciais}`
  })
  if (formatados.length === 1) return formatados[0]
  if (formatados.length <= 20) {
    return formatados.slice(0, -1).join(', ') + ', & ' + formatados[formatados.length - 1]
  }
  // >20: primeiros 19, ..., & último
  return formatados.slice(0, 19).join(', ') + '... & ' + formatados[formatados.length - 1]
}

// ── Helper para data de acesso (sites) ───────────────────────────────────────

function dataAcesso(r: Referencia): string {
  if (r.data_acesso) return r.data_acesso
  // Fallback: tenta dados_extras
  const daExtras = (r.dados_extras as Record<string, unknown>)?.data_acesso
  if (daExtras && typeof daExtras === 'string') return daExtras
  return 'data de acesso não informada'
}

// ── Formatadores ABNT (NBR 6023:2018) ────────────────────────────────────────

/**
 * Remove número de resumo/abstract no início do título (ex.: "449 The Effect…"),
 * comum em suplementos de congresso vindos do CrossRef. Conservador: só remove
 * 1-3 dígitos seguidos de espaço e letra maiúscula — NÃO mexe em anos ("2024
 * Guidelines…", 4 dígitos) nem em "5-year"/"10 mg" (hífen/minúscula).
 */
function limparTituloArtigo(titulo: string): string {
  return (titulo ?? '').replace(/^\s*\d{1,3}\s+(?=[A-ZÀ-Ý])/, '').trim()
}

function formatarArtigoAbnt(r: Referencia): string {
  // AUTOR(ES). Título do artigo. **Periódico**, local, v. X, n. X, p. XX-XX, ano. DOI: xxx.
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores).replace(/\.\s*$/, '') + '.')
  partes.push(limparTituloArtigo(r.titulo) + '.')
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
  // AUTOR(ES). **Título**. Edição. Cidade: Editora, ano. ISBN.
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores).replace(/\.\s*$/, '') + '.')
  partes.push(`**${r.titulo}**.`)
  if (r.cidade) partes.push(r.cidade + ':')
  if (r.editora) partes.push(r.editora + ',')
  if (r.ano) partes.push(`${r.ano}.`)
  if (r.isbn) partes.push(`ISBN: ${r.isbn}.`)
  return partes.join(' ')
}

function formatarCapituloLivroAbnt(r: Referencia): string {
  // AUTOR(ES). Título do capítulo. In: **Título do livro**. Cidade: Editora, ano. p. XX-XX.
  // r.journal carrega o TÍTULO DO LIVRO (container-title); r.editora é a editora (publisher).
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores).replace(/\.\s*$/, '') + '.')
  partes.push(limparTituloArtigo(r.titulo) + '.')
  partes.push('In:')
  if (r.journal) partes.push(`**${r.journal}**.`)
  // Cidade: Editora, ano.
  const local = [r.cidade ? `${r.cidade}:` : '', r.editora ?? ''].filter(Boolean).join(' ')
  if (local && r.ano) partes.push(`${local}, ${r.ano}.`)
  else if (local) partes.push(`${local}.`)
  else if (r.ano) partes.push(`${r.ano}.`)
  if (r.paginas) partes.push(`p. ${r.paginas}.`)
  return partes.join(' ')
}

function formatarSiteAbnt(r: Referencia): string {
  // AUTOR(ES). **Título**. Disponível em: URL. Acesso em: DD mês. AAAA.
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores).replace(/\.\s*$/, '') + '.')
  partes.push(`**${r.titulo}**.`)
  if (r.ano) partes.push(`${r.ano}.`)
  if (r.url) partes.push(`Disponível em: ${r.url}.`)
  partes.push(`Acesso em: ${dataAcesso(r)}.`)
  return partes.join(' ')
}

function formatarTeseAbnt(r: Referencia): string {
  // AUTOR. **Título**. Ano. Tese (Doutorado) / Dissertação (Mestrado) — Instituição, Cidade.
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores).replace(/\.\s*$/, '') + '.')
  partes.push(`**${r.titulo}**.`)
  if (r.ano) partes.push(`${r.ano}.`)
  const tipoDesc = r.tipo === 'tese' ? 'Tese (Doutorado)' : 'Dissertação (Mestrado)'
  const inst = r.editora ? `${tipoDesc} — ${r.editora}` : tipoDesc
  partes.push(inst + (r.cidade ? `, ${r.cidade}.` : '.'))
  return partes.join(' ')
}

function formatarAnaisAbnt(r: Referencia): string {
  // AUTOR. Título. In: NOME DO EVENTO, N., ANO, Cidade. Anais [...]. Cidade: Editora, ano. p. XX-XX.
  const partes: string[] = []
  if (r.autores?.length) partes.push(autoresAbnt(r.autores).replace(/\.\s*$/, '') + '.')
  partes.push(r.titulo + '.')
  if (r.journal) partes.push(`In: ${r.journal.toUpperCase()}.`)
  if (r.cidade) partes.push(`${r.cidade}:`)
  if (r.editora) partes.push(r.editora + ',')
  if (r.ano) partes.push(`${r.ano}.`)
  if (r.paginas) partes.push(`p. ${r.paginas}.`)
  return partes.join(' ')
}

function formatarLeiAbnt(r: Referencia): string {
  // BRASIL. Lei nº XXXX, de DD de mês de AAAA. Título/ementa. Diário Oficial [...], Brasília, DF, AAAA.
  const partes: string[] = []
  partes.push(r.titulo + '.')
  if (r.journal) partes.push(`**${r.journal}**,`)
  if (r.cidade) partes.push(r.cidade + ',')
  if (r.ano) partes.push(`${r.ano}.`)
  if (r.url) partes.push(`Disponível em: ${r.url}.`)
  return partes.join(' ')
}

// ── Formatadores Vancouver (ICMJE) ───────────────────────────────────────────

function formatarArtigoVancouver(r: Referencia, n?: number): string {
  // N. Autores. Título. Periódico abreviado. ano;vol(num):pág. doi:xxx
  const num = n != null ? `${n}. ` : ''
  const autStr = autoresVancouver(r.autores)
  const partes: string[] = []
  if (autStr) partes.push(autStr + '.')
  partes.push(limparTituloArtigo(r.titulo) + '.')
  if (r.journal) partes.push(r.journal + '.')
  const volInfo = [
    r.ano ? String(r.ano) : '',
    r.volume ? `;${r.volume}` : '',
    r.numero ? `(${r.numero})` : '',
    r.paginas ? `:${r.paginas}` : '',
  ].join('')
  if (volInfo) partes.push(volInfo + '.')
  if (r.doi) partes.push(`doi:${r.doi}`)
  return num + partes.join(' ')
}

function formatarLivroVancouver(r: Referencia, n?: number): string {
  const num = n != null ? `${n}. ` : ''
  const autStr = autoresVancouver(r.autores)
  const partes: string[] = []
  if (autStr) partes.push(autStr + '.')
  partes.push(r.titulo + '.')
  if (r.cidade) partes.push(r.cidade + ':')
  if (r.editora) partes.push(r.editora + ';')
  if (r.ano) partes.push(`${r.ano}.`)
  return num + partes.join(' ')
}

function formatarSiteVancouver(r: Referencia, n?: number): string {
  const num = n != null ? `${n}. ` : ''
  const autStr = autoresVancouver(r.autores)
  const partes: string[] = []
  if (autStr) partes.push(autStr + '.')
  partes.push(r.titulo + '.')
  if (r.url) partes.push(`Disponível em: ${r.url}`)
  partes.push(`[Acesso em: ${dataAcesso(r)}].`)
  return num + partes.join(' ')
}

function formatarTeseVancouver(r: Referencia, n?: number): string {
  const num = n != null ? `${n}. ` : ''
  const autStr = autoresVancouver(r.autores)
  const tipoDesc = r.tipo === 'tese' ? '[Tese]' : '[Dissertação]'
  const partes: string[] = []
  if (autStr) partes.push(autStr + '.')
  partes.push(r.titulo + ' ' + tipoDesc + '.')
  if (r.editora) partes.push(r.editora + ';')
  if (r.ano) partes.push(`${r.ano}.`)
  return num + partes.join(' ')
}

// ── Formatadores APA 7ª Edição ───────────────────────────────────────────────

function formatarArtigoApa(r: Referencia): string {
  // Autores (ano). Título do artigo. *Periódico*, *vol*(num), páginas. https://doi.org/xxx
  const autStr = autoresApa(r.autores)
  const partes: string[] = []
  if (autStr) partes.push(autStr + (r.ano ? ` (${r.ano}).` : ' (s.d.).'))
  partes.push(limparTituloArtigo(r.titulo) + '.')
  if (r.journal) {
    const volInfo = [
      `*${r.journal}*`,
      r.volume ? `, *${r.volume}*` : '',
      r.numero ? `(${r.numero})` : '',
      r.paginas ? `, ${r.paginas}` : '',
    ].join('')
    partes.push(volInfo + '.')
  }
  if (r.doi) partes.push(`https://doi.org/${r.doi}`)
  return partes.join(' ')
}

function formatarLivroApa(r: Referencia): string {
  // Autores (ano). *Título*. Editora.
  const autStr = autoresApa(r.autores)
  const partes: string[] = []
  if (autStr) partes.push(autStr + (r.ano ? ` (${r.ano}).` : ' (s.d.).'))
  partes.push(`*${r.titulo}*.`)
  if (r.editora) partes.push(r.editora + '.')
  return partes.join(' ')
}

function formatarSiteApa(r: Referencia): string {
  // Autores (ano). Título. Recuperado de URL
  const autStr = autoresApa(r.autores)
  const partes: string[] = []
  if (autStr) partes.push(autStr + (r.ano ? ` (${r.ano}).` : ' (s.d.).'))
  partes.push(r.titulo + '.')
  if (r.url) partes.push(`Recuperado de ${r.url}`)
  return partes.join(' ')
}

function formatarTeseApa(r: Referencia): string {
  const autStr = autoresApa(r.autores)
  const tipoDesc = r.tipo === 'tese' ? '[Tese de doutorado' : '[Dissertação de mestrado'
  const partes: string[] = []
  if (autStr) partes.push(autStr + (r.ano ? ` (${r.ano}).` : ' (s.d.).'))
  partes.push(`*${r.titulo}* ${tipoDesc}${r.editora ? `, ${r.editora}` : ''}].`)
  return partes.join(' ')
}

// ── Formatador principal ──────────────────────────────────────────────────────

export function formatarReferencia(r: Referencia, formato: FormatoCitacao, numero?: number): string {
  // Se já tiver pré-formatada, usa (preservando formatação markdown)
  const preFormatada = {
    abnt: r.referencia_formatada_abnt,
    vancouver: r.referencia_formatada_vancouver,
    apa: r.referencia_formatada_apa,
  }[formato]
  if (preFormatada) {
    // Para Vancouver, pode precisar prenumerar se não tiver número
    if (formato === 'vancouver' && numero != null && !preFormatada.match(/^\d+\./)) {
      return `${numero}. ${preFormatada}`
    }
    return preFormatada
  }

  if (formato === 'abnt') {
    if (r.tipo === 'artigo') return formatarArtigoAbnt(r)
    if (r.tipo === 'livro') return formatarLivroAbnt(r)
    if (r.tipo === 'capitulo_livro') return formatarCapituloLivroAbnt(r)
    if (r.tipo === 'site') return formatarSiteAbnt(r)
    if (r.tipo === 'tese' || r.tipo === 'dissertacao') return formatarTeseAbnt(r)
    if (r.tipo === 'anais') return formatarAnaisAbnt(r)
    if (r.tipo === 'lei' || r.tipo === 'norma') return formatarLeiAbnt(r)
    return formatarArtigoAbnt(r) // fallback
  }

  if (formato === 'vancouver') {
    if (r.tipo === 'artigo') return formatarArtigoVancouver(r, numero)
    if (r.tipo === 'livro' || r.tipo === 'capitulo_livro')
      return formatarLivroVancouver(r, numero)
    if (r.tipo === 'site') return formatarSiteVancouver(r, numero)
    if (r.tipo === 'tese' || r.tipo === 'dissertacao') return formatarTeseVancouver(r, numero)
    return formatarArtigoVancouver(r, numero) // fallback
  }

  if (formato === 'apa') {
    if (r.tipo === 'artigo') return formatarArtigoApa(r)
    if (r.tipo === 'livro' || r.tipo === 'capitulo_livro') return formatarLivroApa(r)
    if (r.tipo === 'site') return formatarSiteApa(r)
    if (r.tipo === 'tese' || r.tipo === 'dissertacao') return formatarTeseApa(r)
    return formatarArtigoApa(r) // fallback
  }

  return r.titulo
}

// ── Helpers de ordenação ──────────────────────────────────────────────────────

/**
 * Ordena referências conforme o formato:
 * - ABNT / APA: alfabética pelo sobrenome do primeiro autor (ou título se sem autor)
 * - Vancouver: mantém a ordem original (ordem de citação no texto)
 */
export function ordenarReferencias(refs: Referencia[], formato: FormatoCitacao): Referencia[] {
  if (formato === 'vancouver') return refs // ordem de citação
  return [...refs].sort((a, b) => {
    const chaveA = (a.autores?.[0]?.sobrenome ?? a.titulo).toLowerCase()
    const chaveB = (b.autores?.[0]?.sobrenome ?? b.titulo).toLowerCase()
    return chaveA.localeCompare(chaveB, 'pt-BR')
  })
}

// ── Helper de abreviação (para listas compactas) ──────────────────────────────

export function abreviarReferencia(r: Referencia): string {
  const primeiro = r.autores?.[0]
  const autor = primeiro ? primeiro.sobrenome : 'Anônimo'
  return `${autor}, ${r.ano ?? 's.d.'} — ${r.titulo.substring(0, 60)}${r.titulo.length > 60 ? '…' : ''}`
}

// ── Helper de citação inline ──────────────────────────────────────────────────

/**
 * Retorna a citação no texto conforme o formato:
 * ABNT: (SILVA, 2020) ou SILVA (2020)
 * Vancouver: [1]
 * APA: (Silva, 2020) ou Silva (2020)
 */
export function citacaoInTexto(r: Referencia, formato: FormatoCitacao, numero?: number): string {
  if (formato === 'vancouver') return `[${numero ?? '?'}]`

  const autores = r.autores ?? []
  const ano = r.ano ?? 's.d.'

  if (formato === 'abnt') {
    if (!autores.length) return `(${r.titulo.substring(0, 20).toUpperCase()}, ${ano})`
    const s1 = autores[0].sobrenome.toUpperCase()
    if (autores.length === 1) return `(${s1}, ${ano})`
    if (autores.length === 2) return `(${s1}; ${autores[1].sobrenome.toUpperCase()}, ${ano})`
    return `(${s1} et al., ${ano})`
  }

  if (formato === 'apa') {
    if (!autores.length) return `(${r.titulo.substring(0, 20)}, ${ano})`
    const s1 = autores[0].sobrenome
    if (autores.length === 1) return `(${s1}, ${ano})`
    if (autores.length === 2) return `(${s1} & ${autores[1].sobrenome}, ${ano})`
    return `(${s1} et al., ${ano})`
  }

  return `(${autores[0]?.sobrenome ?? r.titulo}, ${ano})`
}
