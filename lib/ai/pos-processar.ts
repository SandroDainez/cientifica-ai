// ============================================================
// CIENTÍFICA AI — Pós-processamento de texto gerado (fonte única)
// ============================================================
// Camada ÚNICA aplicada a TODO texto gerado pela IA (seções do editor,
// documentos do projeto, refinamentos, etc.) para que as melhorias de qualidade
// fiquem padronizadas no app inteiro — e não divirjam entre áreas.
//
// Faz, em ordem:
//  1. corrigirCodigoR     — erros determinísticos de código R (groups → .groups)
//  2. validarCitacoesReais — remove travessões "—", protege vírgula decimal,
//                            valida citações contra refs reais e resolve placeholders
//  3. removerPlaceholdersCitacaoResiduais — nenhum "(SOBRENOME, ANO)" fica visível

import type { Referencia, FormatoCitacao } from '@/types'
import { validarCitacoesReais, removerPlaceholdersCitacaoResiduais } from './validar-citacoes'
import { corrigirCodigoR, corrigirCodigoPython } from './utils'
import { converterMathLatexParaTexto } from '@/lib/formatacao/latex'

export function posProcessarTextoGerado(
  texto: string,
  referencias: Referencia[],
  formato: FormatoCitacao = 'abnt',
): string {
  if (!texto) return texto
  let t = corrigirCodigoR(texto)
  t = corrigirCodigoPython(t)
  // Converte LaTeX matemático (\frac, \times, Z_{\alpha/2}, ^2…) em texto legível
  t = converterMathLatexParaTexto(t)
  t = validarCitacoesReais(t, referencias, formato)
  t = removerPlaceholdersCitacaoResiduais(t)
  return t
}
