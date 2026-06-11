import type { FaseConfig, SecaoTrabalho, DadosProjeto, TipoTrabalho } from '@/types'
import { fasesEfetivas } from '@/lib/tipos/fases-efetivas'
import { shouldShowEditorSection } from '@/lib/tipos/workTypeSchemas'

// ── Fonte ÚNICA de verdade do progresso de um trabalho ────────────────────────
// Editor (Sidebar) e Exportação divergiam: o editor contava trabalhos.fases_concluidas
// (array que fica DEFASADO quando uma seção é limpa/regerada → 100% falso) sobre as
// fases efetivas; a exportação contava "seções com conteúdo" sobre o total BRUTO do
// fluxo. Resultado: um dizia 100% e o outro 88%. Aqui centralizamos um critério único,
// honesto e universal (vale para todo tipo de trabalho): conta as fases do documento
// cuja seção já tem CONTEÚDO REAL.

/** Uma seção "tem conteúdo" quando há texto real (não-vazio após trim). */
export function secaoTemConteudo(conteudo?: string | null): boolean {
  return !!conteudo && conteudo.trim().length > 0
}

/** Lista CANÔNICA de fases que compõem o documento — a MESMA no editor e na
 *  exportação. Aplica as fases efetivas (oculta ética/CEP quando a pesquisa não
 *  exige) e o filtro de seções por tipo de trabalho (workTypeSchemas). */
export function fasesDoDocumento(
  tipoTrabalho: TipoTrabalho,
  fluxoFases: FaseConfig[],
  dadosProjeto: DadosProjeto | null | undefined,
): FaseConfig[] {
  return fasesEfetivas(fluxoFases, dadosProjeto ?? null, tipoTrabalho)
    .filter(f => shouldShowEditorSection(tipoTrabalho, f.chave_secao))
}

/** Progresso do trabalho — conta as fases (do documento) cuja seção já tem
 *  conteúdo real. NÃO usa trabalhos.fases_concluidas (que pode ficar defasado). */
export function calcularProgresso(
  fases: Pick<FaseConfig, 'chave_secao'>[],
  secoes: Pick<SecaoTrabalho, 'chave_secao' | 'conteudo'>[],
): { concluidas: string[]; total: number; percent: number; completo: boolean } {
  const mapa = new Map(secoes.map(s => [s.chave_secao, s.conteudo]))
  const concluidas = fases
    .filter(f => secaoTemConteudo(mapa.get(f.chave_secao)))
    .map(f => f.chave_secao)
  const total = fases.length
  const percent = total > 0 ? Math.round((concluidas.length / total) * 100) : 0
  return { concluidas, total, percent, completo: total > 0 && concluidas.length === total }
}
