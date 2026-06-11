// ============================================================
// CIENTÍFICA AI — Pontos de intervenção do AUTOR (ADAPTADOS por natureza do trabalho)
// ============================================================
// O app gera o trabalho, mas há pontos que SÓ O AUTOR pode dar — e eles DEPENDEM da
// natureza do trabalho. NÃO é generalista: uma REVISÃO não tem dados primários; um
// PROJETO ainda não tem resultados; um RELATO gira em torno do caso. Cada natureza tem
// seu conjunto de pontos, com o que escrever, por que a banca cobra e a seção-alvo.

import type { DadosProjeto } from '@/types'

export type NaturezaTrabalho = 'revisao' | 'empirico' | 'relato' | 'projeto'

export type NivelAcademico = 'ic' | 'graduacao' | 'especializacao' | 'mestrado' | 'doutorado' | 'artigo'

/**
 * Nível acadêmico do trabalho — a EXIGÊNCIA escala com ele. NÃO se cobra de um TCC o
 * que se cobra de uma tese (contribuição original ao conhecimento). Devolve o nível e
 * uma "expectativa" curta usada para calibrar a profundidade (Ensaio, Diretriz).
 */
export function nivelAcademico(tipo: string | undefined): { nivel: NivelAcademico; rotulo: string; expectativa: string } {
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('tese') || t.includes('doutorado')) return { nivel: 'doutorado', rotulo: 'Tese (Doutorado)', expectativa: 'Exige CONTRIBUIÇÃO ORIGINAL e inédita ao conhecimento, profundidade teórica e rigor metodológico de excelência. A banca cobra ineditismo e domínio profundo.' }
  if (t.includes('dissertacao') || t.includes('mestrado')) return { nivel: 'mestrado', rotulo: 'Dissertação (Mestrado)', expectativa: 'Exige contribuição relevante, domínio metodológico sólido e revisão abrangente — não necessariamente inédita, mas consistente e bem fundamentada.' }
  if (t.includes('relatorio_ic') || t.includes('inicia')) return { nivel: 'ic', rotulo: 'Iniciação Científica', expectativa: 'Nível inicial: clareza, método correto e bom relato. Rigor proporcional ao começo da formação — NÃO se exige contribuição inédita.' }
  if (t.includes('especial')) return { nivel: 'especializacao', rotulo: 'Especialização', expectativa: 'Aplicação aprofundada de conhecimento consolidado; revisão consistente. Não se exige ineditismo.' }
  if (t.includes('tcc') || t.includes('monografia') || t.includes('graduacao')) return { nivel: 'graduacao', rotulo: 'Graduação (TCC/Monografia)', expectativa: 'Exige DOMÍNIO e aplicação CORRETA do método e da literatura. NÃO se exige contribuição inédita ao conhecimento — competência e coerência bastam.' }
  return { nivel: 'artigo', rotulo: 'Artigo / publicação', expectativa: 'Padrão de publicação: foco, rigor metodológico e relevância para a comunidade científica.' }
}

/** Natureza do trabalho — define o que a banca cobra. Deriva do tipo e da coleta. */
export function naturezaTrabalho(tipo: string | undefined, dados?: Partial<DadosProjeto> | null): NaturezaTrabalho {
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('revis')) return 'revisao'          // artigo_revisao, revisao_sistematica
  if (t.includes('relato')) return 'relato'          // relato_caso
  if (t.includes('projeto')) return 'projeto'        // projeto_pesquisa
  if (t === 'artigo_original') return 'empirico'
  // Acadêmicos (tcc/monografia/dissertacao/tese/relatorio_ic): empírico só se houver
  // coleta primária / seres humanos; senão tratamos como revisão (exigência mais leve).
  const d = dados ?? {}
  if (d.tipo_coleta === 'primaria' || d.envolve_seres_humanos) return 'empirico'
  return 'revisao'
}

