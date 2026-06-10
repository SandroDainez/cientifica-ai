// ============================================================
// CIENTÍFICA AI — Renumeração de subseções (determinístico, puro)
// ============================================================
// O modelo gerador numera as subseções a partir de 1 DENTRO de cada seção
// (ex.: "1.1, 1.2" no Desenvolvimento, que é a seção 4) → deveria ser "4.1, 4.2".
// Esta função, aplicada no RENDER/EXPORTAÇÃO (onde se conhece o número da seção
// pai pela ordem no documento), corrige o prefixo. Universal, todo tipo de trabalho.

/**
 * Renumera as subseções de `conteudo` para casarem com `numeroSecao` (a posição da
 * seção no documento). Só toca linhas que COMEÇAM com um número de subseção
 * (d.d[.d...]) seguido de espaço e LETRA MAIÚSCULA — cara de título — para não
 * confundir com valores no meio do texto (ex.: "2.5 vezes maior" não é tocado).
 */
export function renumerarSubsecoes(conteudo: string, numeroSecao: number): string {
  if (!conteudo || !Number.isInteger(numeroSecao) || numeroSecao < 1) return conteudo
  return conteudo.replace(
    /^([ \t]*)(\d+)((?:\.\d+)+)([ \t]+)(?=[A-ZÀ-Ÿ])/gm,
    (_m, esp: string, _primeiro: string, resto: string, sp: string) => `${esp}${numeroSecao}${resto}${sp}`,
  )
}
