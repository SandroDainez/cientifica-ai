// ============================================================
// CIENTÍFICA AI — Compila a seção "Referências" a partir da TABELA
// ============================================================
// A bibliografia (seção secoes_trabalho.chave_secao='referencias') é DERIVADA da
// tabela `referencias` (fonte da verdade). Sempre que uma referência sai da tabela,
// a seção precisa ser RECOMPILADA — senão fica uma entrada órfã na bibliografia
// (citada como "referência suspeita" pela revisão). Fonte única usada pela geração
// e pelo saneamento.

import type { Referencia, FormatoCitacao } from '@/types'
import { ordenarReferencias, formatarReferencia } from '@/lib/referencias/formatar'
import { filtrarRefsCitaveis } from '@/lib/referencias/auto-import'

/** Monta o texto da seção "Referências" a partir das referências da tabela. */
export function compilarSecaoReferencias(referencias: Referencia[], formato: FormatoCitacao): string {
  const refsOrdenadas = ordenarReferencias(filtrarRefsCitaveis(referencias), formato)
  if (refsOrdenadas.length === 0) return ''
  const linhas = refsOrdenadas.map((ref, i) =>
    formatarReferencia(ref, formato, formato === 'vancouver' ? i + 1 : undefined),
  )
  const cabecalho = formato === 'vancouver' ? '## Referências\n\n' : '## REFERÊNCIAS\n\n'
  const corpo = formato === 'vancouver'
    ? linhas.map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, '')}`).join('\n\n')
    : linhas.join('\n\n')
  return cabecalho + corpo
}
