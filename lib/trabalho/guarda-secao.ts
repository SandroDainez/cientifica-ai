// ── Trava anti-embaralhamento de seções ───────────────────────────────────────
// O bug de contaminação cruzada já gravou o conteúdo de uma seção DENTRO de outra
// (ex.: a LISTA DE REFERÊNCIAS compilada acabou na seção 'desenvolvimento',
// deixando o corpo "vazio" e a revisão confusa). Além de corrigir a causa raiz
// (remount do editor por seção + persistência server-side), esta é uma defesa em
// profundidade: a lista de referências compilada só pode viver na seção própria.

/**
 * Detecta o conteúdo da SEÇÃO DE REFERÊNCIAS compilada pelo app — aquele que
 * começa com o título "## REFERÊNCIAS" / "## Referências" (ABNT/Vancouver). É uma
 * assinatura inequívoca: nenhuma seção de corpo (introdução, desenvolvimento,
 * metodologia…) começa com esse título. Usado para impedir que essa lista seja
 * gravada por engano em outra seção.
 */
export function pareceListaReferenciasCompilada(conteudo?: string | null): boolean {
  if (!conteudo) return false
  const t = conteudo.trim()
  if (t.length < 20) return false
  // Começa com um título "Referências" (com ou sem marcadores de heading markdown).
  return /^#{0,3}\s*refer[êe]ncias\b/i.test(t)
}
