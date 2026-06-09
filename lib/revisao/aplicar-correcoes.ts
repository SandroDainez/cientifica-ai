// ============================================================
// CIENTÍFICA AI — Aplica as correções da Revisão Avançada nas seções
// ============================================================
// A revisão devolve, por problema, o TRECHO exato e a CORREÇÃO exata. Aqui
// aplicamos essas trocas DIRETAMENTE no conteúdo de cada seção (determinístico,
// com match tolerante a espaços e trava anti-piora). Nada de reescrever o
// trabalho inteiro nem dividir um "blob" de volta em seções.

import { aplicarEdicoes, reescritaSegura, type Edicao } from '@/lib/ai/aplicar-edicoes'

export interface CorrecaoTrecho { trecho: string; correcao: string }

/**
 * Conteúdo ESTRUTURADO (JSON), como a seção "resumo" ({resumo, abstract, …}).
 * Editar o texto cru dentro do JSON corromperia a estrutura e faria o
 * abstract/resumo sumirem — por isso NUNCA aplicamos correções nessas seções.
 */
function ehConteudoEstruturado(conteudo: string): boolean {
  const t = conteudo.trim()
  if (!t.startsWith('{')) return false
  try {
    const o = JSON.parse(t)
    return typeof o === 'object' && o !== null
  } catch {
    return false
  }
}

/** Converte os problemas (trecho/correcao) em edições buscar→substituir aplicáveis. */
export function correcoesParaEdicoes(correcoes: CorrecaoTrecho[]): Edicao[] {
  return correcoes
    .filter(c => typeof c.trecho === 'string' && c.trecho.trim().length >= 3 && typeof c.correcao === 'string')
    .map(c => ({ buscar: c.trecho, substituir: c.correcao }))
}

export interface ResultadoAplicacao {
  atualizacoes: { chave_secao: string; conteudo: string }[]
  totalAplicadas: number
  secoesAfetadas: number
}

/**
 * Aplica as edições em cada seção. Uma edição só entra na seção que contém o
 * trecho (aplicarEdicoes ignora trechos não encontrados). A seção só é atualizada
 * se a mudança for SEGURA (não perdeu citação, não inventou conteúdo).
 */
export function aplicarCorrecoesNasSecoes(
  secoes: { chave_secao: string; conteudo?: string | null }[],
  edicoes: Edicao[],
): ResultadoAplicacao {
  const atualizacoes: { chave_secao: string; conteudo: string }[] = []
  let totalAplicadas = 0

  for (const secao of secoes) {
    const original = secao.conteudo ?? ''
    if (!original.trim()) continue
    // Nunca mexe em seção estruturada (JSON), ex.: resumo/abstract — corromperia.
    if (secao.chave_secao === 'resumo' || ehConteudoEstruturado(original)) continue
    const { texto, aplicadas } = aplicarEdicoes(original, edicoes)
    if (aplicadas > 0 && texto !== original && reescritaSegura(original, texto).ok) {
      atualizacoes.push({ chave_secao: secao.chave_secao, conteudo: texto })
      totalAplicadas += aplicadas
    }
  }

  return { atualizacoes, totalAplicadas, secoesAfetadas: atualizacoes.length }
}
