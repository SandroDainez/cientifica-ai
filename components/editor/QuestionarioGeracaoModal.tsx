'use client'

import { useState } from 'react'
import { X, Sparkles, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RespostasQuestionario = Record<string, string>

interface QuestionarioGeracaoModalProps {
  chaveSecao: string
  nomeSecao: string
  tipoTrabalho?: string
  onConfirmar: (respostas: RespostasQuestionario) => void
  onPular: () => void
  onCancelar: () => void
}

type Pergunta = {
  id: string
  pergunta: string
  tipo: 'texto' | 'textarea' | 'selecao'
  placeholder?: string
  obrigatoria: boolean
  opcoes?: string[]
  dica?: string
}

function getPerguntasParaSecao(chaveSecao: string, tipoTrabalho = ''): Pergunta[] {
  const chave = chaveSecao.toLowerCase()
  const tipo = tipoTrabalho.toLowerCase()

  // ── Título ─────────────────────────────────────────────────────
  if (chave === 'titulo' || chave.includes('titulo_escopo')) {
    return [
      {
        id: 'titulo_proposto',
        pergunta: 'Você já tem uma ideia de título? Escreva aqui (mesmo que provisório)',
        tipo: 'textarea',
        placeholder: 'Ex: O impacto das redes sociais na saúde mental de adolescentes: um estudo de caso em escolas públicas de BH',
        obrigatoria: false,
        dica: 'Se não tiver título ainda, a IA vai gerar opções — deixe em branco',
      },
      {
        id: 'palavras_chave_titulo',
        pergunta: 'Quais são as palavras mais importantes que PRECISAM estar no título?',
        tipo: 'texto',
        placeholder: 'Ex: Instagram, autoestima, adolescentes',
        obrigatoria: false,
      },
      {
        id: 'estilo_titulo',
        pergunta: 'Qual formato de título você prefere?',
        tipo: 'selecao',
        opcoes: [
          'Título direto e descritivo (mais comum)',
          'Título com dois pontos: parte 1 — parte 2',
          'Título em forma de pergunta',
          'Título que inclui o tipo de estudo (Ex: "...um estudo transversal")',
        ],
        obrigatoria: false,
      },
    ]
  }

  // ── Introdução ───────────────────────────────────────────────
  if (chave === 'introducao' || chave.includes('introducao_') || chave.includes('_introducao')) {
    return [
      {
        id: 'contexto',
        pergunta: 'Em poucas palavras, qual é o contexto geral do seu trabalho? (Área, problema, população)',
        tipo: 'textarea',
        placeholder: 'Ex: A saúde mental de adolescentes tem sido impactada pelo uso crescente de redes sociais, especialmente em populações de baixa renda...',
        obrigatoria: true,
        dica: 'A IA vai transformar isso em contextualização acadêmica — escreva de forma simples',
      },
      {
        id: 'problema_central',
        pergunta: 'Qual é o problema central que este trabalho aborda?',
        tipo: 'textarea',
        placeholder: 'Ex: Apesar do crescimento dos estudos sobre redes sociais, ainda não há dados representativos sobre adolescentes brasileiros de escola pública',
        obrigatoria: true,
      },
      {
        id: 'justificativa_intro',
        pergunta: 'Por que este problema merece ser estudado agora? (dados, epidemiologia, relevância)',
        tipo: 'textarea',
        placeholder: 'Ex: Casos de depressão em adolescentes cresceram 35% nos últimos 5 anos segundo o IBGE...',
        obrigatoria: false,
        dica: 'Se tiver dados e estatísticas, inclua aqui — eles fortalecem o argumento',
      },
    ]
  }

  // ── Resumo / Abstract ────────────────────────────────────────
  if (chave === 'resumo' || chave.includes('resumo_atividades')) {
    return [
      {
        id: 'contexto',
        pergunta: 'Há algum ponto específico que você quer destacar no resumo?',
        tipo: 'textarea',
        placeholder: 'Ex: Quero enfatizar que este é o primeiro estudo brasileiro sobre este tema / o método inédito que utilizei / o resultado mais surpreendente...',
        obrigatoria: false,
        dica: 'A IA vai gerar o resumo com base em todas as seções anteriores. Este campo é para você personalizar o que mais importa destacar.',
      },
    ]
  }

  // ── Apresentação do Caso (Relato de caso) ───────────────────
  if (chave.includes('apresentacao_caso') || chave.includes('apresentacao_do_caso')) {
    return [
      {
        id: 'queixa_principal',
        pergunta: 'Qual foi a queixa principal do paciente na apresentação?',
        tipo: 'textarea',
        placeholder: 'Ex: Paciente masculino, 34 anos, procurou atendimento com quadro de febre há 5 dias (38,5°C), tosse seca e dispneia progressiva',
        obrigatoria: true,
        dica: 'Nunca use nome, datas exatas ou dados que identificam o paciente',
      },
      {
        id: 'antecedentes',
        pergunta: 'Quais antecedentes pessoais ou familiares são relevantes para este caso?',
        tipo: 'textarea',
        placeholder: 'Ex: Hipertensão arterial há 10 anos, diabetes tipo 2, tabagismo 20 maços-ano. Pai faleceu de IAM aos 58 anos.',
        obrigatoria: false,
      },
      {
        id: 'exame_fisico',
        pergunta: 'Quais foram os achados principais no exame físico?',
        tipo: 'textarea',
        placeholder: 'Ex: PA 150/90 mmHg, FC 108 bpm, FR 22 irpm, SpO2 91% em ar ambiente. Ausculta pulmonar com crepitantes em base direita. Abdome sem alterações.',
        obrigatoria: true,
        dica: 'Inclua sinais vitais e achados positivos e negativos relevantes',
      },
    ]
  }

  // ── Investigação Diagnóstica ────────────────────────────────
  if (chave.includes('investigacao_diagnostica') || chave.includes('investigacao_diagnostica')) {
    return [
      {
        id: 'exames_laboratoriais',
        pergunta: 'Quais foram os principais exames laboratoriais e seus resultados?',
        tipo: 'textarea',
        placeholder: 'Ex: Hemograma: leucócitos 14.000/mm³ com 82% neutrófilos, PCR 12 mg/dL (VR <0.5). Glicemia: 185 mg/dL. Função renal normal.',
        obrigatoria: false,
        dica: 'Inclua valores e valores de referência quando relevante',
      },
      {
        id: 'exames_imagem',
        pergunta: 'Foram feitos exames de imagem? O que mostraram?',
        tipo: 'textarea',
        placeholder: 'Ex: Radiografia de tórax: opacidade em vidro fosco em lobo inferior direito, sugestiva de pneumonia atípica. TC de tórax: mesma área com consolidação periférica.',
        obrigatoria: false,
      },
      {
        id: 'diagnostico_diferencial',
        pergunta: 'Quais diagnósticos foram considerados antes de chegar ao diagnóstico final?',
        tipo: 'textarea',
        placeholder: 'Ex: 1. Pneumonia bacteriana típica; 2. COVID-19; 3. Tuberculose pulmonar; 4. Neoplasia pulmonar. O diagnóstico final foi pneumonia por Legionella.',
        obrigatoria: true,
        dica: 'O raciocínio diagnóstico é o que torna o relato valioso para outros médicos',
      },
    ]
  }

  // ── Conduta e Tratamento ────────────────────────────────────
  if (chave.includes('conduta_tratamento') || chave.includes('conduta') || chave.includes('tratamento')) {
    return [
      {
        id: 'tratamento_adotado',
        pergunta: 'Qual foi o tratamento adotado? (medicamentos com doses, procedimentos, cirurgias)',
        tipo: 'textarea',
        placeholder: 'Ex: Azitromicina 500 mg IV/dia por 5 dias + Ceftriaxona 2g IV/dia por 7 dias. O2 suplementar por cateter nasal 3L/min. Internação em enfermaria.',
        obrigatoria: true,
        dica: 'Use nomes genéricos dos medicamentos, com dose, via e duração',
      },
      {
        id: 'justificativa_conduta',
        pergunta: 'Por que foi escolhida essa conduta? Houve algo incomum ou controverso na decisão?',
        tipo: 'textarea',
        placeholder: 'Ex: Optamos por cobertura atípica empírica pela apresentação clínica + epidemiologia. A ausência de resposta ao β-lactâmico isolado reforçou a suspeita de Legionella.',
        obrigatoria: false,
        dica: 'A justificativa transforma um relato comum em um valioso para a educação médica',
      },
    ]
  }

  // ── Evolução e Desfecho ─────────────────────────────────────
  if (chave.includes('evolucao_desfecho') || chave.includes('evolucao') || chave.includes('desfecho')) {
    return [
      {
        id: 'evolucao_clinica',
        pergunta: 'Como foi a evolução do paciente após o tratamento? (resposta, piora, estabilização)',
        tipo: 'textarea',
        placeholder: 'Ex: No 3º dia de tratamento, febre cessou e SpO2 melhorou para 97% em ar ambiente. No 5º dia, alta hospitalar com antibioticoterapia oral.',
        obrigatoria: true,
        dica: 'Use marcadores de tempo: no 1º dia, após 48h, na alta, no retorno em 30 dias...',
      },
      {
        id: 'desfecho_final',
        pergunta: 'Qual foi o desfecho final? Houve complicações, sequelas, óbito ou cura completa?',
        tipo: 'textarea',
        placeholder: 'Ex: Cura completa sem sequelas. Em retorno ambulatorial após 30 dias, radiografia de controle sem alterações.',
        obrigatoria: true,
      },
    ]
  }

  // ── Aspectos Éticos ─────────────────────────────────────────
  if (chave.includes('aspecto') && chave.includes('etic') || chave === 'aspectos_eticos') {
    return [
      {
        id: 'cep_status',
        pergunta: 'A pesquisa foi aprovada pelo Comitê de Ética em Pesquisa (CEP)?',
        tipo: 'selecao',
        opcoes: [
          'Sim — já tenho o número do parecer CEP',
          'Sim — mas ainda não tenho o número',
          'Está em análise no CEP',
          'Não precisa de CEP (pesquisa sem envolvimento humano/animal direto)',
          'É pesquisa com dados secundários públicos — dispensa CEP',
        ],
        obrigatoria: true,
      },
      {
        id: 'numero_parecer',
        pergunta: 'Se já tem aprovação, qual é o número do parecer e a data?',
        tipo: 'texto',
        placeholder: 'Ex: Parecer nº 4.123.456 aprovado em 15/03/2024 pelo CEP-UFMG',
        obrigatoria: false,
      },
      {
        id: 'tcle',
        pergunta: 'Há Termo de Consentimento Livre e Esclarecido (TCLE) para os participantes?',
        tipo: 'selecao',
        opcoes: [
          'Sim — todos os participantes assinaram o TCLE',
          'Dispensado pelo CEP — pesquisa com dados já existentes',
          'Relato de caso — paciente assinou TCLE específico para publicação',
          'Não se aplica — pesquisa sem participantes humanos',
        ],
        obrigatoria: false,
      },
    ]
  }

  // ── Protocolo (Revisão Sistemática) ─────────────────────────
  if (chave.includes('protocolo')) {
    return [
      {
        id: 'pergunta_pico',
        pergunta: 'Qual é a pergunta PICO (ou similar) da sua revisão sistemática?',
        tipo: 'textarea',
        placeholder: 'P: Adultos com diabetes tipo 2\nI: Metformina\nC: Placebo ou nenhum tratamento\nO: Redução de HbA1c após 6 meses',
        obrigatoria: true,
        dica: 'PICO = Paciente/Problema, Intervenção, Comparação, Outcome (desfecho). Para revisões de prevalência ou diagnóstico, use variações como PICOS ou SPIDER.',
      },
      {
        id: 'prospero',
        pergunta: 'A revisão foi ou será registrada no PROSPERO?',
        tipo: 'selecao',
        opcoes: [
          'Sim — já registrei no PROSPERO (tenho o número)',
          'Sim — vou registrar antes de iniciar',
          'Não — é revisão narrativa (não exige PROSPERO)',
          'Ainda não decidi',
        ],
        obrigatoria: false,
        dica: 'Registrar no PROSPERO antes de iniciar a revisão é a melhor prática para revisões sistemáticas',
      },
      {
        id: 'numero_prospero',
        pergunta: 'Número de registro no PROSPERO (se já registrado):',
        tipo: 'texto',
        placeholder: 'Ex: CRD42024123456',
        obrigatoria: false,
      },
    ]
  }

  // ── Estratégia de Busca ─────────────────────────────────────
  if (chave.includes('estrategia_busca') || chave.includes('estrategia') || chave.includes('busca')) {
    return [
      {
        id: 'bases_dados',
        pergunta: 'Quais bases de dados você consultou ou vai consultar?',
        tipo: 'selecao',
        opcoes: [
          'PubMed/MEDLINE + SciELO + LILACS (padrão para área da saúde)',
          'PubMed/MEDLINE + Cochrane Library + Embase',
          'Web of Science + Scopus + PubMed',
          'Google Scholar + bases regionais específicas',
        ],
        obrigatoria: true,
      },
      {
        id: 'descritores',
        pergunta: 'Quais foram os descritores/termos de busca utilizados?',
        tipo: 'textarea',
        placeholder: 'Ex: ("type 2 diabetes mellitus" OR "T2DM") AND ("metformin" OR "biguanide") AND ("HbA1c" OR "glycated hemoglobin") — busca no PubMed com filtro: Clinical Trial, últimos 5 anos',
        obrigatoria: false,
        dica: 'Se ainda não fez a busca, descreva os principais descritores e os operadores booleanos que planeja usar',
      },
      {
        id: 'periodo_busca',
        pergunta: 'Qual é o período de abrangência da busca?',
        tipo: 'texto',
        placeholder: 'Ex: Janeiro de 2015 a dezembro de 2024',
        obrigatoria: false,
      },
    ]
  }

  // ── Critérios de Elegibilidade (Revisão Sistemática) ────────
  if (chave.includes('criterios') || chave.includes('elegibilidade')) {
    return [
      {
        id: 'criterios_inclusao',
        pergunta: 'Quais são os critérios de INCLUSÃO dos estudos?',
        tipo: 'textarea',
        placeholder: 'Ex:\n• Ensaios clínicos randomizados ou estudos observacionais\n• Adultos ≥18 anos com diagnóstico de DM2\n• Uso de metformina como intervenção principal\n• Desfecho HbA1c reportado\n• Publicados de 2015 a 2024',
        obrigatoria: true,
      },
      {
        id: 'criterios_exclusao',
        pergunta: 'Quais são os critérios de EXCLUSÃO?',
        tipo: 'textarea',
        placeholder: 'Ex:\n• Estudos em crianças e adolescentes\n• Diabetes tipo 1 ou gestacional\n• Sem grupo controle\n• Idiomas não cobrindo inglês, português ou espanhol',
        obrigatoria: true,
      },
    ]
  }

  // ── Triagem / PRISMA ────────────────────────────────────────
  if (chave.includes('triagem') || chave.includes('prisma')) {
    return [
      {
        id: 'numeros_triagem',
        pergunta: 'Quantos estudos foram encontrados, triados e incluídos? (para o fluxograma PRISMA)',
        tipo: 'textarea',
        placeholder: 'Identificados: 1.243 (PubMed: 678, SciELO: 231, LILACS: 334)\nApós remover duplicatas: 987\nTriagem por título/resumo: excluídos 834 (não atendiam critérios)\nLeitura completa: 153 — excluídos 121\nIncluídos na síntese: 32 estudos',
        obrigatoria: false,
        dica: 'Se ainda está na fase de triagem, coloque os números que tem até agora',
      },
      {
        id: 'motivos_exclusao',
        pergunta: 'Quais foram os principais motivos de exclusão na leitura completa?',
        tipo: 'textarea',
        placeholder: 'Ex: Sem grupo controle (n=45), população pediátrica (n=28), desfecho não reportado (n=31), artigos de revisão (n=17)',
        obrigatoria: false,
      },
    ]
  }

  // ── Extração de Dados ───────────────────────────────────────
  if (chave.includes('extracao_dados') || chave.includes('extracao')) {
    return [
      {
        id: 'dados_extraidos',
        pergunta: 'Quais dados foram extraídos de cada estudo incluído?',
        tipo: 'textarea',
        placeholder: 'Ex: Autores, ano, país, desenho do estudo, tamanho amostral, duração, dose de metformina, HbA1c basal e final, efeitos adversos reportados, qualidade metodológica (escala Jadad)',
        obrigatoria: true,
      },
      {
        id: 'instrumento_extracao',
        pergunta: 'Você usou algum instrumento padronizado de extração?',
        tipo: 'texto',
        placeholder: 'Ex: Formulário próprio no Excel / COVIDENCE / tabela da Cochrane',
        obrigatoria: false,
      },
    ]
  }

  // ── Risco de Viés ───────────────────────────────────────────
  if (chave.includes('risco_vies') || chave.includes('risco') && chave.includes('vies')) {
    return [
      {
        id: 'ferramenta_vies',
        pergunta: 'Qual ferramenta de avaliação de risco de viés foi utilizada?',
        tipo: 'selecao',
        opcoes: [
          'RoB 2 (Cochrane — para ensaios clínicos)',
          'ROBINS-I (para estudos observacionais)',
          'Newcastle-Ottawa Scale (estudos de coorte/caso-controle)',
          'QUADAS-2 (estudos de acurácia diagnóstica)',
          'Outra ferramenta específica da área',
        ],
        obrigatoria: false,
      },
      {
        id: 'resultado_vies',
        pergunta: 'Qual foi o perfil geral de risco de viés dos estudos incluídos?',
        tipo: 'textarea',
        placeholder: 'Ex: 15 estudos com baixo risco (47%), 12 com risco moderado (37%), 5 com alto risco (16%). As principais fontes de viés foram: randomização inadequada e ausência de cegamento.',
        obrigatoria: false,
      },
    ]
  }

  // ── Síntese Qualitativa / Metanálise ─────────────────────────
  if (chave.includes('sintese') || chave.includes('metanalise') || chave.includes('metanálise')) {
    return [
      {
        id: 'tipo_sintese',
        pergunta: 'Que tipo de síntese foi realizada?',
        tipo: 'selecao',
        opcoes: [
          'Síntese qualitativa narrativa (sem meta-análise)',
          'Meta-análise com modelo de efeitos fixos',
          'Meta-análise com modelo de efeitos aleatórios (DerSimonian-Laird)',
          'Meta-análise de rede (NMA)',
        ],
        obrigatoria: true,
      },
      {
        id: 'resultado_principal_sintese',
        pergunta: 'Qual foi o principal resultado da síntese/metanálise?',
        tipo: 'textarea',
        placeholder: 'Ex: Meta-análise de 32 ECR (n=4.821): metformina reduziu HbA1c em média 1,2% (IC95%: 0,9–1,5; p<0,001) vs. placebo. Heterogeneidade I²=42% (moderada).',
        obrigatoria: false,
        dica: 'Inclua o tamanho do efeito, intervalo de confiança e p-valor quando disponível',
      },
    ]
  }

  // ── Limitações ──────────────────────────────────────────────
  if (chave === 'limitacoes' || chave.includes('limitacao') || chave.includes('limitacões')) {
    return [
      {
        id: 'limitacoes_metodologicas',
        pergunta: 'Quais são as principais limitações metodológicas do seu estudo?',
        tipo: 'textarea',
        placeholder: 'Ex: Delineamento transversal não permite inferência causal. Coleta por autorrelato pode ter viés de desejabilidade social. Amostra de conveniência de uma única cidade.',
        obrigatoria: true,
        dica: 'Reconhecer limitações aumenta a credibilidade científica do trabalho',
      },
      {
        id: 'limitacoes_generalizacao',
        pergunta: 'Para quem os resultados podem (e não podem) ser generalizados?',
        tipo: 'textarea',
        placeholder: 'Ex: Resultados válidos para adolescentes de escolas públicas urbanas do Sudeste. Não generalizável para escolas privadas ou regiões rurais.',
        obrigatoria: false,
      },
    ]
  }

  // ── Cronograma ──────────────────────────────────────────────
  if (chave.includes('cronograma')) {
    return [
      {
        id: 'duracao_projeto',
        pergunta: 'Qual é a duração total do projeto?',
        tipo: 'texto',
        placeholder: 'Ex: 12 meses (março 2024 a fevereiro 2025)',
        obrigatoria: true,
      },
      {
        id: 'atividades_principais',
        pergunta: 'Quais são as principais atividades e quando cada uma acontece?',
        tipo: 'textarea',
        placeholder: 'Ex:\nMeses 1-2: Revisão de literatura\nMês 3: Submissão ao CEP\nMeses 4-6: Coleta de dados\nMeses 7-8: Análise estatística\nMeses 9-10: Escrita dos resultados\nMeses 11-12: Revisão final e submissão',
        obrigatoria: true,
        dica: 'Liste pelo menos as etapas macro — a IA vai formatar em tabela de cronograma',
      },
    ]
  }

  // ── Orçamento ───────────────────────────────────────────────
  if (chave.includes('orcamento') || chave.includes('orçamento') || chave.includes('recursos')) {
    return [
      {
        id: 'itens_orcamento',
        pergunta: 'Quais são os principais itens de custo do projeto? Estime os valores:',
        tipo: 'textarea',
        placeholder: 'Ex:\n• Material de consumo (questionários, impressões): R$ 500\n• Transporte para coleta: R$ 1.200\n• Software de análise (SPSS): R$ 2.800/ano\n• Taxa de publicação em periódico Qualis A: R$ 3.500\nTotal estimado: R$ 8.000',
        obrigatoria: false,
        dica: 'Para editais: verifique as rubricas permitidas. Justifique cada item de custo.',
      },
      {
        id: 'financiamento',
        pergunta: 'Há financiamento previsto ou solicitado? De qual agência?',
        tipo: 'texto',
        placeholder: 'Ex: Bolsa PIBIC/CNPq + auxílio pesquisa FAPESP processo 2024/12345',
        obrigatoria: false,
      },
    ]
  }

  // ── Resultados Esperados / Impacto (Projeto de Pesquisa) ────
  if (chave.includes('resultados_esperados') || chave.includes('impacto')) {
    return [
      {
        id: 'produtos_esperados',
        pergunta: 'O que o projeto vai produzir? (artigos, relatórios, protocolos, software, patentes)',
        tipo: 'textarea',
        placeholder: 'Ex: 2 artigos em periódicos Qualis A1/A2, 1 dissertação, 1 apresentação em congresso nacional, 1 protocolo clínico para a instituição parceira',
        obrigatoria: true,
      },
      {
        id: 'impacto_esperado',
        pergunta: 'Qual é o impacto esperado dos resultados? Para quem e em que escala?',
        tipo: 'textarea',
        placeholder: 'Ex: Impacto científico: preenche lacuna em dados nacionais. Impacto prático: subsidia políticas públicas de saúde mental escolar. Potencial de implementação em rede pública municipal.',
        obrigatoria: false,
      },
    ]
  }

  // ── Dificuldades e Soluções (Relatório de IC) ───────────────
  if (chave.includes('dificuldade')) {
    return [
      {
        id: 'dificuldades_encontradas',
        pergunta: 'Quais foram as principais dificuldades encontradas no período?',
        tipo: 'textarea',
        placeholder: 'Ex: Dificuldade de acesso ao banco de dados da instituição no início (resolvido com carta do orientador). Baixa taxa de resposta inicial do questionário (ampliamos o prazo e enviamos lembretes).',
        obrigatoria: true,
        dica: 'Seja honesto — dificuldades são esperadas em toda pesquisa e mostram maturidade científica',
      },
      {
        id: 'solucoes_adotadas',
        pergunta: 'Quais soluções foram adotadas ou estão planejadas para cada dificuldade?',
        tipo: 'textarea',
        placeholder: 'Ex: Para a baixa taxa de resposta: enviamos 3 lembretes por e-mail e ampliamos o prazo de 2 para 4 semanas. Taxa final: 68%.',
        obrigatoria: false,
      },
    ]
  }

  // ── Formação / Atividades de Formação (Relatório de IC) ─────
  if (chave.includes('formacao') || chave.includes('formação') || chave.includes('atividades_formacao')) {
    return [
      {
        id: 'eventos_cursos',
        pergunta: 'Quais eventos científicos, cursos ou disciplinas você participou no período?',
        tipo: 'textarea',
        placeholder: 'Ex:\n• Disciplina de Bioestatística (60h) — nota 9,5\n• Congresso Brasileiro de Cardiologia — apresentação de pôster\n• Minicurso de Revisão Sistemática (8h)\n• Workshop de Escrita Científica (4h)',
        obrigatoria: true,
        dica: 'Inclua tudo — mesmo cursos online e workshops curtos',
      },
      {
        id: 'publicacoes',
        pergunta: 'Há publicações, submissões ou apresentações resultantes do período?',
        tipo: 'textarea',
        placeholder: 'Ex: Resumo aceito no SBPC 2024. Artigo em preparação para submissão ao Journal of Adolescent Health.',
        obrigatoria: false,
      },
    ]
  }

  // ── Perspectivas / Próximas Etapas (Relatório de IC) ───────
  if (chave.includes('perspectiva') || chave.includes('proximas_etapas') || chave.includes('próximas')) {
    return [
      {
        id: 'proximas_atividades',
        pergunta: 'Quais são as principais atividades planejadas para o próximo período?',
        tipo: 'textarea',
        placeholder: 'Ex:\n• Análise estatística final dos dados (meses 7-8)\n• Escrita dos resultados (meses 8-9)\n• Submissão do artigo (mês 10)\n• Relatório final de IC (mês 12)',
        obrigatoria: true,
      },
      {
        id: 'perspectivas_publicacao',
        pergunta: 'Há perspectiva de publicação ou apresentação em congresso?',
        tipo: 'textarea',
        placeholder: 'Ex: Planejamos submeter os resultados ao Brazilian Journal of Medical and Biological Research (Qualis A2) até dezembro de 2024.',
        obrigatoria: false,
      },
    ]
  }

  // ── Tema ─────────────────────────────────────────────────────
  if (chave.includes('tema')) {
    return [
      {
        id: 'tema_principal',
        pergunta: 'Qual é o assunto principal do seu trabalho?',
        tipo: 'textarea',
        placeholder: 'Ex: O impacto das redes sociais na saúde mental de adolescentes',
        obrigatoria: true,
        dica: 'Escreva de forma simples — a IA vai transformar em linguagem acadêmica',
      },
      {
        id: 'delimitacao',
        pergunta: 'O que especificamente você quer estudar dentro desse tema?',
        tipo: 'textarea',
        placeholder:
          'Ex: Como o uso do Instagram por mais de 3h/dia afeta a autoestima de jovens de 13 a 17 anos em escolas públicas de BH',
        obrigatoria: true,
        dica: 'Quanto mais específico você for, mais personalizado e profissional ficará o texto',
      },
      {
        id: 'motivacao',
        pergunta: 'Por que esse tema chamou sua atenção? O que te motivou?',
        tipo: 'textarea',
        placeholder:
          'Ex: Trabalho com adolescentes e percebi que... / Passei por isso e quis entender melhor...',
        obrigatoria: false,
        dica: 'Um motivo pessoal torna o trabalho mais autêntico — pode ser algo que você viveu ou observou',
      },
    ]
  }

  if (chave.includes('problema') || chave.includes('pico')) {
    return [
      {
        id: 'problema_central',
        pergunta: 'Qual é a dúvida ou problema que seu trabalho quer resolver?',
        tipo: 'textarea',
        placeholder:
          'Ex: Ainda não sabemos se o uso do Instagram por mais de 3h/dia prejudica a autoestima de adolescentes brasileiros...',
        obrigatoria: true,
      },
      {
        id: 'pergunta_norteadora',
        pergunta:
          "Escreva sua pergunta principal em uma frase (começa com 'Qual', 'Como', 'O que'...)",
        tipo: 'texto',
        placeholder:
          'Ex: Qual é o efeito do uso diário do Instagram na autoestima de adolescentes brasileiros?',
        obrigatoria: true,
        dica: 'Essa pergunta é o coração do seu trabalho',
      },
      {
        id: 'hipotese',
        pergunta: 'O que você acredita que vai descobrir? (pode errar — é uma suposição)',
        tipo: 'textarea',
        placeholder:
          'Ex: Acredito que jovens que usam mais de 3h/dia têm autoestima menor porque se comparam com imagens editadas...',
        obrigatoria: false,
        dica: 'Uma hipótese não precisa estar correta. É o que você espera encontrar ANTES de pesquisar.',
      },
    ]
  }

  if (chave.includes('objetivo')) {
    return [
      {
        id: 'objetivo_geral',
        pergunta: 'Em uma frase, o que seu trabalho quer fazer?',
        tipo: 'textarea',
        placeholder:
          'Ex: Analisar a relação entre o tempo de uso do Instagram e a autoestima de adolescentes de 13 a 17 anos em escolas públicas de Belo Horizonte',
        obrigatoria: true,
        dica: 'Comece com um verbo de ação: Analisar, Verificar, Identificar, Avaliar, Comparar, Descrever, Investigar...',
      },
      {
        id: 'objetivos_especificos',
        pergunta: 'Quais são os passos para chegar nesse objetivo? (um por linha)',
        tipo: 'textarea',
        placeholder:
          'Identificar o tempo médio de uso diário do Instagram\nVerificar a autoestima usando a Escala de Rosenberg\nCorrelacionar o tempo de uso com os escores de autoestima\nAnalisar diferenças por sexo e série escolar',
        obrigatoria: true,
        dica: 'Escreva de 3 a 5 passos concretos. Cada um deles é uma parte do seu trabalho.',
      },
    ]
  }

  if (chave === 'justificativa' && tipo === 'relato_caso') {
    // Justificativa específica para relato de caso clínico
    return [
      {
        id: 'raridade_caso',
        pergunta: 'Por que este caso é raro, incomum ou de interesse especial?',
        tipo: 'textarea',
        placeholder: 'Ex: Esta é a primeira descrição de complicação X em pacientes jovens sem comorbidades. A condição afeta <1:100.000 pessoas. O diagnóstico ocorreu de forma incomum...',
        obrigatoria: true,
        dica: 'Editores de periódicos recebem muitos relatos — precisamos mostrar por que o SEU caso merece publicação',
      },
      {
        id: 'epidemiologia_condicao',
        pergunta: 'Quais são os dados epidemiológicos da condição descrita? (incidência, prevalência)',
        tipo: 'textarea',
        placeholder: 'Ex: A síndrome X tem prevalência estimada de 1-2 casos/100.000 habitantes/ano no mundo, com menos de 50 casos descritos na literatura até 2024.',
        obrigatoria: false,
      },
      {
        id: 'contribuicao_clinica',
        pergunta: 'O que este caso acrescenta ao conhecimento existente? Qual a lição clínica?',
        tipo: 'textarea',
        placeholder: 'Ex: Este caso demonstra que a condição X pode se apresentar sem os sinais clássicos, levando a atraso diagnóstico. Alerta para diagnóstico diferencial em pacientes jovens.',
        obrigatoria: false,
        dica: 'Esta é a principal razão de publicação — a mensagem que outros médicos devem aprender com este caso',
      },
    ]
  }

  if (chave.includes('justificativa')) {
    return [
      {
        id: 'relevancia',
        pergunta: 'Por que este tema é importante para a sociedade?',
        tipo: 'textarea',
        placeholder:
          'Ex: O uso de redes sociais por adolescentes cresceu 340% nos últimos 5 anos. Problemas de autoestima já são a principal causa de abandono escolar no Brasil...',
        obrigatoria: true,
        dica: 'Se tiver dados ou estatísticas, inclua aqui — isso fortalece muito o argumento',
      },
      {
        id: 'problema_pratico',
        pergunta: 'Qual problema real este trabalho pode ajudar a resolver?',
        tipo: 'textarea',
        placeholder:
          'Ex: Pais e professores não sabem como orientar adolescentes sobre uso de redes sociais — este trabalho dá base científica para isso',
        obrigatoria: false,
      },
      {
        id: 'lacuna',
        pergunta: 'O que ainda não foi estudado sobre este tema? O que está faltando na literatura?',
        tipo: 'textarea',
        placeholder:
          'Ex: A maioria dos estudos foi feita nos EUA. Não há dados sobre adolescentes brasileiros de escolas públicas.',
        obrigatoria: false,
        dica: 'Reconhecer a lacuna mostra que você conhece o campo. Pode deixar em branco se não souber.',
      },
    ]
  }

  if (
    chave.includes('metodolog') ||
    chave.includes('metodos') ||
    chave.includes('coleta')
  ) {
    return [
      {
        id: 'tipo_pesquisa',
        pergunta: 'Como você fez (ou vai fazer) sua pesquisa?',
        tipo: 'selecao',
        opcoes: [
          'Li artigos, livros e textos sobre o tema (pesquisa bibliográfica/revisão)',
          'Apliquei questionário ou formulário para pessoas responderem',
          'Fiz entrevistas com pessoas',
          'Observei pessoas ou situações em campo',
          'Analisei dados ou documentos já existentes',
          'Fiz um experimento ou intervenção',
          'Usei mais de um método (pesquisa mista)',
        ],
        obrigatoria: true,
      },
      {
        id: 'participantes',
        pergunta: 'Quem ou o quê foi estudado?',
        tipo: 'textarea',
        placeholder:
          'Ex: 200 estudantes do ensino médio de 5 escolas públicas de BH, com idades entre 14-17 anos, sendo 110 meninas e 90 meninos',
        obrigatoria: true,
        dica: 'Inclua: número de pessoas/fontes, perfil (idade, sexo, nível de ensino), localização',
      },
      {
        id: 'periodo_local',
        pergunta: 'Quando e onde foi feita a pesquisa?',
        tipo: 'texto',
        placeholder: 'Ex: De março a junho de 2024, em Belo Horizonte (MG)',
        obrigatoria: false,
      },
      {
        id: 'instrumentos',
        pergunta: 'Que instrumentos ou ferramentas você usou para coletar os dados?',
        tipo: 'textarea',
        placeholder:
          'Ex: Questionário online (Google Forms) com 25 perguntas; Escala de Autoestima de Rosenberg (10 itens); dados de tempo de tela do smartphone',
        obrigatoria: false,
        dica: 'Se usou escalas ou questionários validados, mencione o nome completo',
      },
      {
        id: 'analise',
        pergunta: 'Como você analisou os dados que coletou?',
        tipo: 'textarea',
        placeholder:
          'Ex: Usei o SPSS para calcular médias e correlação de Pearson / Fiz análise temática das entrevistas agrupando por categorias / Usei estatística descritiva (percentuais e médias)',
        obrigatoria: false,
      },
    ]
  }

  if (chave.includes('resultado')) {
    return [
      {
        id: 'achado_principal',
        pergunta: 'Qual foi o resultado mais importante que você encontrou?',
        tipo: 'textarea',
        placeholder:
          'Ex: Adolescentes que usam Instagram por mais de 3h/dia tiveram escores de autoestima 23% menores que os que usam menos de 1h/dia (p<0.001)',
        obrigatoria: true,
        dica: 'Este é o coração do trabalho. Seja específico — inclua números se tiver',
      },
      {
        id: 'outros_achados',
        pergunta: 'Que outros resultados relevantes você encontrou?',
        tipo: 'textarea',
        placeholder:
          'Ex: Meninas foram mais afetadas que meninos (diferença de 31%); o tipo de conteúdo seguido importou mais que o tempo total; etc.',
        obrigatoria: false,
      },
      {
        id: 'dados_numericos',
        pergunta: 'Você tem números, percentuais ou dados concretos? Liste os principais:',
        tipo: 'textarea',
        placeholder:
          'N=200 participantes\n67% usam Instagram diariamente\nMédia de uso: 3,2h/dia\nEscores de autoestima: grupo <1h = 34,2; grupo >3h = 26,7\nCorrelação r=-0,42, p<0,001',
        obrigatoria: false,
        dica: 'Dados concretos fazem TODA a diferença na qualidade do texto — inclua tudo que tiver',
      },
      {
        id: 'surpresa',
        pergunta: 'Teve algum resultado surpreendente ou diferente do que você esperava?',
        tipo: 'textarea',
        placeholder:
          'Ex: Surpreendentemente, o tipo de conta seguida (influenciadores vs. amigos reais) teve mais impacto do que o tempo de uso...',
        obrigatoria: false,
      },
    ]
  }

  if (chave.includes('discussao') || chave.includes('discussão')) {
    return [
      {
        id: 'comparacao_literatura',
        pergunta:
          'Seus resultados confirmam ou contradizem o que outros pesquisadores encontraram?',
        tipo: 'textarea',
        placeholder:
          'Ex: Meus resultados confirmam Silva et al. (2020) que também encontraram relação negativa. Já Costa (2019) encontrou resultados diferentes porque estudou adolescentes mais velhos...',
        obrigatoria: true,
        dica: 'Se não lembrar os autores, descreva o que a literatura diz de forma geral',
      },
      {
        id: 'explicacao',
        pergunta: 'Por que você acha que esses resultados aconteceram? Qual é sua explicação?',
        tipo: 'textarea',
        placeholder:
          'Ex: A influência negativa pode ser explicada pela comparação social constante — adolescentes se comparam a imagens filtradas que não representam a realidade...',
        obrigatoria: true,
      },
      {
        id: 'implicacoes',
        pergunta:
          'O que seus resultados significam na prática? Quem pode usar essas informações e como?',
        tipo: 'textarea',
        placeholder:
          'Ex: Escolas podem criar programas de letramento digital; pais podem monitorar o tipo de conteúdo (não só o tempo); políticas públicas de saúde mental...',
        obrigatoria: false,
      },
      {
        id: 'limitacoes',
        pergunta: 'Quais são as limitações deste estudo? O que poderia ter sido feito diferente?',
        tipo: 'textarea',
        placeholder:
          'Ex: Amostra limitada a 5 escolas de BH — não representa todo o Brasil. Estudo transversal não permite afirmar causalidade...',
        obrigatoria: false,
        dica: 'Reconhecer limitações mostra maturidade científica e MELHORA a qualidade do trabalho',
      },
    ]
  }

  if (
    chave.includes('conclusao') ||
    chave.includes('conclusão') ||
    chave.includes('consideracoes') ||
    chave.includes('considerações')
  ) {
    return [
      {
        id: 'resposta_objetivo',
        pergunta: 'Seu trabalho atingiu o objetivo? O que você concluiu em 2-3 frases?',
        tipo: 'textarea',
        placeholder:
          'Ex: Sim, o estudo confirmou associação negativa entre uso intensivo do Instagram e autoestima. Quanto mais tempo de uso, menores os escores, especialmente em meninas.',
        obrigatoria: true,
      },
      {
        id: 'contribuicao',
        pergunta: 'Qual é a contribuição mais importante deste trabalho para a área?',
        tipo: 'textarea',
        placeholder:
          'Ex: Este é o primeiro estudo brasileiro focado especificamente no Instagram (não redes sociais em geral), preenchendo uma lacuna importante na literatura nacional',
        obrigatoria: false,
      },
      {
        id: 'recomendacoes',
        pergunta:
          'Que recomendações você daria? Para professores, gestores, pais, pesquisadores...?',
        tipo: 'textarea',
        placeholder:
          'Ex: Para professores: abordar letramento digital. Para pais: monitorar tipo de conteúdo. Para pesquisadores futuros: estudar intervenções práticas para reduzir os efeitos.',
        obrigatoria: false,
      },
    ]
  }

  if (
    chave.includes('revisao') ||
    chave.includes('revisão') ||
    chave.includes('desenvolvimento') ||
    chave.includes('referencial')
  ) {
    return [
      {
        id: 'temas_principais',
        pergunta: 'Quais são os tópicos principais que devem aparecer nesta seção?',
        tipo: 'textarea',
        placeholder:
          'Ex:\n1. Histórico das redes sociais no Brasil\n2. Teoria da comparação social de Festinger\n3. Autoestima na adolescência\n4. Estudos anteriores sobre Instagram e saúde mental',
        obrigatoria: true,
        dica: 'Liste de 3 a 6 grandes blocos temáticos. A IA vai desenvolver cada um deles.',
      },
      {
        id: 'autores_referencias',
        pergunta: 'Você tem autores ou estudos específicos que quer incluir?',
        tipo: 'textarea',
        placeholder:
          'Ex: Leon Festinger (comparação social), Rosenberg (escala de autoestima), Silva et al. 2020, qualquer estudo sobre Instagram e adolescentes que você já leu...',
        obrigatoria: false,
        dica: 'Se não tiver, a IA vai sugerir os mais relevantes para o tema',
      },
      {
        id: 'perspectiva',
        pergunta: 'Qual perspectiva teórica você quer seguir?',
        tipo: 'textarea',
        placeholder:
          'Ex: Abordagem crítica / Foco em estudos empíricos recentes / Visão equilibrada (prós e contras) / Perspectiva da psicologia do desenvolvimento...',
        obrigatoria: false,
      },
    ]
  }

  // DEFAULT
  return [
    {
      id: 'contexto',
      pergunta: 'Há alguma informação específica que você quer incluir nesta seção?',
      tipo: 'textarea',
      placeholder:
        'Ex: Dados, aspectos importantes, informações que a IA deve mencionar, contexto do seu trabalho...',
      obrigatoria: false,
      dica: 'Se deixar em branco, a IA vai gerar com base no contexto das seções anteriores — tudo bem também',
    },
  ]
}

function inicializarRespostas(perguntas: Pergunta[]): RespostasQuestionario {
  return perguntas.reduce<RespostasQuestionario>((acc, p) => {
    acc[p.id] = ''
    return acc
  }, {})
}

export default function QuestionarioGeracaoModal({
  chaveSecao,
  nomeSecao,
  tipoTrabalho,
  onConfirmar,
  onPular,
  onCancelar,
}: QuestionarioGeracaoModalProps) {
  const perguntas = getPerguntasParaSecao(chaveSecao, tipoTrabalho)
  const [respostas, setRespostas] = useState<RespostasQuestionario>(() =>
    inicializarRespostas(perguntas)
  )

  const totalPreenchidas = Object.values(respostas).filter((v) => v.trim() !== '').length

  function handleChange(id: string, valor: string) {
    setRespostas((prev) => ({ ...prev, [id]: valor }))
  }

  function handleConfirmar() {
    onConfirmar(respostas)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-2xl px-6 py-5 border-b border-primary/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 leading-tight">
                  Personalize a {nomeSecao}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Responda algumas perguntas para a IA gerar um texto do seu jeito, não genérico
                </p>
              </div>
            </div>
            <button
              onClick={onCancelar}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {perguntas.map((pergunta, index) => (
            <div key={pergunta.id} className="space-y-2">
              <label
                htmlFor={pergunta.id}
                className="block text-sm font-medium text-gray-800 leading-snug"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-primary/70 bg-primary/8 rounded-full px-1.5 py-0.5">
                    {index + 1}
                  </span>
                  {pergunta.pergunta}
                  {!pergunta.obrigatoria && (
                    <span className="text-xs text-gray-400 font-normal">(opcional)</span>
                  )}
                </span>
              </label>

              {pergunta.tipo === 'texto' && (
                <input
                  id={pergunta.id}
                  type="text"
                  value={respostas[pergunta.id]}
                  onChange={(e) => handleChange(pergunta.id, e.target.value)}
                  placeholder={pergunta.placeholder}
                  className={cn(
                    'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900',
                    'placeholder:text-gray-400 bg-gray-50',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-white',
                    'transition-colors'
                  )}
                />
              )}

              {pergunta.tipo === 'textarea' && (
                <textarea
                  id={pergunta.id}
                  value={respostas[pergunta.id]}
                  onChange={(e) => handleChange(pergunta.id, e.target.value)}
                  placeholder={pergunta.placeholder}
                  rows={3}
                  className={cn(
                    'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900',
                    'placeholder:text-gray-400 bg-gray-50 resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-white',
                    'transition-colors'
                  )}
                />
              )}

              {pergunta.tipo === 'selecao' && pergunta.opcoes && (
                <div className="space-y-2">
                  {pergunta.opcoes.map((opcao) => {
                    const selecionada = respostas[pergunta.id] === opcao
                    return (
                      <button
                        key={opcao}
                        type="button"
                        onClick={() => handleChange(pergunta.id, selecionada ? '' : opcao)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors',
                          selecionada
                            ? 'border-primary bg-primary/8 text-primary font-medium'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-primary/4'
                        )}
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className={cn(
                              'flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                              selecionada ? 'border-primary' : 'border-gray-300'
                            )}
                          >
                            {selecionada && (
                              <span className="w-2 h-2 rounded-full bg-primary block" />
                            )}
                          </span>
                          {opcao}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {pergunta.dica && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                  <span className="font-semibold">Dica:</span> {pergunta.dica}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4 rounded-b-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {totalPreenchidas > 0 ? (
              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 rounded-full px-3 py-1 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 block" />
                {totalPreenchidas}{' '}
                {totalPreenchidas === 1 ? 'informação fornecida' : 'informações fornecidas'}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Nenhuma resposta preenchida ainda</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPular}
              className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              Gerar sem preencher
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
                'bg-primary text-white hover:bg-primary/90 shadow-sm'
              )}
            >
              <Sparkles className="w-4 h-4" />
              Gerar texto personalizado
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