export interface PontoAutor {
  id: string
  campo: 'notas_contexto' | 'notas_metodologia' | 'dados_coletados' | 'notas_interpretacao'
  titulo: string
  oQueEscrever: string
  porQue: string
  secaoAlvo: string[]
  obrigatorio: boolean
}

export interface PontoAutorAvaliado extends PontoAutor {
  preenchido: boolean
}

// Pontos por natureza — NÃO generalista. Cada lista pede só o que aquela banca cobra.
const PONTOS_POR_NATUREZA: Record<NaturezaTrabalho, PontoAutor[]> = {
  revisao: [
    { id: 'contribuicao', campo: 'notas_contexto', titulo: 'Seu recorte e contribuição crítica', obrigatorio: true,
      oQueEscrever: 'Qual o seu recorte/ângulo, sua leitura crítica da literatura e a LACUNA que a sua revisão evidencia.',
      porQue: 'A banca de uma revisão cobra a sua síntese crítica e o que ela acrescenta — não dados primários.',
      secaoAlvo: ['introducao', 'justificativa'] },
    { id: 'busca', campo: 'notas_metodologia', titulo: 'Estratégia de busca e critérios', obrigatorio: false,
      oQueEscrever: 'As bases, descritores, período e critérios de inclusão/exclusão que você de fato usou na seleção da literatura.',
      porQue: 'A banca examina como você selecionou as fontes — a reprodutibilidade da busca.',
      secaoAlvo: ['metodologia', 'metodologia_busca', 'metodos'] },
  ],
  empirico: [
    { id: 'contexto', campo: 'notas_contexto', titulo: 'Contexto real e sua contribuição original', obrigatorio: true,
      oQueEscrever: 'Descreva o contexto/motivação reais e, sobretudo, O QUE HÁ DE NOVO no seu estudo — a lacuna que ele preenche.',
      porQue: 'A primeira pergunta da banca é "qual a contribuição original?". Isto vem de você.',
      secaoAlvo: ['introducao', 'justificativa'] },
    { id: 'metodologia', campo: 'notas_metodologia', titulo: 'Como o estudo/coleta realmente aconteceu', obrigatorio: true,
      oQueEscrever: 'O que VOCÊ fez de fato: delineamento, local, período, instrumentos e — se houver — o número e a data da aprovação do CEP/CONEP.',
      porQue: 'A banca examina o rigor e a reprodutibilidade do método REAL.',
      secaoAlvo: ['metodologia', 'metodos', 'metodos_delineamento'] },
    { id: 'dados', campo: 'dados_coletados', titulo: 'Dados e resultados REAIS', obrigatorio: true,
      oQueEscrever: 'Cole os dados/achados reais coletados (números, percentuais, tabelas). A IA NÃO inventa dados — usa só o que você fornecer.',
      porQue: 'Resultados são o coração do estudo empírico; a banca confere os dados originais.',
      secaoAlvo: ['resultados', 'resultados_discussao', 'desenvolvimento'] },
    { id: 'interpretacao', campo: 'notas_interpretacao', titulo: 'Sua interpretação e limitações', obrigatorio: true,
      oQueEscrever: 'O que VOCÊ entende dos achados, como dialogam com a literatura, e as limitações reais que percebeu.',
      porQue: 'A banca valoriza o pensamento crítico do autor e a honestidade sobre os limites.',
      secaoAlvo: ['discussao', 'resultados_discussao', 'consideracoes_finais'] },
  ],
  relato: [
    { id: 'contexto', campo: 'notas_contexto', titulo: 'Relevância do caso', obrigatorio: true,
      oQueEscrever: 'Por que ESTE caso merece relato (raridade, desfecho atípico, lição clínica).',
      porQue: 'A banca de um relato cobra o que o caso ensina — sua relevância.',
      secaoAlvo: ['introducao'] },
    { id: 'caso', campo: 'dados_coletados', titulo: 'O caso real e o consentimento', obrigatorio: true,
      oQueEscrever: 'A descrição clínica real: história, exames, conduta, evolução e desfecho — e a confirmação do CONSENTIMENTO do paciente. A IA não inventa dados clínicos.',
      porQue: 'O caso é o objeto; a banca confere os dados reais e a ética (consentimento, anonimização).',
      secaoAlvo: ['relato_caso', 'caso', 'desenvolvimento', 'resultados'] },
    { id: 'interpretacao', campo: 'notas_interpretacao', titulo: 'Discussão e lições do caso', obrigatorio: true,
      oQueEscrever: 'Como o caso dialoga com a literatura e que lição prática ele traz.',
      porQue: 'A banca cobra a articulação do caso com o conhecimento existente.',
      secaoAlvo: ['discussao', 'consideracoes_finais'] },
  ],
  projeto: [
    { id: 'contribuicao', campo: 'notas_contexto', titulo: 'Lacuna e contribuição esperada', obrigatorio: true,
      oQueEscrever: 'A lacuna real que o projeto ataca e a contribuição que se espera dele.',
      porQue: 'Na qualificação, a banca cobra a relevância e o ineditismo do que se PROPÕE.',
      secaoAlvo: ['introducao', 'justificativa'] },
    { id: 'viabilidade', campo: 'notas_metodologia', titulo: 'Plano de método e viabilidade', obrigatorio: true,
      oQueEscrever: 'O método PLANEJADO (delineamento, população, instrumentos, análise) e por que é viável (recursos, prazo, acesso).',
      porQue: 'A banca de qualificação examina se o método proposto é adequado e EXEQUÍVEL — ainda não há resultados.',
      secaoAlvo: ['metodologia', 'metodos'] },
  ],
}

