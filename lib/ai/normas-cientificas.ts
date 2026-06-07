/**
 * Normas científicas rigorosas por seção — o "portão de qualidade".
 *
 * Para CADA seção de um trabalho científico, define:
 *  - a estrutura correta exigida pela norma
 *  - o que DEVE conter (checklist pré-geração)
 *  - o que é PROIBIDO
 *  - o que revisar APÓS gerar (checklist pós-geração)
 *
 * Injetado em toda geração com a moldura "VERIFIQUE ANTES E DEPOIS DE ESCREVER",
 * forçando a IA a redigir já dentro das normas e a se auto-corrigir ao final.
 */

export interface NormasSecao {
  estrutura: string[]      // ordem/estrutura obrigatória
  deveConter: string[]     // itens obrigatórios
  proibido: string[]       // erros que invalidam a seção
  revisarApos: string[]    // checklist de auto-revisão pós-geração
}

/** Identifica a categoria normativa da seção a partir da chave. */
function categoriaSecao(chaveSecao: string): string {
  const c = chaveSecao.toLowerCase()
  if (c.includes('introducao') || c.includes('introdução')) return 'introducao'
  if (c.includes('revisao') || c.includes('referencial') || c.includes('estado_arte') || c.includes('estado da arte')) return 'revisao'
  if (c.includes('objetivo')) return 'objetivos'
  if (c.includes('justificativa')) return 'justificativa'
  if (c === 'pico' || c.includes('pergunta_pico') || c.includes('problema') || c.includes('pergunta')) return 'problema'
  if (c.includes('metodo') || c.includes('metodolog') || c.includes('delineamento') || c.includes('coleta')) return 'metodos'
  if (c.includes('resultado')) return 'resultados'
  if (c.includes('discuss')) return 'discussao'
  if (c.includes('conclus') || c.includes('consideracoes') || c.includes('considerações')) return 'conclusao'
  if (c.includes('resumo') || c.includes('abstract')) return 'resumo'
  if (c.includes('etic') || c.includes('aspectos_eticos') || c.includes('tcle') || c.includes('consentimento')) return 'etica'
  return 'geral'
}

