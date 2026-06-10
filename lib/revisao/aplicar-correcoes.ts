// ============================================================
// CIENTÍFICA AI — Aplica as correções da Revisão Avançada nas seções
// ============================================================
// A revisão devolve, por problema, o TRECHO exato e a CORREÇÃO exata. Aqui
// aplicamos essas trocas DIRETAMENTE no conteúdo de cada seção (determinístico,
// com match tolerante a espaços e trava anti-piora). Nada de reescrever o
// trabalho inteiro nem dividir um "blob" de volta em seções.

import { aplicarEdicoes, edicaoSeguraCirurgica, type Edicao } from '@/lib/ai/aplicar-edicoes'

const contaPalavras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const contaCitacoes = (s: string) => (s.match(/(?:19|20)\d{2}/g) ?? []).length + (s.match(/\[\s*\d+/g) ?? []).length

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

    // Aplica edição por edição com a trava CIRÚRGICA: remover uma citação errada/
    // repetida é legítimo (a trava só bloqueia INVENTAR citação ou inflar demais).
    // Antes, a trava de seção (reescritaSegura) revertia a seção INTEIRA quando uma
    // remoção baixava a contagem de citações — por isso as correções não aplicavam.
    let conteudoAtual = original
    let aplicadasNaSecao = 0
    for (const e of edicoes) {
      if (!edicaoSeguraCirurgica(e.buscar, e.substituir).ok) continue
      const { texto, aplicadas } = aplicarEdicoes(conteudoAtual, [e])
      if (aplicadas > 0 && texto !== conteudoAtual) { conteudoAtual = texto; aplicadasNaSecao += aplicadas }
    }
    if (aplicadasNaSecao === 0 || conteudoAtual === original) continue

    // Sanidade da seção: não pode inchar demais (invenção) nem colapsar as
    // citações (>40% a menos, com ≥5 originais → algo deu muito errado).
    const citAntes = contaCitacoes(original)
    const inchou = contaPalavras(conteudoAtual) > contaPalavras(original) * 1.6
    const colapsou = citAntes >= 5 && contaCitacoes(conteudoAtual) < citAntes * 0.6
    if (inchou || colapsou) continue

    atualizacoes.push({ chave_secao: secao.chave_secao, conteudo: conteudoAtual })
    totalAplicadas += aplicadasNaSecao
  }

  return { atualizacoes, totalAplicadas, secoesAfetadas: atualizacoes.length }
}
