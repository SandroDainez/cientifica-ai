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
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'

/**
 * Monta o texto da seção "Referências" a partir da tabela. Se `corpoCitado` for
 * passado, lista APENAS as referências CITADAS no corpo (padrão acadêmico: a
 * bibliografia só contém o que é citado). Sem isso, citações removidas do texto
 * deixariam refs órfãs na lista ("não citada no texto") → cascata de erros.
 */
export function compilarSecaoReferencias(referencias: Referencia[], formato: FormatoCitacao, corpoCitado?: string): string {
  let base = filtrarRefsCitaveis(referencias)
  if (corpoCitado?.trim()) {
    const { citadas } = separarReferenciasCitadas(base, corpoCitado, formato)
    if (citadas.length > 0) base = citadas   // só filtra se sobrar algo (rede de segurança)
  }
  const refsOrdenadas = ordenarReferencias(base, formato)
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
