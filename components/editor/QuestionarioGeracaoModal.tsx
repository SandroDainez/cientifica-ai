'use client'

import { useState } from 'react'
import { X, Sparkles, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RespostasQuestionario = Record<string, string>

interface QuestionarioGeracaoModalProps {
  chaveSecao: string
  nomeSecao: string
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

function getPerguntasParaSecao(chaveSecao: string): Pergunta[] {
  const chave = chaveSecao.toLowerCase()

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
  onConfirmar,
  onPular,
  onCancelar,
}: QuestionarioGeracaoModalProps) {
  const perguntas = getPerguntasParaSecao(chaveSecao)
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
