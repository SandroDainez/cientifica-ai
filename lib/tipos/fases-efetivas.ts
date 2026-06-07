import type { FaseConfig, DadosProjeto, Trabalho } from '@/types'

const TIPOS_BIBLIOGRAFICOS = new Set(['artigo_revisao', 'revisao_sistematica'])

// Fases ligadas à ética em pesquisa (CEP/TCLE) — só fazem sentido em pesquisa
// PRIMÁRIA com seres humanos/animais.
const FASES_ETICA = new Set(['aspectos_eticos', 'tcle_modelo'])

/** Extrai o dados_projeto de um trabalho (quando existir). */
export function getDadosProjeto(trabalho: Pick<Trabalho, 'dados_trabalho'>): DadosProjeto | null {
  return ((trabalho.dados_trabalho as Record<string, unknown> | null)?.dados_projeto as DadosProjeto | undefined) ?? null
}

/**
 * Filtra as fases do fluxo conforme o tipo de coleta do projeto. Remove a etapa
 * de Ética/CEP quando a pesquisa NÃO envolve coleta primária com seres humanos
 * (bibliográfica, dados secundários públicos/anonimizados, ou precisa_cep=false).
 *
 * Conservador: só remove com sinal EXPLÍCITO (tipo_coleta bibliografica/secundaria,
 * precisa_cep === false, ou tipo de trabalho inerentemente bibliográfico). Sem
 * plano (dados=null) ou sinais ausentes → mantém tudo (não esconde indevidamente).
 */
export function fasesEfetivas(
  fases: FaseConfig[],
  dados: DadosProjeto | null,
  tipoTrabalho?: string,
): FaseConfig[] {
  const ehBibliografico =
    dados?.tipo_coleta === 'bibliografica' || (tipoTrabalho ? TIPOS_BIBLIOGRAFICOS.has(tipoTrabalho) : false)
  const ehSecundaria = dados?.tipo_coleta === 'secundaria'
  const cepDispensado = dados?.precisa_cep === false

  const removerEtica = ehBibliografico || ehSecundaria || cepDispensado
  if (!removerEtica) return fases

  return fases.filter(f => !FASES_ETICA.has(f.chave_secao) && !/etic/i.test(f.chave_secao))
}

/** Total de fases efetivas (para barras de progresso e conclusão coerentes). */
export function totalFasesEfetivas(
  fases: FaseConfig[],
  trabalho: Pick<Trabalho, 'dados_trabalho' | 'tipo_trabalho'>,
): number {
  return fasesEfetivas(fases, getDadosProjeto(trabalho), trabalho.tipo_trabalho).length
}