const NORMAS: Record<string, NormasSecao> = {
  introducao: {
    estrutura: [
      'Estrutura em funil: do geral (contexto amplo) para o específico (lacuna e objetivo).',
      'ÚLTIMO parágrafo: enuncie o objetivo do estudo de forma clara ("O objetivo deste estudo foi...").',
    ],
    deveConter: [
      'Contextualização do tema com dados epidemiológicos/estatísticos reais e citados',
      'Magnitude/relevância do problema',
      'Lacuna de conhecimento claramente identificada (o que ainda não se sabe)',
      'Objetivo do estudo ao final',
    ],
    proibido: [
      'Apresentar resultados ou conclusões do próprio estudo',
      'Revisão de literatura exaustiva (isso é outra seção)',
      'Afirmações factuais sem citação',
      'Começar com frase genérica vazia ("Desde os primórdios da humanidade...")',
    ],
    revisarApos: [
      'A introdução vai do geral ao específico e termina no objetivo?',
      'TODA afirmação factual (epidemiologia, prevalência, mecanismo) tem citação?',
      'A lacuna está explícita?',
    ],
  },

  revisao: {
    estrutura: [
      'Organize por SUBTEMAS (não por artigo, nem em ordem cronológica de leitura).',
      'Cada subtema: apresente o que a literatura diz, compare estudos, e finalize apontando a lacuna.',
    ],
    deveConter: [
      'Síntese CRÍTICA — comparar concordâncias e divergências entre estudos, não apenas resumir cada um',
      'Citação real em praticamente TODA sentença factual',
      'Identificação de consensos e controvérsias',
      'A lacuna que o trabalho preenche',
    ],
    proibido: [
      'Resumir artigos um a um ("O estudo X fez... O estudo Y fez...") sem síntese',
      'Sentença factual sem citação',
      'Citar o mesmo autor repetidamente quando há outras fontes disponíveis',
      'Opinião do autor sem fundamentação na literatura',
    ],
    revisarApos: [
      'Está organizado por subtemas e faz síntese crítica (não lista de resumos)?',
      'Quase toda sentença tem citação real? Há diversidade de fontes?',
      'A lacuna ficou clara?',
    ],
  },

  objetivos: {
    estrutura: [
      'Objetivo Geral: UMA frase, verbo no infinitivo, alinhado à pergunta de pesquisa.',
      'Objetivos Específicos: lista numerada de 3-5 itens, cada um uma ação mensurável.',
    ],
    deveConter: ['Objetivo geral em uma frase', 'Objetivos específicos numerados (3-5)'],
    proibido: [
      'Parágrafos narrativos ou contextualização',
      'Citações ou justificativa nesta seção',
      'Verbos vagos não-mensuráveis ("entender", "conhecer", "refletir")',
      'Objetivo geral igual ao título',
    ],
    revisarApos: [
      'O objetivo geral é UMA frase com verbo no infinitivo?',
      'Os específicos são mensuráveis e numerados?',
      'Não há prosa nem citação?',
    ],
  },

  problema: {
    estrutura: ['Apresente o problema e a pergunta de pesquisa de forma direta e específica.'],
    deveConter: ['Pergunta de pesquisa clara, específica e respondível', 'Variáveis/elementos do problema'],
    proibido: ['Pergunta vaga ou ampla demais', 'Múltiplas perguntas misturadas sem hierarquia'],
    revisarApos: ['A pergunta é específica e respondível com a metodologia proposta?'],
  },

  justificativa: {
    estrutura: ['Argumente a relevância científica, social/prática e a lacuna de conhecimento.'],
    deveConter: [
      'Relevância científica e social/prática com dados reais citados',
      'Lacuna de conhecimento',
      'Quem se beneficia dos resultados',
    ],
    proibido: ['Justificativa genérica sem dados', 'Confundir justificativa com objetivos', 'Afirmação factual sem citação'],
    revisarApos: ['Responde "por que estudar isso agora?" com dados citados?'],
  },

  metodos: {
    estrutura: [
      'PRIMEIRA frase: declare o delineamento ("Trata-se de um estudo...").',
      'Sequência: delineamento → local/período → população/amostra → critérios → instrumentos → coleta → análise → ética.',
    ],
    deveConter: [
      'Delineamento explícito na primeira frase',
      'Detalhe suficiente para REPLICAÇÃO por outro pesquisador',
      'Instrumentos/escalas validados citados com referência original',
      'Análise de dados com software e nível de significância (quando quantitativo)',
      'Checklist metodológico quando aplicável (CONSORT/STROBE/PRISMA/CARE)',
    ],
    proibido: [
      'Metodologia vaga ou incompleta',
      'Citar instrumento/escala validado SEM referência',
      'Apresentar resultados nesta seção',
      'Inventar nomes de instituições, números de aprovação ética ou dados não fornecidos',
    ],
    revisarApos: [
      'O delineamento está na primeira frase?',
      'Outro pesquisador conseguiria replicar com este texto?',
      'Todo instrumento/escala tem referência?',
    ],
  },

  resultados: {
    estrutura: [
      'Apresente na ordem dos objetivos: caracterização da amostra → desfecho primário → secundários.',
      'Descreva tabelas e figuras no texto (não apenas "ver Tabela 1").',
    ],
    deveConter: [
      'Apenas DADOS, sem interpretação',
      'Estatística descritiva (média ± DP ou mediana [IIQ]) e inferencial (IC 95% + valor-p)',
      'Tabela 1 = caracterização da amostra (em estudos com participantes)',
    ],
    proibido: [
      'Interpretar ou discutir os resultados (isso é a Discussão)',
      'Comparar com a literatura aqui',
      'Inventar números — usar SOMENTE os dados reais fornecidos pelo pesquisador',
      'Tabela ou figura sem descrição no texto',
    ],
    revisarApos: [
      'Há só dados, sem interpretação?',
      'Os números são exatamente os fornecidos (nada inventado)?',
      'As tabelas/figuras estão descritas no texto?',
    ],
  },

  discussao: {
    estrutura: [
      'PRIMEIRO parágrafo: o achado principal respondendo ao objetivo (1-2 frases).',
      'Depois: comparação com a literatura → mecanismos → limitações (penúltimo) → implicações (último).',
    ],
    deveConter: [
      'Achado principal posicionado no campo logo no início',
      'Comparação com estudos convergentes E divergentes (citados)',
      'Explicação de divergências e mecanismos',
      'Limitações honestas do estudo',
      'Implicações práticas com verbos adequados ao nível de evidência',
    ],
    proibido: [
      'Repetir os resultados sem interpretá-los',
      'Discussão sem citação da literatura',
      'Omitir limitações',
      'Extrapolar além do que os dados permitem',
    ],
    revisarApos: [
      'Começa com o achado principal?',
      'Compara com a literatura (convergente e divergente) citando?',
      'Declara limitações? Não extrapola?',
    ],
  },

  conclusao: {
    estrutura: ['Responda diretamente à pergunta de pesquisa e retome os objetivos. Conciso.'],
    deveConter: ['Resposta objetiva à pergunta de pesquisa', 'Recomendação para prática e/ou pesquisa futura'],
    proibido: [
      'Introduzir dados ou resultados novos',
      'Repetir a discussão na íntegra',
      'Generalizações além das evidências',
      'Conclusão igual ao resumo',
    ],
    revisarApos: ['Responde à pergunta sem dados novos?', 'É concisa e não extrapola?'],
  },

  resumo: {
    estrutura: ['Sequência: contexto → objetivo → método → resultados → conclusão. Conforme limite de palavras do formato.'],
    deveConter: ['Objetivo, método, principais resultados e conclusão', 'Palavras-chave (preferir DeCS/MeSH)'],
    proibido: ['Citações no resumo', 'Abstract como tradução literal', 'Ultrapassar o limite de palavras', 'Dados não presentes no trabalho'],
    revisarApos: ['Contém objetivo+método+resultados+conclusão dentro do limite?', 'Sem citações?'],
  },

  etica: {
    estrutura: ['Descreva a conformidade ética conforme a Resolução CNS 466/2012 (e 510/2016 para ciências humanas).'],
    deveConter: [
      'Tipo de pesquisa quanto à ética (envolve seres humanos ou não)',
      'Aprovação do CEP (CAAE + parecer) OU justificativa de dispensa — usar [COLCHETES] se não fornecido',
      'TCLE/assentimento quando aplicável',
    ],
    proibido: [
      'Inventar número CAAE, número de parecer, datas de aprovação ou nome de CEP',
      'Afirmar aprovação ética que não foi fornecida',
    ],
    revisarApos: ['Os números de CAAE/parecer estão em [COLCHETES] (não inventados)?'],
  },

  geral: {
    estrutura: ['Siga a estrutura convencional da seção para o tipo de trabalho.'],
    deveConter: ['Conteúdo completo e adequado à seção', 'Citação real para afirmações factuais'],
    proibido: ['Afirmação factual sem citação', 'Inventar dados ou referências'],
    revisarApos: ['O conteúdo está completo e dentro das normas da seção?'],
  },
}

/**
 * Retorna o bloco de normas rigorosas da seção, com a moldura de portão de
 * qualidade (verificar antes e auto-revisar depois de escrever).
 */
export function getNormasSecao(chaveSecao: string, nomeSecao: string): string {
  const n = NORMAS[categoriaSecao(chaveSecao)] ?? NORMAS.geral
  const lista = (arr: string[]) => arr.map(s => `   • ${s}`).join('\n')
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PORTÃO DE QUALIDADE — NORMAS DA SEÇÃO "${nomeSecao}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Antes de escrever, internalize estas normas. NÃO escreva "de qualquer jeito".

ESTRUTURA CORRETA:
${lista(n.estrutura)}

DEVE CONTER (obrigatório):
${lista(n.deveConter)}

PROIBIDO (invalida a seção):
${lista(n.proibido)}

🔍 AUTO-REVISÃO OBRIGATÓRIA — ao terminar, releia o texto e confirme cada item antes de entregar:
${lista(n.revisarApos)}
Se algum item falhar, CORRIJA antes de finalizar. Entregue apenas texto que passe em TODOS os itens.`
}
