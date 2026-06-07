'use client'

import { useState } from 'react'
import { X, Sparkles, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RespostasQuestionario = Record<string, string>

interface QuestionarioGeracaoModalProps {
  chaveSecao: string
  nomeSecao: string
  tipoTrabalho?: string
  /** Valores pré-preenchidos do plano do projeto (DadosProjeto) */
  valoresIniciais?: Record<string, string>
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
        id: 'objetivo_geral',
        pergunta: 'Qual é o OBJETIVO do seu trabalho? (o que ele pretende alcançar)',
        tipo: 'textarea',
        placeholder: 'Ex: Analisar a associação entre o uso de redes sociais e sintomas depressivos em adolescentes de escolas públicas brasileiras',
        obrigatoria: true,
        dica: 'Em artigos, o objetivo entra no último parágrafo da Introdução. Comece com um verbo: analisar, comparar, avaliar, descrever, identificar…',
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

  // ── Consentimento do Paciente (Relato de Caso) ───────────────
  if (chave === 'consentimento_paciente' || chave.includes('consentimento_paciente')) {
    return [
      {
        id: 'status_consentimento',
        pergunta: 'O paciente (ou familiar responsável) já assinou o TCLE de publicação?',
        tipo: 'selecao' as const,
        opcoes: [
          'Sim — paciente vivo assinou o TCLE de publicação',
          'Sim — familiares assinaram (paciente falecido)',
          'Ainda não obtive o consentimento escrito',
          'Paciente não foi localizado — estou verificando alternativas com o CEP',
        ],
        obrigatoria: true,
        dica: 'Todos os periódicos exigem consentimento escrito. Sem ele, o artigo não pode ser publicado.',
      },
      {
        id: 'cep_relato',
        pergunta: 'A instituição exige aprovação do CEP para relatos de caso?',
        tipo: 'selecao' as const,
        opcoes: [
          'Sim — já obtive aprovação do CEP (tenho o número CAAE e parecer)',
          'Sim — está em análise no CEP',
          'Minha instituição dispensa CEP para relatos com consentimento do paciente',
          'Não sei — vou verificar com o responsável ético da instituição',
        ],
        obrigatoria: false,
        dica: 'Independente do CEP institucional, o consentimento do paciente é sempre obrigatório para qualquer periódico.',
      },
      {
        id: 'dados_protegidos',
        pergunta: 'Quais informações identificatórias foram protegidas/omitidas do relato?',
        tipo: 'textarea' as const,
        placeholder: 'Ex: Nome omitido. Idade aproximada (30-40 anos) em vez de exata. Datas apresentadas como intervalos (mês/ano). Local genérico ("hospital universitário do Sul do Brasil").',
        obrigatoria: false,
        dica: 'Proteja sempre: nome, datas exatas, local específico, número de prontuário, imagens com rosto.',
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
          'Sim — mas ainda não tenho o número (aprovação recente)',
          'Está em análise no CEP',
          'Não — ainda preciso me cadastrar e submeter na Plataforma Brasil',
          'Não precisa de CEP (pesquisa sem envolvimento humano/animal direto)',
          'É pesquisa com dados secundários públicos — dispensa CEP',
        ],
        obrigatoria: true,
        dica: 'Se ainda não submeteu: acesse plataformabrasil.saude.gov.br → cadastre-se → submeta antes de iniciar a coleta. O processo leva de 30 a 60 dias.',
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

  // ── TCLE Modelo (Projeto de Pesquisa) ───────────────────────────
  if (chave === 'tcle_modelo' || chave.includes('tcle_modelo')) {
    return [
      {
        id: 'titulo_pesquisa',
        pergunta: 'Qual é o título completo da pesquisa para o TCLE?',
        tipo: 'texto' as const,
        placeholder: 'Ex: Avaliação do impacto da carga de trabalho de enfermagem nos desfechos clínicos de pacientes internados em UTI',
        obrigatoria: true,
      },
      {
        id: 'procedimentos_participante',
        pergunta: 'O que exatamente será pedido ao participante? (em linguagem simples)',
        tipo: 'textarea' as const,
        placeholder: 'Ex: Responder um questionário online de 15 perguntas sobre hábitos alimentares (leva ~10 minutos). Não envolve coleta de sangue, procedimentos físicos ou divulgação de dados pessoais identificados.',
        obrigatoria: true,
        dica: 'Escreva como se estivesse explicando para alguém sem formação científica.',
      },
      {
        id: 'riscos_beneficios',
        pergunta: 'Quais são os riscos e benefícios para o participante?',
        tipo: 'textarea' as const,
        placeholder: 'Riscos: mínimos — possível desconforto ao responder perguntas sobre saúde mental. Benefícios: contribuição para o conhecimento científico; não há benefício direto imediato ao participante.',
        obrigatoria: true,
        dica: 'Seja honesto. Minimizar riscos ou exagerar benefícios compromete a ética.',
      },
      {
        id: 'contato_cep',
        pergunta: 'Qual é o contato do CEP da sua instituição?',
        tipo: 'texto' as const,
        placeholder: 'Ex: CEP-UFMG — Av. Antônio Carlos, 6627 — Tel: (31) 3409-4592 — email: cep@prpq.ufmg.br',
        obrigatoria: false,
        dica: 'O TCLE deve sempre incluir o contato do CEP para que participantes possam fazer denúncias ou perguntas.',
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
          // Saúde / Medicina / Biologia
          'PubMed/MEDLINE + SciELO + LILACS (saúde, medicina, enfermagem, nutrição)',
          'PubMed/MEDLINE + Cochrane Library + Embase (ensaios clínicos)',
          'Web of Science + Scopus + PubMed (pesquisa biomédica ampla)',
          // Ciências Humanas e Sociais
          'SciELO + SPELL + Periódicos CAPES (ciências humanas e sociais — BR)',
          'ERIC + PsycINFO + SciELO (educação e psicologia)',
          'Google Scholar + Periódicos CAPES + repositórios institucionais',
          // Direito
          'Jusbrasil + DJe/STJ/STF + Periódicos CAPES Direito (jurisprudência e doutrina)',
          'LexisNexis + HeinOnline + SciELO (direito comparado e internacional)',
          // Agronomia / Ciências Agrárias
          'Embrapa + SciELO + Web of Science (agronomia e ciências agrárias)',
          'Scopus + Web of Science + AGRIS/FAO (agronômico internacional)',
          // Engenharia
          'Scopus + Web of Science + IEEE Xplore (engenharia e tecnologia)',
          'Compendex (Engineering Village) + Scopus + ABNT NBR Online',
          // Multidisciplinar
          'Scopus + Web of Science (qualquer área — cobertura internacional)',
          'Periódicos CAPES + Google Scholar (acesso via CAPES — todas as áreas)',
        ],
        obrigatoria: true,
        dica: 'Escolha as bases adequadas para sua área. Revisões sistemáticas devem usar pelo menos 3 bases.',
      },
      {
        id: 'descritores',
        pergunta: 'Quais foram os descritores/termos de busca utilizados?',
        tipo: 'textarea',
        placeholder:
          'Saúde: ("diabetes mellitus tipo 2" OR "DM2") AND ("metformina") AND ("HbA1c") — PubMed, filtro: Clinical Trial, 2015–2024\n\nDireito: ("responsabilidade civil" OR "dano moral") AND ("relação de consumo") — Jusbrasil + STJ, acórdãos 2018–2024\n\nEducação: ("letramento digital" OR "competência digital") AND ("ensino fundamental") — ERIC + SciELO, 2018–2024\n\nAgronomia: ("soja" OR "Glycine max") AND ("déficit hídrico" OR "estresse hídrico") AND ("produtividade") — Web of Science, 2019–2024\n\nEngenharia: ("concreto de alto desempenho") AND ("resistência à compressão") — Scopus + Web of Science, 2018–2024',
        obrigatoria: false,
        dica: 'Use operadores booleanos (AND, OR, NOT). Use MeSH para saúde, descritores DeCS para português, termos controlados da área para outras disciplinas.',
      },
      {
        id: 'periodo_busca',
        pergunta: 'Qual é o período de abrangência da busca?',
        tipo: 'texto',
        placeholder: 'Ex: Janeiro de 2015 a dezembro de 2024 | Ex: 2010–2024 (últimos 15 anos)',
        obrigatoria: false,
      },
    ]
  }

  // ── Critérios de Elegibilidade (Revisão Sistemática) ────────
  if (chave.includes('criterios') || chave.includes('elegibilidade')) {
    return [
      {
        id: 'criterios_inclusao',
        pergunta: 'Quais são os critérios de INCLUSÃO dos estudos/documentos?',
        tipo: 'textarea',
        placeholder:
          'Saúde:\n• Ensaios clínicos randomizados ou estudos observacionais\n• Adultos ≥18 anos com diagnóstico confirmado\n• Desfecho primário reportado\n• Publicados de 2015 a 2024\n\nDireito:\n• Acórdãos do TJSP sobre [tema]\n• Mérito julgado (não extinção processual)\n• Publicados entre 2018 e 2024\n\nEducação:\n• Estudos empíricos ou estudos de caso\n• Foco em [nível de ensino]\n• Publicados em português, inglês ou espanhol',
        obrigatoria: true,
      },
      {
        id: 'criterios_exclusao',
        pergunta: 'Quais são os critérios de EXCLUSÃO?',
        tipo: 'textarea',
        placeholder:
          'Saúde:\n• Estudos em menores de 18 anos\n• Sem grupo controle\n• Idiomas além de português, inglês e espanhol\n\nDireito:\n• Decisões meramente processuais (sem análise do mérito)\n• Processos em segredo de justiça\n\nEducação:\n• Estudos de revisão sem dados primários\n• Intervenção em contexto não escolar',
        obrigatoria: true,
      },
    ]
  }

  // ── Triagem / PRISMA ────────────────────────────────────────
  if (chave.includes('triagem') || chave.includes('prisma')) {
    return [
      {
        id: 'numeros_triagem',
        pergunta: 'Quantos estudos/documentos foram encontrados, triados e incluídos? (para o fluxograma)',
        tipo: 'textarea',
        placeholder:
          'Identificados: 1.243 (PubMed: 678, SciELO: 231, LILACS: 334) — ou: Jusbrasil: 891, STJ: 352, etc.\nApós remover duplicatas: 987\nTriagem por título/resumo: excluídos 834\nLeitura completa: 153 — excluídos 121\nIncluídos na síntese final: 32 estudos/documentos',
        obrigatoria: false,
        dica: 'Se ainda está na fase de triagem, coloque os números que tem até agora.',
      },
      {
        id: 'motivos_exclusao',
        pergunta: 'Quais foram os principais motivos de exclusão na leitura completa?',
        tipo: 'textarea',
        placeholder:
          'Saúde: "Sem grupo controle (n=45), população pediátrica (n=28), desfecho não reportado (n=31)"\nDireito: "Decisões sem análise do mérito (n=23), processos sigilosos (n=8)"\nEducação: "Sem dados primários (n=31), intervenção fora do escopo (n=17)"',
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

  // ── Opções de delineamento/design de estudo — cobrindo TODAS as áreas ────────
  const opcoesDelineamento = [
    // Epidemiológicos/clínicos (saúde, medicina, enfermagem, nutrição)
    'Estudo observacional transversal (cross-sectional) — survey/prevalência',
    'Estudo de coorte (prospectivo ou retrospectivo)',
    'Estudo caso-controle',
    'Ensaio clínico randomizado (ECR / RCT)',
    'Ensaio quasi-experimental (sem randomização)',
    'Estudo descritivo / série de casos',
    // Qualitativos e mistos (todas as áreas)
    'Pesquisa qualitativa (entrevistas semiestruturadas, grupos focais)',
    'Pesquisa-ação (action research)',
    'Etnografia / observação participante',
    'Fenomenologia',
    'Teoria fundamentada nos dados (Grounded Theory)',
    'Pesquisa mista (quantitativa + qualitativa)',
    // Documentais/bibliográficos (todas as áreas)
    'Pesquisa bibliográfica / revisão de literatura',
    'Pesquisa documental (análise de documentos, registros, arquivos)',
    'Análise jurisprudencial / análise de decisões judiciais (Direito)',
    'Análise de conteúdo / análise do discurso',
    'Análise de políticas públicas',
    // Experimentais/laboratoriais/campo (agronomia, engenharia, biologia, EF)
    'Experimento de campo / ensaio agronômico / ensaio de laboratório',
    'Simulação computacional / modelagem matemática',
    'Pesquisa experimental com animais / espécies',
    // Outros
    'Estudo de caso (case study) único ou múltiplo',
    'Pesquisa histórica / historiográfica',
    'Survey / levantamento (sem intervenção)',
  ]

  // ── Placeholders genéricos que funcionam para QUALQUER área ───────────────
  const PH = {
    local_periodo:
      'Saúde: "Hospital das Clínicas de SP, UTI adulto, jan–dez 2024"\nEducação: "Escola E.E. Prof. João Santos, turmas 6º–9º ano, 2023"\nDireito: "Vara Criminal da Comarca de Ribeirão Preto (SP), acórdãos de 2020–2024"\nAgronomia: "Fazenda Santa Maria, município de Sorriso (MT), safra 2023/2024"\nEngenharia: "Laboratório de Materiais da UNICAMP, de março a agosto de 2024"',
    populacao:
      'Saúde: "87 pacientes adultos internados com sepse, ≥18 anos"\nEducação: "200 estudantes do ensino médio, 14–17 anos, 5 escolas públicas de BH"\nDireito: "Acórdãos do TJSP sobre [tema], publicados entre 2019–2024 (n=120 decisões)"\nAgronomia: "Produtores rurais de soja de Mato Grosso, propriedades entre 200–2.000 ha (n=45)"\nEd. Física: "Atletas amadores de corrida de rua, 25–45 anos, ambos os sexos (n=60)"',
    criterios_inclusao:
      'Saúde:\n• Paciente internado ≥ 24h com diagnóstico confirmado\n• Prontuário completo\nEducação:\n• Matriculado regularmente na escola-alvo\n• Presença em ≥ 75% das aulas\nDireito:\n• Decisão publicada no período definido\n• Mérito julgado (não extinção sem resolução)\nAgronomia:\n• Propriedade rural com cultivo de soja há ≥ 3 safras\n• Dados completos de produtividade disponíveis',
    criterios_exclusao:
      'Saúde:\n• Menores de 18 anos\n• Dados incompletos (>20% dos campos)\nEducação:\n• Aluno com matrícula cancelada durante o período\n• Recusa em participar\nDireito:\n• Decisões meramente processuais (sem análise do mérito)\n• Processos em segredo de justiça\nAgronomia:\n• Propriedades que usaram tecnologia diferente do protocolo padrão\n• Registros com lacunas superiores a 30%',
    instrumentos:
      'Saúde: "Questionário sociodemográfico + Escala de Ansiedade de Beck (BAI) + prontuário eletrônico"\nEducação: "Diário de campo + entrevista semiestruturada (roteiro com 18 questões) + análise documental do plano de aula"\nDireito: "Ficha de extração de dados jurisprudenciais: número do processo, data, relator, fundamento legal, resultado"\nAgronomia: "Medidor de umidade do solo (Thetaprobe ML2x) + pluviômetro digital + pesagem da colheita por parcela"\nEd. Física: "Dinamômetro isocinético Biodex + VO2máx em ergoespirômetro + questionário IPAQ"',
    analise:
      'Quantitativa: "SPSS v.26 ou R v.4.3 — estatística descritiva (média ± DP), teste t de Student, ANOVA, regressão logística. Significância: p < 0,05."\nQualitativa: "Análise temática de conteúdo segundo Bardin (2016). Codificação com MAXQDA 2022. Triangulação entre pesquisadores."\nDireito: "Análise jurisprudencial quantitativa (frequência de fundamentos) + qualitativa (discurso dos votos). Software: NVivo 12."\nAgronomia: "ANOVA fatorial + teste de Tukey (p < 0,05). Software: SISVAR v.5.8. Gráficos: SigmaPlot."\nEd. Física: "Correlação de Pearson para associações. Nível de significância: p < 0,05. IBM SPSS Statistics 27."',
  }

  // ── TCC: seção única de metodologia — todas as perguntas ──────────────────
  if (chave.includes('metodolog')) {
    return [
      {
        id: 'delineamento',
        pergunta: 'Qual é o tipo/delineamento do seu estudo?',
        tipo: 'selecao',
        opcoes: opcoesDelineamento,
        obrigatoria: true,
        dica: 'Escolha o que mais se aproxima da sua pesquisa. Funciona para todas as áreas: saúde, direito, educação, agronomia, engenharia, etc.',
      },
      {
        id: 'local_periodo',
        pergunta: 'Onde e quando foi realizado o estudo? Seja específico.',
        tipo: 'textarea',
        placeholder: PH.local_periodo,
        obrigatoria: true,
        dica: 'Coloque o nome real da instituição ou local, cidade/estado e as datas exatas.',
      },
      {
        id: 'populacao_amostra',
        pergunta: 'Quem foram os participantes/unidades de análise? Quantos? Qual o perfil?',
        tipo: 'textarea',
        placeholder: PH.populacao,
        obrigatoria: true,
        dica: 'Inclua: total, perfil (faixa etária, área geográfica, categoria), critério de seleção.',
      },
      {
        id: 'criterios_inclusao',
        pergunta: 'Quais foram os critérios de INCLUSÃO? (o que determinou quem/o que entrou)',
        tipo: 'textarea',
        placeholder: PH.criterios_inclusao,
        obrigatoria: true,
        dica: 'Liste um critério por linha. Seja preciso — isso é fundamental para a qualidade do texto.',
      },
      {
        id: 'criterios_exclusao',
        pergunta: 'Quais foram os critérios de EXCLUSÃO? (o que ficou de fora e por quê)',
        tipo: 'textarea',
        placeholder: PH.criterios_exclusao,
        obrigatoria: true,
        dica: 'Critérios de exclusão protegem a validade interna do estudo. Seja específico.',
      },
      {
        id: 'coleta_instrumentos',
        pergunta: 'Como os dados foram coletados? Quais instrumentos/ferramentas foram usados?',
        tipo: 'textarea',
        placeholder: PH.instrumentos,
        obrigatoria: true,
        dica: 'Se usou escalas/instrumentos validados, mencione o nome completo e a referência.',
      },
      {
        id: 'analise_estatistica',
        pergunta: 'Como foi feita a análise dos dados? Qual software/método foi usado?',
        tipo: 'textarea',
        placeholder: PH.analise,
        obrigatoria: false,
        dica: 'Mencione o método e o software. Para pesquisa qualitativa: análise de conteúdo, análise do discurso, etc.',
      },
      {
        id: 'cep_etica',
        pergunta: 'Há aspectos éticos formais? (CEP, comissão de ética, confidencialidade, declaração de interesse)',
        tipo: 'texto',
        placeholder:
          'Saúde: "Aprovado pelo CEP-[instituição], CAAE nº XXXX, Parecer nº XXXX"\nCiências Humanas/Sociais: "Aprovado pelo CEP, CAAE nº XXXX" ou "Dispensado — pesquisa documental sem envolvimento humano direto"\nDireito: "Dados públicos — não requer aprovação ética formal"\nAgronomia: "Declaração de inexistência de conflito de interesses. Coleta realizada em propriedade privada com autorização do proprietário."',
        obrigatoria: false,
        dica: 'Se ainda não tem aprovação, escreva o status atual. Pesquisas documentais/bibliográficas geralmente dispensam CEP.',
      },
    ]
  }

  // ── Artigo: Métodos — Delineamento (tipo, local, população, critérios) ──────
  if (chave.includes('delineamento')) {
    return [
      {
        id: 'delineamento',
        pergunta: 'Qual é o tipo/delineamento do seu estudo?',
        tipo: 'selecao',
        opcoes: opcoesDelineamento,
        obrigatoria: true,
        dica: 'Cobre todas as áreas: saúde, direito, educação, agronomia, engenharia, psicologia, etc.',
      },
      {
        id: 'local_periodo',
        pergunta: 'Onde e quando foi realizado o estudo? Seja específico.',
        tipo: 'textarea',
        placeholder: PH.local_periodo,
        obrigatoria: true,
        dica: 'Nome real do local/instituição, cidade/estado e datas exatas.',
      },
      {
        id: 'populacao_amostra',
        pergunta: 'Quem foram os participantes/unidades de análise? Quantos? Qual o perfil?',
        tipo: 'textarea',
        placeholder: PH.populacao,
        obrigatoria: true,
        dica: 'Inclua total, perfil (faixa etária, área geográfica, categoria) e critério de seleção.',
      },
      {
        id: 'criterios_inclusao',
        pergunta: 'Quais foram os critérios de INCLUSÃO?',
        tipo: 'textarea',
        placeholder: PH.criterios_inclusao,
        obrigatoria: true,
        dica: 'Liste um critério por linha. Seja preciso.',
      },
      {
        id: 'criterios_exclusao',
        pergunta: 'Quais foram os critérios de EXCLUSÃO?',
        tipo: 'textarea',
        placeholder: PH.criterios_exclusao,
        obrigatoria: true,
        dica: 'Critérios de exclusão protegem a validade interna. Seja específico.',
      },
    ]
  }

  // ── Artigo: Métodos — Coleta e Análise (instrumentos, análise, software) ───
  if (chave.includes('coleta') || chave.includes('metodos')) {
    return [
      {
        id: 'coleta_instrumentos',
        pergunta: 'Como os dados foram coletados? Quais instrumentos/ferramentas foram usados?',
        tipo: 'textarea',
        placeholder: PH.instrumentos,
        obrigatoria: true,
        dica: 'Se usou instrumentos validados, mencione o nome completo e referência. Funciona para qualquer área.',
      },
      {
        id: 'analise_estatistica',
        pergunta: 'Como foi feita a análise dos dados? Qual método/software foi usado?',
        tipo: 'textarea',
        placeholder: `Quantitativa (saúde/agronomia/engenharia/EF): "SPSS v.26 ou R v.4.3. Média ± DP, teste t ou ANOVA, regressão logística. Significância: p < 0,05."
Qualitativa (educação/ciências humanas/direito): "Análise temática de conteúdo segundo Bardin (2016). Codificação no MAXQDA 2022. Triangulação entre pesquisadores."
Jurídica: "Análise quantitativa (frequência de fundamentos) + qualitativa (argumentação dos votos). Software: NVivo 12."
Agronômica: "ANOVA fatorial + Tukey (p < 0,05). Software: SISVAR v.5.8. Gráficos: SigmaPlot."
Educação física: "Correlação de Pearson, regressão linear múltipla. IBM SPSS v.27."`,
        obrigatoria: true,
        dica: 'Mencione o método e o software usado. Para pesquisas qualitativas: análise de conteúdo, grounded theory, análise do discurso, etc.',
      },
      {
        id: 'desfechos_variaveis',
        pergunta: 'Quais foram as variáveis/desfechos/categorias principais que você analisou?',
        tipo: 'textarea',
        placeholder:
          'Saúde: "Desfecho primário: mortalidade em 30 dias. Desfechos secundários: tempo de internação, escore SOFA"\nEducação: "Variável dependente: desempenho escolar (nota SARESP). Independentes: método de ensino, perfil socioeconômico"\nDireito: "Variáveis: fundamento jurídico utilizado, resultado (procedente/improcedente), tempo de tramitação"\nAgronomia: "Produtividade (kg/ha), índice de colheita, teor de proteínas do grão"\nEd. Física: "VO2máx, força muscular isocinética, taxa de lesões"',
        obrigatoria: false,
        dica: 'Informe os desfechos/variáveis/categorias centrais para o seu campo específico.',
      },
    ]
  }

  if (chave.includes('resultado')) {
    return [
      {
        id: 'dados_planilha',
        pergunta: '📊 Cole aqui os dados da sua planilha (a IA vai analisar e escrever os Resultados com base neles):',
        tipo: 'textarea',
        placeholder:
          'Cole os dados diretamente do Excel (selecione tudo → Ctrl+C → cole aqui), ou exporte como CSV e cole o conteúdo.\n\nEx:\nID  Grupo  Idade  Autoestima  Instagram_h\n1   A      16     34          0,8\n2   B      17     26          3,5\n3   A      15     38          0,5\n...\n\nOu cole estatísticas já calculadas:\nN=200 | Grupo <1h: média=34,2 (DP=4,1) | Grupo >3h: média=26,7 (DP=5,3) | p<0,001',
        obrigatoria: false,
        dica: '💡 Com dados reais a IA calcula médias, percentuais, compara grupos e escreve os Resultados com precisão. Sem dados ela gera um texto genérico com (SOBRENOME, ANO).',
      },
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
        pergunta: 'Estatísticas resumidas ou números específicos adicionais:',
        tipo: 'textarea',
        placeholder:
          'N=200 participantes\n67% usam Instagram diariamente\nMédia de uso: 3,2h/dia\nEscores de autoestima: grupo <1h = 34,2; grupo >3h = 26,7\nCorrelação r=-0,42, p<0,001',
        obrigatoria: false,
        dica: 'Complementa os dados colados acima. Use para resumir achados que a planilha não captou.',
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

function inicializarRespostas(
  perguntas: Pergunta[],
  valoresIniciais?: Record<string, string>
): RespostasQuestionario {
  return perguntas.reduce<RespostasQuestionario>((acc, p) => {
    acc[p.id] = valoresIniciais?.[p.id] ?? ''
    return acc
  }, {})
}

export default function QuestionarioGeracaoModal({
  chaveSecao,
  nomeSecao,
  tipoTrabalho,
  valoresIniciais,
  onConfirmar,
  onPular,
  onCancelar,
}: QuestionarioGeracaoModalProps) {
  const perguntas = getPerguntasParaSecao(chaveSecao, tipoTrabalho)
  const [respostas, setRespostas] = useState<RespostasQuestionario>(() =>
    inicializarRespostas(perguntas, valoresIniciais)
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
          {/* Banner: campos pré-preenchidos do plano */}
          {valoresIniciais && Object.keys(valoresIniciais).length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 flex items-start gap-2">
              <span className="text-blue-500 text-sm mt-0.5">📋</span>
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Campos pré-preenchidos</span> com os dados do seu Plano de Pesquisa. Revise e ajuste se necessário.
              </p>
            </div>
          )}
          {perguntas.map((pergunta, index) => {
            const preenchidoDoPlano = !!(valoresIniciais?.[pergunta.id])
            return (
            <div key={pergunta.id} className="space-y-2">
              <label
                htmlFor={pergunta.id}
                className="block text-sm font-medium text-gray-800 leading-snug"
              >
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-primary/70 bg-primary/8 rounded-full px-1.5 py-0.5">
                    {index + 1}
                  </span>
                  {pergunta.pergunta}
                  {!pergunta.obrigatoria && (
                    <span className="text-xs text-gray-400 font-normal">(opcional)</span>
                  )}
                  {preenchidoDoPlano && (
                    <span className="text-[10px] font-medium text-blue-600 bg-blue-100 rounded-full px-1.5 py-0.5">
                      do plano
                    </span>
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
                    'w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900',
                    'placeholder:text-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-white',
                    'transition-colors',
                    preenchidoDoPlano
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
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
                    'w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 resize-none',
                    'placeholder:text-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-white',
                    'transition-colors',
                    preenchidoDoPlano
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
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
            )
          })}
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
