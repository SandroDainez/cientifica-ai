/**
 * Ordem CANÔNICA do documento científico (ABNT) para EXPORTAÇÃO/VISUALIZAÇÃO.
 *
 * No editor, as seções seguem a ordem de ELABORAÇÃO do fluxo (ex.: a Introdução
 * costuma ser escrita por último). No documento final, porém, a ordem é fixa:
 * elementos pré-textuais → Introdução → Objetivos → desenvolvimento/métodos →
 * resultados → discussão → conclusão → elementos pós-textuais.
 *
 * Aqui damos um "rank" a cada chave_secao. Seções não mapeadas recebem um rank
 * neutro (meio do documento) e, por usarmos ORDENAÇÃO ESTÁVEL, mantêm a ordem em
 * que aparecem no fluxo — assim só reposicionamos a abertura e o fechamento, sem
 * bagunçar o miolo (métodos → resultados → discussão) que já está correto.
 */

const RANK: Record<string, number> = {
  // Pré-textuais (tratados à parte: capa/resumo) — rank baixo por segurança
  titulo: -20,
  resumo: -10,
  resumo_atividades: 0, // Relatório de IC: síntese inicial das atividades

  // Abertura (capítulo introdutório), em ordem ABNT
  introducao: 1,
  tema: 2,
  tema_originalidade: 2,
  problema: 3,
  pico: 3,
  pergunta_pico: 3,
  objetivos: 4,
  justificativa: 5,
  hipoteses: 6,

  // Miolo (referencial, métodos, resultados, discussão): rank neutro = 50.
  // Mantêm a ordem do fluxo (que já está correta) via ordenação estável.

  // Fechamento, em ordem ABNT
  resultados_esperados: 89, // projeto de pesquisa: vem após a metodologia, ANTES de cronograma/orçamento
  consideracoes_finais: 90,
  conclusao: 90,
  limitacoes: 91,
  perspectivas: 92,
  dificuldades: 92,
  formacao: 93,
  cronograma: 94,
  orcamento: 95,
  carta_submissao: 96,
  referencias: 100,
}

const RANK_NEUTRO = 50

export function rankSecaoDocumento(chaveSecao: string): number {
  return RANK[chaveSecao] ?? RANK_NEUTRO
}

/**
 * Ordena seções para a ordem do DOCUMENTO final (ABNT), de forma estável:
 * empates e seções não mapeadas preservam a ordem original (de elaboração).
 */
export function ordenarSecoesParaDocumento<T extends { chave_secao: string }>(secoes: T[]): T[] {
  return secoes
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (rankSecaoDocumento(a.s.chave_secao) - rankSecaoDocumento(b.s.chave_secao)) || (a.i - b.i))
    .map(x => x.s)
}