function preenchido(valor: unknown): boolean {
  return typeof valor === 'string' ? valor.trim().length >= 10 : !!valor
}

/**
 * Feedback imediato sobre o que o autor escreveu num ponto — para não deixá-lo achar
 * que "qualquer coisa serve". Determinístico (sem custo): avisa se está curto demais
 * ou se um ponto de DADOS veio sem números. Devolve { ok, dica }.
 */
export function avaliarPreenchimento(campo: string, texto: string): { ok: boolean; dica?: string } {
  const t = (texto ?? '').trim()
  if (!t) return { ok: true }   // vazio: ainda não preencheu (o alerta de obrigatório cuida disso)
  if (t.length < 30) return { ok: false, dica: 'Está muito curto — descreva em frases completas, com detalhe. A IA usa exatamente o que você der.' }
  if (campo === 'dados_coletados' && !/\d/.test(t)) {
    return { ok: false, dica: 'Faltam NÚMEROS — inclua os dados reais (ex.: "mortalidade de 42% (n=80)"). Sem dado concreto, não há resultado para a banca.' }
  }
  return { ok: true }
}

/**
 * Avalia os pontos do autor para o trabalho, ADAPTADOS à natureza (revisão/empírico/
 * relato/projeto). Retorna quais se aplicam, quais são obrigatórios e o que falta.
 */
export function prontidaoAutor(tipo: string | undefined, dados: Partial<DadosProjeto> | null | undefined): {
  natureza: NaturezaTrabalho
  pontos: PontoAutorAvaliado[]
  obrigatoriosPendentes: number
  totalObrigatorios: number
  pronto: boolean
} {
  const natureza = naturezaTrabalho(tipo, dados)
  const d = dados ?? {}
  const pontos: PontoAutorAvaliado[] = PONTOS_POR_NATUREZA[natureza].map(p => ({
    ...p,
    preenchido: preenchido((d as Record<string, unknown>)[p.campo]),
  }))
  const obrig = pontos.filter(p => p.obrigatorio)
  const obrigatoriosPendentes = obrig.filter(p => !p.preenchido).length
  return { natureza, pontos, obrigatoriosPendentes, totalObrigatorios: obrig.length, pronto: obrigatoriosPendentes === 0 }
}
