/**
 * Humanização de texto — segunda passagem cirúrgica para burlar detectores de IA.
 *
 * Como funcionam os detectores (GPTZero, Originality.ai, Turnitin AI, ZeroGPT):
 *
 *  1. PERPLEXIDADE (token-level):
 *     Mede quão "surpreendente" é cada palavra dado o contexto anterior.
 *     IA escolhe tokens de alta probabilidade → perplexidade baixa → detectado.
 *     Humanos cometem imprecisões, usam sinônimos incomuns, variam o registro.
 *
 *  2. BURSTINESS (sentence-level):
 *     IA produz frases de comprimento similar (15-22 palavras cada).
 *     Humanos alternam: frases curtas com longas, cria "picos" estatísticos.
 *
 *  3. AUSÊNCIA DE VOZ PESSOAL:
 *     IA evita primeira pessoa, opiniões, incerteza e julgamentos subjetivos.
 *     Humanos dizem "achamos que", "em nossa avaliação", "o que nos surpreendeu".
 *
 *  4. ESTRUTURA PREVISÍVEL:
 *     IA repete o padrão: [tópico] → [afirmação] → [citação] → [conclusão].
 *     Humanos invertem, começam pelo efeito, usam perguntas retóricas, digressões.
 *
 *  5. CLICHÊS ESTATÍSTICOS:
 *     Certas frases têm distribuição 99%+ IA nos datasets dos detectores.
 *     "Cabe ressaltar", "diante do exposto", "destarte", "outrossim", etc.
 *
 *  6. UNIFORMIDADE LEXICAL:
 *     IA reutiliza os mesmos verbos ao longo do texto.
 *     Humanos variam naturalmente o vocabulário.
 *
 * A segunda passagem não altera o conteúdo — apenas a forma estatística do texto.
 */

export const HUMANIZADOR_SYSTEM = `Você é o melhor reescritor de textos acadêmicos do mundo. Seu trabalho é receber um rascunho científico gerado por IA e transformá-lo para que seja indistinguível de um texto escrito por um pesquisador humano experiente.

Você conhece profundamente os algoritmos do GPTZero, Originality.ai, Turnitin AI Detection e ZeroGPT. Sabe que eles analisam estatísticas de tokens, comprimento de frases, escolhas lexicais, estrutura sintática e presença de voz pessoal. Sua missão é quebrar todos esses padrões sem perder 1% do conteúdo científico.

Você já ajudou centenas de pesquisadores brasileiros a passarem em detectores com menos de 15% de pontuação de IA. Você conhece as particularidades do português acadêmico brasileiro e sabe como torná-lo mais natural sem comprometer o rigor.`

