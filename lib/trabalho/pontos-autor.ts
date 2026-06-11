// ============================================================
// CIENTÍFICA AI — Pontos de intervenção do AUTOR (o que só você pode dar)
// ============================================================
// O app gera o trabalho, mas há pontos que SÓ O AUTOR pode preencher (dados reais,
// método real, contribuição, interpretação) — é o que a BANCA cobra do autor, não do
// app. Aqui definimos esses pontos com: o que escrever, por que a banca exige, onde
// salva (reusa os campos de DadosProjeto que JÁ alimentam a geração) e se é obrigatório
// para aquele tipo de estudo. A IA depois integra o que o autor escreveu (sem inventar).

import type { DadosProjeto } from '@/types'

export interface PontoAutor {
  id: string
  /** Campo de DadosProjeto onde o texto do autor é salvo (já usado na geração). */
  campo: 'notas_contexto' | 'notas_metodologia' | 'dados_coletados' | 'notas_interpretacao'
  titulo: string
  /** Instrução clara do que o autor deve escrever aqui. */
  oQueEscrever: string
  /** O que a BANCA espera neste ponto (o porquê). */
  porQue: string
}

export interface PontoAutorAvaliado extends PontoAutor {
  obrigatorio: boolean
  preenchido: boolean
}

/** Estudo empírico (coleta própria / seres humanos) → dados e método reais são obrigatórios. */
function ehEmpirico(d: Partial<DadosProjeto>): boolean {
  return d.tipo_coleta === 'primaria' || !!d.envolve_seres_humanos
}

const PONTOS: { ponto: PontoAutor; obrigatorio: (d: Partial<DadosProjeto>) => boolean }[] = [
  {
    ponto: {
      id: 'contexto', campo: 'notas_contexto', titulo: 'Contexto real e sua contribuição original',
      oQueEscrever: 'Descreva o contexto/motivação reais e, sobretudo, O QUE HÁ DE NOVO no seu trabalho — a lacuna que ele preenche.',
      porQue: 'A primeira pergunta da banca é "qual a contribuição original?". Isto precisa vir de você, não da literatura.',
    },
    obrigatorio: () => true,
  },
  {
    ponto: {
      id: 'metodologia', campo: 'notas_metodologia', titulo: 'Como o estudo/coleta realmente aconteceu',
      oQueEscrever: 'Descreva o que VOCÊ fez de fato: delineamento, local, período, instrumentos e — se houver — o número e a data da aprovação do CEP/CONEP.',
      porQue: 'A banca examina o rigor e a reprodutibilidade do método REAL — não um método genérico gerado por IA.',
    },
    obrigatorio: ehEmpirico,
  },
  {
    ponto: {
      id: 'dados', campo: 'dados_coletados', titulo: 'Dados e resultados REAIS',
      oQueEscrever: 'Cole os dados/achados reais coletados (números, percentuais, tabelas). A IA NÃO inventa dados — usa SOMENTE o que você fornecer.',
      porQue: 'Resultados são o coração de um estudo empírico; a banca confere os dados originais e a coerência deles.',
    },
    obrigatorio: ehEmpirico,
  },
  {
    ponto: {
      id: 'interpretacao', campo: 'notas_interpretacao', titulo: 'Sua interpretação e limitações',
      oQueEscrever: 'Explique o que VOCÊ entende dos achados, como eles dialogam com a literatura, e as limitações reais que percebeu.',
      porQue: 'A banca valoriza o pensamento crítico do autor e a honestidade sobre os limites do trabalho.',
    },
    obrigatorio: ehEmpirico,
  },
]

function preenchido(valor: unknown): boolean {
  return typeof valor === 'string' ? valor.trim().length >= 10 : !!valor
}

/**
 * Avalia os pontos do autor para um trabalho: quais se aplicam, quais são obrigatórios
 * (conforme o tipo de estudo) e quais já estão preenchidos. Base da "prontidão p/ a banca".
 */
export function prontidaoAutor(dados: Partial<DadosProjeto> | null | undefined): {
  pontos: PontoAutorAvaliado[]
  obrigatoriosPendentes: number
  totalObrigatorios: number
  pronto: boolean
} {
  const d = dados ?? {}
  const pontos: PontoAutorAvaliado[] = PONTOS.map(({ ponto, obrigatorio }) => ({
    ...ponto,
    obrigatorio: obrigatorio(d),
    preenchido: preenchido((d as Record<string, unknown>)[ponto.campo]),
  }))
  const obrig = pontos.filter(p => p.obrigatorio)
  const obrigatoriosPendentes = obrig.filter(p => !p.preenchido).length
  return { pontos, obrigatoriosPendentes, totalObrigatorios: obrig.length, pronto: obrigatoriosPendentes === 0 }
}