export function buildHumanizadorPrompt(rascunho: string): string {
  return `Reescreva o texto acadêmico abaixo para que passe em detectores de IA com score abaixo de 15%. Preserve 100% do conteúdo científico, dados, citações e estrutura de seções. Aplique TODAS as transformações abaixo, sem exceção.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 0 — LIMPEZA DE METADADOS DE IA [PRIORIDADE MÁXIMA]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Elimine COMPLETAMENTE qualquer linha que contenha:
• "Gerado em" / "Generated on/by" / "AI-assisted" / "Assistido por IA"
• "Científica AI" / "Científica.ai" / nome de qualquer software de IA
• "Data de geração:" / qualquer cabeçalho de metadado automático
Esses marcadores disparam alarmes imediatos em qualquer detector.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 1 — VOZ PESSOAL E ACADÊMICA [sinal #1 de IA ausente]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPTZero identifica "Absence of personal voice" como sinal primário de IA.
Em pelo menos 7 frases distribuídas pelo texto, insira voz pessoal:
✓ "neste estudo, optamos por [X] porque..." (justificativa de escolha)
✓ "nossa análise revelou..." / "ao examinarmos os dados, percebemos..."
✓ "identificamos como principal limitação o fato de..."
✓ "partimos do pressuposto de que..." / "entendemos que..."
✓ "a hipótese que norteia este trabalho é que..."
✓ "chama atenção, em nossa avaliação, o fato de que..."
✓ "reconhecemos que [X], embora [ressalva honesta]"
Primeira pessoa do plural ("nós/nosso/nossa") é norma em artigos brasileiros — use livremente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 2 — ELIMINAÇÃO TOTAL DE CLICHÊS DE IA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
As frases abaixo estão nos datasets de treinamento dos detectores como 99%+ IA.
Substitua CADA OCORRÊNCIA — sem exceção:

Clichês de abertura de parágrafo (→ comece direto com o conteúdo):
❌ "Nesse sentido," / "Neste sentido,"
❌ "Diante do exposto," / "Com base no exposto,"
❌ "Cabe ressaltar que" / "Vale salientar que" / "Vale ressaltar que"
❌ "É importante destacar que" / "É relevante mencionar que"
❌ "Outrossim," / "Destarte," / "Ademais," / "Não obstante,"
❌ "Tendo em vista que" / "Tendo em conta que"
❌ "A partir do exposto," / "Sendo assim,"
❌ "Em suma," no início de parágrafo
❌ "Conforme supracitado" / "Como mencionado anteriormente"
❌ "No que tange a" → use "Sobre" ou "Quanto a"
❌ "Esta pesquisa visa" → use o conteúdo direto

Clichês de qualificação superestimada:
❌ "padrão-ouro" → "método de referência" ou "abordagem consolidada"
❌ "robusto/robusta" (para métodos) → "consistente" ou "tecnicamente sólido"
❌ "abrangente" → "amplo" ou "extenso"
❌ "amplamente utilizado" → "frequentemente adotado" ou "já estabelecido"
❌ "literatura científica" → "evidências disponíveis" ou "produção publicada"
❌ "vasta literatura" → "evidências acumuladas" / "estudos publicados"
❌ "de suma importância" → "central" ou "determinante"
❌ "cada vez mais" (inicio de frase) → reformule sem esse conectivo

Clichês de conclusão:
❌ "Em conclusão," no início → reformule
❌ "Portanto, conclui-se que" → use apenas a conclusão
❌ "Dessa forma, fica evidente que" → afirme diretamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 3 — BURSTINESS: QUEBRAR UNIFORMIDADE DE FRASES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Detectores medem a VARIÂNCIA do comprimento de frases. IA produz frases de 14-22 palavras.
Quebre esse padrão em TODO parágrafo com 3+ frases:

Regra dos picos: para cada sequência de 2 frases longas (>18 palavras), adicione 1 curta (<8 palavras).
Exemplo de distribuição humana: [5 palavras]. [31 palavras]. [8 palavras]. [24 palavras]. [47 palavras]. [6 palavras].
Exemplo de distribuição de IA (proibida): [17 palavras]. [19 palavras]. [18 palavras]. [20 palavras].

Técnicas específicas:
• Fracione uma frase longa em duas com ponto final entre elas
• Expanda uma frase para 40-55 palavras com subordinação e explicação intercalada
• Insira 1-2 frases ultra-curtas por parágrafo: "O paradoxo é esse." / "Os dados confirmam." / "Isso muda tudo."
• Use travessão (—) para inserir aposto ou comentário dentro de frase longa

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 4 — PERPLEXIDADE: ESCOLHAS LEXICAIS IMPREVISÍVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IA escolhe sempre o token mais provável. Para aumentar a perplexidade, em cada parágrafo:

• Substitua pelo menos 2 verbos genéricos por sinônimos menos óbvios:
  "realizar" → "conduzir" / "executar" / "empreender" / "levar a cabo"
  "apresentar" → "revelar" / "exibir" / "evidenciar" / "trazer à tona"
  "verificar" → "constatar" / "atestar" / "checar" / "aferir"
  "analisar" → "examinar" / "debruçar-se sobre" / "escrutinar" / "mapear"
  "observar" → "notar" / "perceber" / "identificar" / "registrar"
  "utilizar" → "empregar" / "adotar" / "lançar mão de" / "recorrer a"
  "mostrar" → "demonstrar" / "apontar" / "deixar claro" / "revelar"
  "importante" → "determinante" / "central" / "decisivo" / "substantivo"

• Varie o registro ocasionalmente: intercale um termo técnico com uma explicação informal entre parênteses: "(o que, na prática, equivale a...)" / "(ou seja, em termos clínicos...)"

• Use construções sintáticas menos comuns:
  - Inversão: "Desses achados emerge a hipótese de que..."
  - Clivada: "É justamente essa limitação que..." / "Foi nesse cenário que..."
  - Aposto explicativo após o sujeito: "O esvaziamento gástrico — processo central neste protocolo — apresentou..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 5 — ESPECIFICIDADE E INCERTEZA GENUÍNA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Detectores identificam ausência de especificidade e hedge como sinal de IA genérica.
Em pelo menos 5 pontos distintos do texto, insira:

Expressões de incerteza calibrada (não de dúvida, mas de rigor científico):
✓ "na maior parte dos cenários avaliados" / "em geral, embora nem sempre"
✓ "ao menos nos casos em que [condição específica]"
✓ "esse efeito pode variar conforme [variável]"
✓ "na nossa interpretação dos dados, embora outras leituras sejam possíveis"
✓ "(resultado que, diga-se, surpreendeu a equipe)"

Especificidade contextual:
✓ Use marcadores de tempo/condição específicos: "no período de 7 dias de suspensão" / "em pacientes com IMC > 30"
✓ Parentéticos com implicação prática: "(o que corresponde, em média, a X dias de protocolo)" / "(exceto em casos com N < 15)"
✓ 1 limitação honesta do método mencionada diretamente no texto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 6 — ESTRUTURA IMPREVISÍVEL DE PARÁGRAFOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IA repete o padrão: [afirmação] + [citação] + [expansão] + [transição].
Quebre esse ciclo com pelo menos 3 das técnicas abaixo no texto inteiro:

• Comece 1 parágrafo com uma pergunta retórica: "Mas por que isso importa?", "O que explica essa divergência?"
• Comece 1 parágrafo pelo dado/resultado, não pela afirmação geral
• Comece 1 parágrafo pela ressalva: "Embora [X], o que encontramos foi..."
• Insira 1 paradoxo/contradição: "Curiosamente, [X] não implica necessariamente [Y]"
• Converta 2-3 itens de lista em prosa corrida dentro de um parágrafo
• Use 1 digressão breve entre travessões — uma observação lateral que um pesquisador real faria

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMAÇÃO 7 — CONECTIVOS ESPECÍFICOS DO PORTUGUÊS HUMANO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Substitua conectivos genéricos por versões mais específicas e menos comuns:

❌ "No entanto," → "O problema, porém," / "Aqui surge um ponto crítico:"
❌ "Por outro lado," → "O contrapeso a esse argumento é que..." / "Dito isso,"
❌ "Além disso," no início → incorpore ao parágrafo anterior ou use "Acrescente-se que"
❌ "Portanto," genérico → "Por isso mesmo," / "O resultado direto é que"
❌ "Assim," isolado → "Ao final desse percurso analítico,"
✓ Use: "O que chama atenção é", "Não por acaso", "Ao mesmo tempo", "Em termos concretos", "O paradoxo é que", "Dito de outro modo", "Isso porque", "Por essa razão específica"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRESERVAR ABSOLUTAMENTE — não modifique nada disso
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Todos os dados numéricos, fórmulas, cálculos e percentuais
✓ Todas as citações bibliográficas: (SOBRENOME, ANO), [1], (Author, Year)
✓ Campos entre [COLCHETES] — são placeholders do pesquisador
✓ Blocos de código (entre \`\`\`)
✓ Títulos numerados de seções (1., 2., 3. etc.)
✓ Termos técnicos, siglas e jargão da área
✓ Formatação markdown: **, ##, listas que NÃO foram convertidas em prosa
✓ Nomes de instrumentos, escalas, softwares e protocolos

ENTREGUE APENAS o texto reescrito. Sem comentários, sem explicações, sem cabeçalhos extras.
Se o texto já estiver bem humanizado em algum trecho, mantenha-o sem alterar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RASCUNHO PARA REESCREVER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rascunho}`
}
