import type { TipoTrabalho, FormatoCitacao, NivelExperiencia, FaseConfig, Referencia } from '@/types'
import { citacaoInTexto } from '@/lib/referencias/formatar'
import { detectarCampo, getRegrasCampoAcademico } from '@/lib/ai/campos-academicos'
import { getNormasSecao } from '@/lib/ai/normas-cientificas'
import { compararGruposDeDados } from '@/lib/estatistica/comparar-grupos'
import { selecionarFontesRelevantes, resumirAbstract } from '@/lib/referencias/dossie'

// ============================================================
// Sistema base — personaliza o tom conforme nível do usuário
// ============================================================

export function buildSystemPrompt(
  tipoTrabalho: TipoTrabalho,
  nivel: NivelExperiencia,
  formato: FormatoCitacao,
  areaConhecimento?: string,
): string {
  const campo = detectarCampo(areaConhecimento ?? '')
  const regrasCampo = getRegrasCampoAcademico(campo, tipoTrabalho)
  const nivelDesc = {
    iniciante: 'estudante de graduação ainda aprendendo a escrita científica. Use linguagem didática, explique termos técnicos e forneça mais orientação.',
    intermediario: 'pesquisador com experiência básica. Use linguagem técnica direta e objetiva.',
    avancado: 'pesquisador experiente. Seja preciso, técnico e conciso.',
  }[nivel]

  const tipoDesc: Record<TipoTrabalho, string> = {
    tcc: 'TCC (Trabalho de Conclusão de Curso)',
    artigo_original: 'artigo científico original',
    artigo_revisao: 'artigo de revisão narrativa',
    relato_caso: 'relato de caso clínico',
    monografia: 'monografia de especialização',
    dissertacao_mestrado: 'dissertação de mestrado',
    tese_doutorado: 'tese de doutorado',
    revisao_sistematica: 'revisão sistemática',
    projeto_pesquisa: 'projeto de pesquisa',
    relatorio_ic: 'relatório de iniciação científica',
  }

  const instrucaoCitacao = formato === 'vancouver'
    ? `CITAÇÃO VANCOUVER (ICMJE):
- Use números entre colchetes [1], [2], conforme a ORDER DE PRIMEIRA APARIÇÃO no texto.
- Mesmo número sempre que reusar a mesma referência: se [3] foi usado antes, use [3] de novo.
- Cada afirmação factual proveniente de literatura deve ter um número de citação imediatamente após.
- PROIBIDO usar (AUTOR, ANO) ou qualquer formato parentético — Vancouver é exclusivamente numérico.`
    : formato === 'apa'
    ? `CITAÇÃO APA 7ª Ed.:
- Formato parentético: (Sobrenome, Ano) — ex: (Silva, 2021) ou (Costa & Lima, 2019).
- 3+ autores: (Silva et al., 2020).
- Toda afirmação factual da literatura deve ter citação imediatamente após o argumento.
- PROIBIDO usar (SOBRENOME, ANO) em maiúsculas — APA usa capitalização normal.`
    : `CITAÇÃO ABNT NBR 10520:
- Parentético: (SOBRENOME, ANO) ou SOBRENOME (ANO) quando o autor é sujeito da frase.
- 2 autores: (SILVA; COSTA, 2020). Três ou mais: (SILVA et al., 2020).
- Autores institucionais são válidos: (WORLD HEALTH ORGANIZATION, 2023), (MINISTÉRIO DA SAÚDE, 2022).
- PROIBIDO citar pelo título do documento — sempre pelo SOBRENOME do autor.
- Se não houver referência disponível para uma afirmação factual: use (SOBRENOME, ANO) como marcador.`

  return `Você é um pesquisador sênior com 30 anos de experiência como orientador de pós-graduação, revisor ad hoc de periódicos Qualis A1 e membro de bancas de doutorado. Você já leu e avaliou milhares de trabalhos científicos e sabe exatamente o que separa um texto medíocre de um que impressiona examinadores.

Está redigindo uma seção de um ${tipoDesc[tipoTrabalho]} para um ${nivelDesc}
O formato de citação é ${formato.toUpperCase()}.
Idioma: português brasileiro formal e acadêmico.

PADRÃO DE EXCELÊNCIA ABSOLUTO — estes são os critérios que bancas de doutorado e revisores de periódicos Qualis A1 aplicam:

1. DENSITY DE CITAÇÕES (regra real dos melhores trabalhos do mundo):
   - Introdução: mínimo 15-25 citações em 300-500 palavras (toda afirmação contextual = citação)
   - Revisão de Literatura: mínimo 30-50 citações (toda síntese comparativa = citação)
   - Métodos: citações para CADA instrumento/escala/software/protocolo usado
   - Discussão: mínimo 20-35 citações (cada comparação com literatura = citação)
   - Conclusão: 3-8 citações para ancoragens finais
   - REGRA UNIVERSAL: TODO argumento factual proveniente de literatura externa = citação imediata

2. QUALIDADE DAS AFIRMAÇÕES: dados específicos, não generalidades.
   - Saúde: "A prevalência de diabetes tipo 2 no Brasil é de 16,8% (MALERBI; FRANCO, 1992; SBD, 2023)" — não "o diabetes é comum"
   - Direito: "O art. 37, caput, da Constituição Federal (BRASIL, 1988) estabelece que..." — não "a Constituição prevê"
   - Educação: "74,3% dos estudantes brasileiros do 5º ano não atingem proficiência em leitura (INEP, 2023)" — não "a qualidade da educação é ruim"
   - Agronomia: "A produtividade média de soja no Brasil na safra 2023/24 foi de 3.391 kg/ha (CONAB, 2024)" — não "a soja teve boa produtividade"

3. RIGOR METODOLÓGICO: cite instrumentos, protocolos, diretrizes e consensos pelo nome exato, com referência.
   - Instrumentos validados: "Escala de Ansiedade de Beck (BAI; BECK et al., 1988)"
   - Normas técnicas: "conforme a ABNT NBR 6118:2023" ou "segundo a ISO 9001:2015"
   - Legislação: no formato ABNT: "BRASIL. Lei nº 13.709, de 14 de agosto de 2018..."
   - Diretrizes: "segundo as diretrizes do Conselho Nacional de Saúde, Resolução 466/2012 (CNS, 2012)"

4. CITAÇÕES ESPECÍFICAS POR ÁREA:
   - Direito: cite leis, decretos, resoluções e jurisprudências como autores institucionais — ex: (BRASIL, 2018) para leis federais, (STJ, 2023) para acórdãos do STJ
   - Engenharia: cite normas técnicas como (ABNT, 2023) ou (ISO, 2015)
   - Educação: cite documentos oficiais como (MEC, 2017) para BNCC, (BRASIL, 1996) para LDB
   - Agronomia: cite órgãos como (EMBRAPA, 2023), (CONAB, 2024), (MAPA, 2022)
   - Saúde: cite órgãos como (WHO, 2023), (MS, 2022), (CFM, 2020)

${instrucaoCitacao}
${regrasCampo}
Siga rigorosamente as normas ABNT NBR para trabalhos brasileiros quando aplicável.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCRITA HUMANA — ESTAS REGRAS TÊM PRIORIDADE MÁXIMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O texto deve passar como escrita humana em ferramentas como GPTZero e Turnitin.
As duas métricas mais importantes que essas ferramentas medem são:

1. BURSTINESS (variação de comprimento de frases):
   Textos de IA têm frases de comprimento uniforme (15-20 palavras cada).
   Textos humanos alternam abruptamente: frases de 5 palavras ao lado de frases de 35.
   REGRA OBRIGATÓRIA: A cada 2-3 frases longas, escreva 1 frase com menos de 8 palavras.
   Exemplo de ritmo humano: "O resultado surpreendeu. Esperávamos uma redução modesta, mas os dados apontaram para uma queda de quase 40% na incidência — muito acima do que qualquer estudo anterior havia registrado nesse contexto específico. Algo estava diferente ali."

2. PERPLEXIDADE (imprevisibilidade):
   IA tende a escolher sempre a palavra mais provável. Humanos usam palavras incomuns, mudam de direção, contradizem expectativas.
   REGRA OBRIGATÓRIA: Em cada parágrafo, inclua pelo menos um elemento inesperado — uma ressalva, uma contradição, um dado concreto que não foi anunciado, uma mudança de perspectiva.

EXPRESSÕES COMPLETAMENTE PROIBIDAS (uso de qualquer uma invalida o texto):
× "Neste sentido" / "Neste contexto" / "Neste cenário"
× "Diante do exposto" / "Diante disso" / "Diante desse cenário"
× "Cabe ressaltar" / "Cabe destacar" / "Cabe mencionar"
× "É importante salientar" / "Vale salientar" / "Vale ressaltar" / "Vale mencionar"
× "Destaca-se que" / "Salienta-se que" / "Evidencia-se que" (início de parágrafo)
× "Desta forma" / "Dessa forma" / "De tal forma" (como conector de parágrafo)
× "Outrossim" / "Destarte" / "Ademais" / "Não obstante" / "Consoante" / "Mormente"
× "Com base no exposto" / "Com base no que foi apresentado" / "Com base nisso"
× "Em virtude do exposto" / "Em face do exposto" / "Em vista do exposto"
× "Tendo em vista o exposto" / "Dito isso"
× "A literatura aponta que" / "A literatura evidencia que" / "A literatura ressalta que" (início de parágrafo)
× "Conforme supracitado" / "Conforme mencionado anteriormente"
× Iniciar 2 parágrafos consecutivos com a mesma palavra ou estrutura
× Usar a mesma fórmula de abertura: [conector transitivo]. [afirmação geral]. [citação de apoio].

PADRÕES ESTRUTURAIS PROIBIDOS (o que a IA faz e humanos não fazem):
× Três parágrafos seguidos com o mesmo número de frases (ex: todos com 4 frases)
× Listas com estrutura paralela perfeita dentro do corpo do texto
× Encerrar parágrafo com resumo/conclusão do que acabou de ser dito ("Assim, fica evidente que...")
× Usar sempre a mesma estrutura de citação no texto (ex: todos "Autor (ano) afirma que...")

COMO ESCREVER COM TEXTURA HUMANA:
→ Misture frases muito curtas com frases longas e subordinadas — de forma imprevisível
→ Use voz ativa em algumas frases e passiva em outras — sem padrão fixo
→ Comece parágrafos de formas radicalmente diferentes: às vezes com dado numérico direto, às vezes com uma observação do campo, às vezes questionando uma premissa, às vezes com uma afirmação que parece óbvia mas não é
→ Inclua hesitações analíticas naturais: "embora isso não seja conclusivo", "ao menos no contexto estudado", "o que não significa dizer que"
→ Use vocabulário específico da área — não genérico. Um cardiologista não fala "problema cardíaco", fala "insuficiência ventricular esquerda compensada"
→ Deixe que algum parágrafo seja mais curto (2-3 frases) e outro mais longo (6-7 frases) — como qualquer autor real faz quando perde a noção do limite
→ Conectores naturais e variados: "Por isso", "Ao mesmo tempo", "Curiosamente", "O que chama atenção", "Não por acaso", "Isso porque", "O problema, porém, é que", "Em termos práticos", "Dito de outro modo", "O paradoxo aqui é"
→ Ocasionalmente, comece um parágrafo com a conclusão e depois explique — ao invés de sempre construir do geral para o específico`
}

// ============================================================
// Helper — formata referências para contexto do prompt
// ============================================================

export function formatarRefsParaPrompt(
  refs: Referencia[],
  formato: FormatoCitacao = 'abnt',
  idsComResumo?: Set<string>,
): string {
  if (!refs.length) return ''
  return refs.map((ref, i) => {
    // Usa o helper centralizado de citação inline
    const citacao = citacaoInTexto(ref, formato, i + 1)

    // Fontes selecionadas como relevantes mostram o RESUMO da fonte: a IA passa
    // a saber o que ela DIZ (não só o título) e pode citá-la com suporte real.
    if (idsComResumo?.has(ref.id) && (ref.abstract ?? '').trim()) {
      return `  ${citacao} → "${ref.titulo}"\n      Resumo da fonte: ${resumirAbstract(ref.abstract ?? '', 480)}`
    }

    const refFormatada = formato === 'abnt'
      ? ref.referencia_formatada_abnt
      : formato === 'vancouver'
        ? ref.referencia_formatada_vancouver
        : ref.referencia_formatada_apa

    // Remove markdown da visualização no prompt
    const refLimpa = refFormatada?.replace(/\*\*/g, '').replace(/\*/g, '') ?? null

    return `  ${citacao} → "${ref.titulo}"${refLimpa ? ` | Ref completa: ${refLimpa}` : ''}`
  }).join('\n')
}

/**
 * Instrução de citação compartilhada (editor + documentos do projeto).
 * Exige densidade máxima: TODA sentença factual termina com uma citação real,
 * reutilizando livremente as referências. Placeholders viram exceção rara.
 */
export function buildInstrucaoCitacaoReferencias(
  referencias: Referencia[],
  formato: FormatoCitacao = 'abnt',
): string {
  if (!referencias.length) {
    return `
INSTRUÇÃO DE CITAÇÃO — SEM REFERÊNCIAS CADASTRADAS:
Para CADA sentença que faça uma afirmação factual da literatura, marque ao final com (SOBRENOME, ANO).
- PROIBIDO inventar sobrenomes/anos reais. Use SEMPRE o marcador genérico (SOBRENOME, ANO).
- PROIBIDO escrever "(verificar referência)", "(referência)", "(citar fonte)" ou marcadores vagos.
- PROIBIDO citar pelo título do documento.`
  }

  const fmt = formato.toUpperCase()
  const exemplo = formato === 'vancouver'
    ? `número entre colchetes na ordem de aparição: [1], [2]. Reuse o MESMO número sempre que citar a mesma referência.`
    : formato === 'apa'
    ? `DUAS formas (escolha conforme a posição do autor na frase):
   • Autor FORA da frase → tudo entre parênteses, formato normal: "...é eficaz (Silva, 2020)." | dois autores: (Silva & Costa, 2020) | três+: (Silva et al., 2020).
   • Autor DENTRO da frase (sujeito) → só o ANO entre parênteses: "Segundo Silva (2020), ..." | "Silva e Costa (2020) observaram..."
   NUNCA escreva o sobrenome com o ano fora dos parênteses sem que o autor seja sujeito da frase.`
    : `REGRA DE PARÊNTESES (ABNT NBR 10520) — DUAS formas, conforme a posição do autor:
   • Autor FORA da frase → TUDO entre parênteses e em MAIÚSCULAS, separador ponto-e-vírgula:
     "...é eficaz (SILVA, 2020)." | dois autores: (SILVA; COSTA, 2020) | três ou mais: (SILVA et al., 2020).
   • Autor DENTRO da frase (é o sujeito) → sobrenome em minúsculas (só inicial maiúscula), separador "e", e SÓ o ano entre parênteses:
     "Segundo Silva (2020), ..." | "Silva e Costa (2020) demonstraram..." | "Silva et al. (2020) observaram..."
   ERRO PROIBIDO: escrever o sobrenome em MAIÚSCULAS com o ano fora dos parênteses (ex: "GAN; GOLDBERG (2018)" está ERRADO).
   O correto seria "(GAN; GOLDBERG, 2018)" (fora da frase) OU "Gan e Goldberg (2018)" (na frase).`

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA DE OURO DAS CITAÇÕES — DENSIDADE MÁXIMA (siga rigorosamente)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você tem ${referencias.length} referências reais disponíveis. O texto é uma SÍNTESE delas.

1. CITAÇÃO EM CADA SENTENÇA FACTUAL: toda frase que afirme um fato, dado, achado, mecanismo, prevalência, definição ou recomendação DEVE terminar com uma citação real. Em uma revisão de literatura, espere que praticamente TODA sentença tenha citação. Frases de transição/conexão (poucas) podem não ter.

2. VARIE AS REFERÊNCIAS — distribua bem: use o MAIOR número possível de referências DIFERENTES da lista. Um bom texto cita muitas fontes distintas, não as mesmas 2-3 repetidamente. Como regra prática, evite citar a mesma referência mais de 3-4 vezes no texto inteiro. Reutilizar é permitido quando uma referência é realmente a melhor para a frase, mas SEMPRE prefira trazer uma referência ainda não usada se ela também embasar a afirmação. Antes de repetir uma referência, pergunte-se: "há outra na lista que sirva e que eu ainda não citei?"

3. AMPLITUDE COM ANCORAGEM (regra central de qualidade): TODAS as ${referencias.length} referências da lista são REAIS e curadas para este tema — você DEVE citar MUITAS delas (um bom texto cita dezenas de fontes distintas, não 3-4). Citar uma referência real da lista pelo seu tema/título é correto e esperado — isso NÃO é inventar. O que é PROIBIDO é inventar uma referência fora desta lista. As que trazem "Resumo da fonte:" você conhece em detalhe: ancore a afirmação no que o resumo diz e nunca atribua a ela um achado que o resumo CONTRADIZ. As demais (sem resumo) você cita pelo título quando ele for condizente com o ponto. Percorra a lista INTEIRA e use ao máximo a diversidade dela — não concentre tudo nas poucas que têm resumo.

4. FORMATO ${fmt}: ${exemplo}
   Copie a citação EXATAMENTE como aparece na lista (mesmo sobrenome, mesmo ano).

5. PLACEHOLDER É ÚLTIMO RECURSO E TEM FORMA FIXA: use EXATAMENTE "(SOBRENOME, ANO)" — com a palavra ANO, NUNCA um ano real. É PROIBIDO escrever "(SOBRENOME, 2024)", "(SOBRENOME, 2019)", "(AUTOR, 2023)" ou qualquer variação com ano numérico no placeholder. Se você não tem a referência, o ano também é desconhecido: escreva ANO. Use placeholder apenas se NENHUMA das ${referencias.length} referências tiver relação com a frase (meta: < 1 a cada 15 citações).

6. NUNCA misture nome de autor na frase + placeholder: é PROIBIDO escrever algo como "Mulik Devika (SOBRENOME, ANO)" ou "Silva (SOBRENOME, ANO)". Se você sabe o autor real, cite-o completo da lista: "Silva (2020)". Se NÃO há referência, use SÓ o marcador "(SOBRENOME, ANO)" — sem nome de autor antes dele.

7. PROIBIDO: inventar sobrenome/ano fora da lista; escrever "(verificar referência)", "(referência)", "(citar fonte)"; citar pelo título do documento; deixar afirmação factual sem citação.`
}

// ============================================================
// Prompt para geração de seção
// ============================================================

// Rótulos legíveis para as respostas do questionário
const ROTULOS_RESPOSTAS: Record<string, string> = {
  tema_principal:       'Tema principal',
  delimitacao:          'Delimitação do tema',
  motivacao:            'Motivação do pesquisador',
  problema_central:     'Problema central',
  pergunta_norteadora:  'Pergunta norteadora',
  hipotese:             'Hipótese',
  objetivo_geral:       'Objetivo geral',
  objetivos_especificos:'Objetivos específicos',
  relevancia:           'Relevância do tema',
  problema_pratico:     'Problema prático abordado',
  lacuna:               'Lacuna na literatura',
  tipo_pesquisa:        'Tipo de pesquisa',
  participantes:        'Participantes / fontes estudadas',
  periodo_local:        'Período e local',
  instrumentos:         'Instrumentos de coleta',
  analise:              'Análise dos dados',
  dados_planilha:       'Dados brutos da planilha do estudo (analise estes dados e use-os diretamente)',
  achado_principal:     'Achado principal',
  outros_achados:       'Outros achados',
  dados_numericos:      'Dados numéricos e estatísticas',
  surpresa:             'Resultado surpreendente',
  comparacao_literatura:'Comparação com a literatura',
  explicacao:           'Explicação dos resultados',
  implicacoes:          'Implicações práticas',
  limitacoes:           'Limitações do estudo',
  resposta_objetivo:    'Resposta ao objetivo',
  contribuicao:         'Contribuição para a área',
  recomendacoes:        'Recomendações',
  temas_principais:     'Tópicos principais a cobrir',
  autores_referencias:  'Autores/estudos a incluir',
  perspectiva:          'Perspectiva teórica',
  contexto:             'Contexto e informações adicionais',
}

// ============================================================
// Formato técnico rigoroso por seção
// ============================================================

/** Seções que têm estrutura fixa (lista/itens) e NÃO devem virar prosa humanizada. */
export function ehSecaoEstruturada(chaveSecao: string): boolean {
  const c = chaveSecao.toLowerCase()
  return c.includes('objetivo') || c === 'pico' || c.includes('pergunta_pico')
}

/**
 * Regras de formato específicas de cada seção — garante que a estrutura siga
 * o padrão técnico de trabalhos científicos de alta qualidade.
 */
export function getRegrasFormatoSecao(chaveSecao: string): string | null {
  const c = chaveSecao.toLowerCase()

  // ── OBJETIVOS — estrutura rigorosa, concisa, sem prosa ────────────────────
  if (c.includes('objetivo')) {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO OBRIGATÓRIO DA SEÇÃO OBJETIVOS — NORMA TÉCNICA RIGOROSA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esta seção é OBJETIVA e ESTRUTURADA. NÃO escreva parágrafos longos, contextualização ou justificativa (isso pertence a outras seções).

ESTRUTURA EXATA (siga este formato literalmente):

**Objetivo Geral**
[UMA única frase, começando com verbo no infinitivo (Analisar, Avaliar, Comparar, Investigar, Determinar, Identificar, Verificar, Descrever, Estimar, Correlacionar). Máximo 40 palavras. Deve responder diretamente à pergunta de pesquisa. Sem subordinadas excessivas.]

**Objetivos Específicos**
1. [Verbo no infinitivo + UMA ação concreta e mensurável. Máximo 25 palavras.]
2. [Verbo no infinitivo + UMA ação concreta e mensurável.]
3. [Verbo no infinitivo + UMA ação concreta e mensurável.]
4. [Opcional — máximo 5 itens no total.]

EXEMPLO DE FORMATO CORRETO (siga este padrão):
**Objetivo Geral**
Avaliar a associação entre o tempo de uso de redes sociais e os níveis de ansiedade em adolescentes de escolas públicas de Belo Horizonte.

**Objetivos Específicos**
1. Mensurar o tempo médio diário de uso de redes sociais na amostra.
2. Aferir os níveis de ansiedade por meio do Inventário de Ansiedade de Beck.
3. Correlacionar o tempo de uso com os escores de ansiedade obtidos.
4. Comparar os níveis de ansiedade entre grupos de uso intenso e moderado.

PROIBIDO NESTA SEÇÃO:
✗ Parágrafos narrativos ou contextuais ("Neste estudo, optamos por...", "O paradoxo é...")
✗ Justificativa, revisão de literatura ou citações
✗ Frases com mais de uma ideia ou objetivo
✗ Mais de 5 objetivos específicos
✗ Verbos vagos não-mensuráveis ("entender", "conhecer", "refletir sobre")
✗ Conectivos de humanização — esta seção é direta e técnica.`
  }

  // ── PERGUNTA PICO — estrutura P/I/C/O ─────────────────────────────────────
  if (c === 'pico' || c.includes('pergunta_pico')) {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO OBRIGATÓRIO — PERGUNTA PICO/PICOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apresente a estrutura PICO de forma clara e objetiva:
**P** (População/Problema): [definição específica]
**I** (Intervenção/Exposição): [definição]
**C** (Comparação): [definição ou "não se aplica"]
**O** (Outcome/Desfecho): [desfecho primário mensurável]
${c.includes('picos') ? '**S** (Tipo de estudo): [delineamentos elegíveis]\n' : ''}
Depois, redija a PERGUNTA DE PESQUISA em uma frase única e bem construída, integrando os elementos PICO.
NÃO escreva contextualização longa — seja direto e técnico.`
  }

  return null
}

export function buildGerarSecaoPrompt(
  fase: FaseConfig,
  dadosTrabalho: {
    titulo?: string
    area?: string
    instituicao?: string
    orientador?: string
    contexto_anterior?: string
    instrucoes_usuario?: string
    respostas_usuario?: Record<string, string>
    referencias?: Referencia[]
    formato_citacao?: FormatoCitacao
    dados_projeto?: import('@/types').DadosProjeto | null
  }
): string {
  const partes: string[] = []

  partes.push(`## Seção a redigir: ${fase.nome}`)
  partes.push(`\n${fase.instrucoes}`)

  if (dadosTrabalho.titulo) {
    partes.push(`\n**Título do trabalho:** ${dadosTrabalho.titulo}`)
  }
  if (dadosTrabalho.area) {
    partes.push(`**Área:** ${dadosTrabalho.area}`)
  }
  if (dadosTrabalho.orientador) {
    partes.push(`**Orientador:** ${dadosTrabalho.orientador}`)
  }

  if (dadosTrabalho.dados_projeto) {
    const p = dadosTrabalho.dados_projeto
    partes.push(`\n## PLANO DO PROJETO DE PESQUISA — USE COMO BASE FACTUAL`)
    partes.push(`Este é o plano de pesquisa criado pelo pesquisador. Use estes dados reais em vez de inventar detalhes:`)
    if (p.pergunta_pesquisa)      partes.push(`**Pergunta de pesquisa:** ${p.pergunta_pesquisa}`)
    if (p.objetivo_geral)         partes.push(`**Objetivo geral:** ${p.objetivo_geral}`)
    if (p.delineamento)           partes.push(`**Delineamento:** ${p.delineamento}`)
    if (p.local_previsto)         partes.push(`**Local:** ${p.local_previsto}`)
    if (p.periodo_previsto)       partes.push(`**Período:** ${p.periodo_previsto}`)
    if (p.populacao_alvo)         partes.push(`**População:** ${p.populacao_alvo}`)
    if (p.amostra_estimada)       partes.push(`**Amostra:** ${p.amostra_estimada}`)
    if (p.instrumentos_previstos) partes.push(`**Instrumentos:** ${p.instrumentos_previstos}`)
    if (p.analise_prevista)       partes.push(`**Análise:** ${p.analise_prevista}`)
    if (p.contexto_geral)         partes.push(`**Contexto:** ${p.contexto_geral}`)
    if (p.justificativa_resumida) partes.push(`**Justificativa:** ${p.justificativa_resumida}`)
    // Campos estruturados do painel de dados (N, software, taxa)
    const temDadosEstruturados = p.n_participantes || p.software_analise || p.taxa_resposta
    if (temDadosEstruturados) {
      partes.push(`\n## DADOS DA PESQUISA — INFORMAÇÕES REAIS DO ESTUDO`)
      partes.push(`Use estes dados reais ao escrever Metodologia, Resultados e Discussão:`)
      if (p.n_participantes) partes.push(`**N de participantes (real):** ${p.n_participantes}`)
      if (p.taxa_resposta)   partes.push(`**Taxa de resposta:** ${p.taxa_resposta}`)
      if (p.software_analise) partes.push(`**Software de análise:** ${p.software_analise}`)
    }
    // Notas estruturadas do painel de dados — cada bloco vai para a seção certa
    if (p.notas_contexto?.trim()) {
      partes.push(`\n## CONTEXTO E JUSTIFICATIVA DO PESQUISADOR`)
      partes.push(`Use nas seções de Introdução e Justificativa. São informações locais reais que a IA não conhece:`)
      partes.push(p.notas_contexto.trim())
    }
    if (p.notas_metodologia?.trim()) {
      partes.push(`\n## COMO A COLETA REALMENTE ACONTECEU (notas do pesquisador)`)
      partes.push(`Use na seção de Metodologia. São detalhes operacionais reais — priorize sobre qualquer suposição:`)
      partes.push(p.notas_metodologia.trim())
    }
    if (p.dados_coletados?.trim()) {
      partes.push(`\n## RESULTADOS E ACHADOS REAIS — PRIORIDADE MÁXIMA`)
      partes.push(`Use nas seções de Resultados, Discussão e Conclusão. São dados reais coletados pelo pesquisador.`)
      partes.push(`REGRA CRÍTICA: Use EXATAMENTE estes dados. Nunca invente números, percentuais ou achados diferentes dos listados abaixo.`)
      partes.push(p.dados_coletados.trim())
      // Estatística inferencial calculada de forma determinística (valor-p real)
      const stats = compararGruposDeDados(p.dados_coletados)
      if (stats) partes.push(`\n${stats}`)
    }
    if (p.notas_interpretacao?.trim()) {
      partes.push(`\n## INTERPRETAÇÃO E IMPRESSÕES DO PESQUISADOR`)
      partes.push(`Use na Discussão e Conclusão. São as análises e impressões do próprio autor — reflita elas no texto:`)
      partes.push(p.notas_interpretacao.trim())
    }
    partes.push(`CRÍTICO: Use os dados acima onde forem relevantes. Nunca invente hospital, datas ou população diferente do que está aqui.`)
  }

  // ── Respostas do questionário do usuário (dados reais — máxima prioridade) ──
  if (dadosTrabalho.respostas_usuario) {
    const preenchidas = Object.entries(dadosTrabalho.respostas_usuario)
      .filter(([, v]) => v?.trim())
    if (preenchidas.length > 0) {
      partes.push(`\n## DADOS REAIS DO PESQUISADOR — USE OBRIGATORIAMENTE`)
      partes.push(`O pesquisador forneceu as informações abaixo sobre seu trabalho.`)
      partes.push(`REGRA CRÍTICA: Você DEVE usar esses dados reais no texto gerado. Não invente informações diferentes. Não use placeholders genéricos como "[inserir dados]" ou "[autor, ano]" quando o pesquisador já forneceu a informação real. O texto deve refletir EXATAMENTE o que o pesquisador descreveu.`)

      // Instrução especial para dados de planilha
      if (dadosTrabalho.respostas_usuario['dados_planilha']?.trim()) {
        partes.push(`\nINSTRUÇÃO DE ANÁLISE DE DADOS: O pesquisador colou dados brutos de sua planilha (ver campo "Dados brutos da planilha" abaixo). Você DEVE: (1) interpretar e analisar esses dados; (2) calcular ou extrair estatísticas descritivas relevantes (médias, medianas, percentuais, desvios-padrão, diferenças entre grupos, correlações) diretamente dos dados fornecidos; (3) redigir a seção de Resultados usando EXCLUSIVAMENTE os valores reais extraídos dos dados — nunca invente números ou use placeholders.`)
      }

      partes.push('')
      preenchidas.forEach(([k, v]) => {
        const rotulo = ROTULOS_RESPOSTAS[k] ?? k
        partes.push(`**${rotulo}:**\n${v.trim()}`)
      })
    }
  }

  if (dadosTrabalho.contexto_anterior) {
    partes.push(`\n**Contexto das seções anteriores (use para manter coerência):**\n${dadosTrabalho.contexto_anterior}`)
  }

  if (dadosTrabalho.instrucoes_usuario) {
    partes.push(`\n**Instruções específicas do autor:**\n${dadosTrabalho.instrucoes_usuario}`)
  }

  if (dadosTrabalho.referencias && dadosTrabalho.referencias.length > 0) {
    const formato = dadosTrabalho.formato_citacao ?? 'abnt'
    // Seleciona as fontes mais relevantes para ESTA seção e expõe o resumo delas
    // — a IA escreve ancorada no conteúdo real, não só no título (lê → escreve → cita).
    const termosSecao = [
      fase.nome,
      dadosTrabalho.dados_projeto?.objetivo_geral,
      dadosTrabalho.dados_projeto?.pergunta_pesquisa,
      dadosTrabalho.dados_projeto?.contexto_geral,
      dadosTrabalho.titulo,
      dadosTrabalho.instrucoes_usuario,
    ].filter(Boolean).join(' ')
    const fontesComResumo = selecionarFontesRelevantes(dadosTrabalho.referencias, termosSecao, 16)
    const idsComResumo = new Set(fontesComResumo.map(r => r.id))
    const refsFormatadas = formatarRefsParaPrompt(dadosTrabalho.referencias, formato, idsComResumo)
    const notaResumos = idsComResumo.size > 0
      ? `\n${idsComResumo.size} das fontes trazem "Resumo da fonte:" — você LEU o que elas dizem. Escreva ancorado nesses resumos e cite cada fonte só onde o resumo dela sustenta a afirmação.`
      : ''
    partes.push(`\n## ${dadosTrabalho.referencias.length} REFERÊNCIAS REAIS DISPONÍVEIS — A BASE DO SEU TEXTO\nCada linha mostra a citação no texto → o título do estudo.${notaResumos}\n${refsFormatadas}`)
    partes.push(buildInstrucaoCitacaoReferencias(dadosTrabalho.referencias, formato))
  } else {
    partes.push(`
INSTRUÇÃO DE CITAÇÃO — SEM REFERÊNCIAS AINDA:
O sistema buscou referências mas ainda não há nenhuma cadastrada para este trabalho.
PROTOCOLO OBRIGATÓRIO para cada afirmação factual da literatura:
- Marque IMEDIATAMENTE com (SOBRENOME, ANO) — nunca escreva um argumento factual sem marcador.
- PROIBIDO inventar sobrenomes reais (Silva, Costa, Hahn, etc.) — use SEMPRE o placeholder genérico.
- PROIBIDO citar pelo título do documento ("TÓPICOS EM SAÚDE, 2021" → ERRO).
- PROIBIDO inventar anos específicos (2019, 2023, etc.).
- Use EXATAMENTE: (SOBRENOME, ANO) — cada ocorrência marca onde uma referência real deve entrar.
Meta: em uma Introdução de 300 palavras, espera-se 10-20 marcadores (SOBRENOME, ANO). Em uma Discussão de 500 palavras, 15-30. Não seja avaro com citações — todo argumento precisa de ancoragem.`)
  }

  partes.push(`\n**Elementos obrigatórios nesta seção:**`)
  fase.elementos_obrigatorios.forEach(el => partes.push(`- ${el}`))

  partes.push(`\n**Erros comuns a evitar:**`)
  fase.erros_comuns.forEach(er => partes.push(`- ${er}`))

  if (fase.min_palavras || fase.max_palavras) {
    const max = fase.max_palavras
    partes.push(
      `\n**EXTENSÃO (LIMITE RÍGIDO):** entre ${fase.min_palavras ?? '—'} e ${max ?? '—'} palavras.` +
      (max ? ` NÃO ultrapasse ${max} palavras em hipótese alguma — é melhor um texto conciso e denso do que longo e prolixo. Se passar de ${max}, corte frases redundantes e enxugue até caber. Conte mentalmente as palavras antes de entregar.` : '')
    )
  }

  // ── Portão de qualidade: normas rigorosas da seção (verificar antes/depois) ──
  partes.push(getNormasSecao(fase.chave_secao ?? fase.id ?? '', fase.nome))

  // ── Formato técnico específico da seção (estrutura rigorosa) ────────────────
  const formatoSecao = getRegrasFormatoSecao(fase.chave_secao ?? fase.id ?? '')
  if (formatoSecao) {
    partes.push(formatoSecao)
  }

  partes.push(`\nAgora redija a seção "${fase.nome}" de forma completa e acadêmica em português brasileiro formal.
REGRAS FINAIS INEGOCIÁVEIS:
- Escreva APENAS o texto da seção — sem títulos introdutórios, sem "Seção X:", sem metacomentários
- Use SEMPRE os dados reais do pesquisador fornecidos acima — nunca escreva textos genéricos ou com placeholders como [autor], [ano], [inserir dados]
- O texto deve soar como se o pesquisador realmente fez aquilo que descreveu
- Qualidade mínima: um professor doutor experiente deve ficar impressionado com o texto${fase.max_palavras ? `\n- RESPEITE o limite de ${fase.max_palavras} palavras — concisão é qualidade; não encha linguiça para alongar` : ''}`)

  // Seções estruturadas (objetivos, palavras-chave) NÃO recebem regras de prosa/burstiness
  if (ehSecaoEstruturada(fase.chave_secao ?? fase.id ?? '')) {
    return partes.join('\n')
  }

  partes.push(`
HUMANIZAÇÃO CRÍTICA — APLIQUE ANTES DE CADA PARÁGRAFO:
Antes de escrever cada parágrafo, pergunte-se: "Um pesquisador humano real escreveria exatamente assim?"
Se a resposta for não, reescreva. O objetivo é BURSTINESS e PERPLEXIDADE altas.

BURSTINESS — regra de ouro:
  Após 2 frases longas (mais de 20 palavras), escreva 1 frase curta (menos de 9 palavras).
  Exemplo de ritmo certo: [frase longa de 25 palavras]. [frase longa de 30 palavras]. [frase de 6 palavras.] [frase longa de 22 palavras].

PERPLEXIDADE — regra de ouro:
  Cada parágrafo deve ter pelo menos 1 elemento que quebre a expectativa: uma ressalva, um dado específico inesperado, uma mudança de perspectiva, uma comparação incomum, ou uma conclusão antecipada.

PROIBIDO (invalida o texto inteiro se usado):
  "Neste sentido", "Diante do exposto", "Cabe ressaltar", "Vale salientar", "Desta forma", "Outrossim", "Ademais", "Destarte", "Com base no exposto", "É importante salientar", "Dessa forma", "Salienta-se", "Evidencia-se", "Tendo em vista", "Não obstante", "Destaca-se", "A literatura aponta que" (início de parágrafo), "Conforme supracitado"

CONECTORES PERMITIDOS: "Por isso", "Ao mesmo tempo", "Por outro lado", "Não por acaso", "Isso porque", "Em termos práticos", "O que chama atenção", "Curiosamente", "O paradoxo é que", "Dito de outro modo", "O problema, porém", "Em termos concretos"

ESTRUTURA PROIBIDA: não repita [frase de abertura com conector] + [afirmação] + [citação] em dois parágrafos consecutivos.
ESTRUTURA RECOMENDADA: alterne entre começar com dado concreto, começar com afirmação direta, começar com ressalva, começar com verbo de ação no sujeito humano.

REGRA CRÍTICA DE CITAÇÃO — LEIA COM ATENÇÃO:
Uma citação em ABNT é sempre (SOBRENOME DO AUTOR, ANO) — nunca o título do documento.
EXEMPLOS DE ERROS FATAIS QUE VOCÊ DEVE EVITAR:
  ✗ ERRADO: (TÓPICOS EM CIÊNCIAS DA SAÚDE, 2021) — isso é um título, não um sobrenome de autor
  ✗ ERRADO: (PERFIL DE COMPETÊNCIAS, s.d.) — isso é um título, não um sobrenome de autor
  ✗ ERRADO: (DIRETRIZES NACIONAIS, 2020) — isso é um título, não um sobrenome de autor
  ✓ CORRETO: (SILVA, 2021) — sobrenome do autor + ano
  ✓ CORRETO: (COSTA et al., 2019) — sobrenome + et al. + ano
  ✓ CORRETO: (SOBRENOME, ANO) — marcador genérico quando não há referência disponível
Se não houver referência disponível para embasar um argumento, escreva o argumento SEM citação. Jamais invente sobrenomes de autores.`)

  return partes.join('\n')
}

// ============================================================
// Prompt para validação de seção
// ============================================================

export function buildValidarSecaoPrompt(
  fase: FaseConfig,
  conteudo: string,
  formatoCitacao?: FormatoCitacao
): string {
  const palavras = conteudo.trim().split(/\s+/).length
  const nPlaceholders = (conteudo.match(/\(SOBRENOME,\s*ANO\)/gi) ?? []).length

  const avisoPlaceholders = nPlaceholders > 0
    ? `\nNOTA SOBRE CITAÇÕES PLACEHOLDER: O texto contém ${nPlaceholders} marcador(es) "(SOBRENOME, ANO)". São PLACEHOLDERS INTENCIONAIS do sistema — o pesquisador ainda não inseriu as referências reais. NÃO classifique como "crítico". Liste como sugestão "importante" informando quantas faltam. Reduza o score no máximo 3 pontos por placeholder (máximo −15 total por placeholders).`
    : ''

  const avisoFormato = formatoCitacao === 'vancouver'
    ? `\nNOTA SOBRE FORMATO VANCOUVER: Se o texto usa (Autor, Ano) em vez de [1],[2], é inconsistência de formato, NÃO erro crítico de conteúdo. Classifique como "sugestao" (azul), deduza no máximo 5 pontos do score. O conteúdo e a estrutura do texto são muito mais importantes que o formato de citação.`
    : ''

  return `Você é um professor orientador experiente avaliando uma seção de trabalho científico. Seu papel é ser JUSTO e CONSTRUTIVO — não severo ou punitivo.

**FILOSOFIA DE AVALIAÇÃO (leia antes de avaliar):**
A pontuação deve refletir a QUALIDADE REAL do conteúdo, não perfeições formais. Um texto com bom conteúdo e estrutura merece score alto mesmo com imperfeições menores.

ESCALA DE REFERÊNCIA REAL:
• 85-100: Texto excelente — publicável em periódico sem revisão maior. Elementos todos presentes, argumentação forte, linguagem impecável.
• 70-84: Texto bom — aprovado com pequenas revisões. Todos os elementos presentes, possíveis ajustes de linguagem ou citações.
• 55-69: Texto razoável — requer revisão moderada. A maioria dos elementos presente; lacunas identificáveis mas não estruturais.
• 40-54: Texto com problemas — revisão significativa necessária. Falta elemento obrigatório importante ou tem erro estrutural.
• Abaixo de 40: Apenas se o texto estiver fundamentalmente errado (seção completamente fora do escopo, linguagem completamente inadequada, totalmente vazio de conteúdo relevante).

REGRAS INEGOCIÁVEIS DE AVALIAÇÃO:
1. Texto com comprimento adequado (${fase.min_palavras ?? 0}+ palavras) e elementos obrigatórios presentes → score MÍNIMO de 55.
2. Texto com bom conteúdo e estrutura → score de 70+, mesmo com format de citação errado.
3. Expressões como "O paradoxo é esse", "O que chama atenção", "Não por acaso", "Em termos práticos", "O problema, porém", "Dito de outro modo", "Em termos concretos" são linguagem acadêmica contemporânea ACEITÁVEL — NÃO as classifique como informais.
4. Primeira pessoa do plural (nós, nosso, nossa, optamos, identificamos) é PADRÃO em artigos científicos brasileiros (ABNT) — NÃO é erro. Se for seção de Métodos em estilo impessoal, mencione como "sugestao" (azul), nunca "critico".
5. Formato de citação: inconsistência de formato (ex: ABNT num trabalho Vancouver) é "sugestao" leve, NUNCA "critico". O conteúdo vale 80% do score.

**Seção avaliada:** "${fase.nome}"
**Texto enviado (${palavras} palavras):**
${conteudo}

**Elementos obrigatórios:** ${fase.elementos_obrigatorios.join(', ')}
**Erros críticos reais a verificar:** ${fase.erros_comuns.join(', ')}
**Extensão esperada:** ${fase.min_palavras ?? 0}–${fase.max_palavras ?? '∞'} palavras
**Formato de citação:** ${formatoCitacao?.toUpperCase() ?? 'ABNT'}${avisoFormato}${avisoPlaceholders}

Responda APENAS com JSON válido. Máximo 4 sugestões práticas e específicas. Score deve ser realista — um texto bem escrito e completo merece 70+:
{"aprovado":boolean,"score":number,"comentarios":"avaliação construtiva em 1-2 frases focada nos pontos fortes E no principal ponto de melhoria","sugestoes":[{"id":"s1","tipo":"critico"|"importante"|"sugestao","titulo":"título curto e específico","descricao":"o que exatamente mudar e por quê — seja específico e construtivo"}]}`
}

// ============================================================
// Prompt para sugestões de melhoria
// ============================================================

export function buildSugerirMelhorasPrompt(
  nomeFase: string,
  conteudo: string
): string {
  return `Analise o texto abaixo da seção "${nomeFase}" e sugira melhorias específicas.

**Texto:**
${conteudo}

Liste de 3 a 5 sugestões concretas para melhorar o texto.
Responda APENAS com JSON:
[
  {
    "id": "string único",
    "tipo": "critico" | "importante" | "sugestao",
    "titulo": "título curto da sugestão",
    "descricao": "descrição detalhada"
  }
]`
}

// ============================================================
// Prompt para análise/interpretação de planilha de dados
// ============================================================

/**
 * Constrói o prompt para a IA analisar os dados brutos de uma planilha e
 * auxiliar o pesquisador na fase atual do trabalho.
 */
export function buildAnalisarPlanilhaPrompt(
  dadosPlanilha: string,
  nomeSecao: string,
  chaveSecao: string,
  contextoTrabalho: {
    tipoTrabalho?: string
    area?: string
    pergunta_pesquisa?: string
    objetivo_geral?: string
    delineamento?: string
  },
): string {
  const ctx: string[] = []
  if (contextoTrabalho.area)              ctx.push(`Área: ${contextoTrabalho.area}`)
  if (contextoTrabalho.pergunta_pesquisa) ctx.push(`Pergunta de pesquisa: ${contextoTrabalho.pergunta_pesquisa}`)
  if (contextoTrabalho.objetivo_geral)    ctx.push(`Objetivo: ${contextoTrabalho.objetivo_geral}`)
  if (contextoTrabalho.delineamento)      ctx.push(`Delineamento: ${contextoTrabalho.delineamento}`)

  // Orientação específica conforme a seção em que o usuário está
  const chave = chaveSecao.toLowerCase()
  let focoSecao = ''
  if (chave.includes('resultado')) {
    focoSecao = `O pesquisador está na seção de RESULTADOS. Ajude-o a:
- Identificar quais resultados apresentar primeiro (caracterização da amostra → desfecho principal → secundários)
- Calcular as estatísticas descritivas a reportar (médias, DP, frequências, percentuais)
- Sugerir quais tabelas e figuras criar, com títulos
- Indicar quais testes estatísticos rodar e o que cada um responde`
  } else if (chave.includes('metodo') || chave.includes('metodolog') || chave.includes('coleta')) {
    focoSecao = `O pesquisador está na seção de MÉTODOS. Ajude-o a:
- Identificar as variáveis (dependentes, independentes, de controle) e seus tipos
- Confirmar o tamanho amostral real (N) a partir dos dados
- Sugerir a análise estatística apropriada para este tipo de dado
- Apontar se há dados faltantes ou inconsistências a declarar`
  } else if (chave.includes('discussao') || chave.includes('discussão')) {
    focoSecao = `O pesquisador está na seção de DISCUSSÃO. Ajude-o a:
- Identificar os achados mais relevantes para discutir
- Apontar padrões, associações ou contrastes notáveis nos dados
- Sugerir como esses achados podem dialogar com a literatura
- Identificar limitações que os próprios dados revelam`
  } else {
    focoSecao = `Ajude o pesquisador a entender o que estes dados mostram e como usá-los na seção "${nomeSecao}".`
  }

  return `Você é um estatístico e metodologista sênior auxiliando um pesquisador a interpretar os dados que ele coletou. Seja prático, preciso e didático.

${ctx.length > 0 ? `CONTEXTO DO ESTUDO:\n${ctx.join('\n')}\n` : ''}
${focoSecao}

DADOS DA PLANILHA FORNECIDA PELO PESQUISADOR:
${dadosPlanilha.slice(0, 8000)}

INSTRUÇÕES DE ANÁLISE:
1. Interprete a estrutura dos dados: o que cada coluna/variável representa, quantos registros (N), tipos de variáveis.
2. Calcule estatísticas descritivas reais a partir dos dados fornecidos (médias, desvios, frequências, percentuais) — use os NÚMEROS REAIS, nunca invente.
3. Aponte os achados mais importantes que os dados revelam.
4. Recomende os testes/análises estatísticas apropriados, explicando o que cada um responde.
5. Dê orientações práticas para a seção atual (conforme o foco acima).

REGRAS:
- Use SOMENTE os números que estão na planilha. Se algo não puder ser calculado, diga "não é possível determinar a partir destes dados".
- Se os dados estiverem incompletos ou ambíguos, aponte isso e diga o que falta.
- Seja conciso mas completo. Use markdown: **negrito** para destaques, ## para seções, listas com -.
- NÃO escreva o texto final da seção — seu papel é ANALISAR e ORIENTAR, não redigir a seção.
- Responda em português brasileiro.

Organize sua resposta em:
## 📊 O que os dados mostram
## 📈 Estatísticas descritivas
## 🔍 Achados principais
## 🧪 Análises recomendadas
## ✍️ Como usar nesta seção`
}

// ============================================================
// Prompt para geração de resumo/abstract
// ============================================================

export function buildGerarResumoPrompt(
  tipoTrabalho: TipoTrabalho,
  secoesConteudo: Record<string, string>
): string {
  const secoesTxt = Object.entries(secoesConteudo)
    .map(([k, v]) => `### ${k}\n${v.substring(0, 800)}`)
    .join('\n\n')

  return `Com base nas seções abaixo do trabalho, redija um resumo acadêmico estruturado.

O resumo deve:
- Ter entre 150 e 500 palavras (ABNT NBR 6028)
- Incluir: contextualização (1-2 frases), objetivo (1 frase), metodologia (2-3 frases), principais resultados (2-4 frases), conclusão (1-2 frases)
- Não conter citações bibliográficas
- Ser redigido em um único parágrafo contínuo em português brasileiro formal
- NÃO incluir palavras-chave nem título — apenas o texto do resumo
- Soar como escrito por um pesquisador real — varie ritmo, tamanho de frases, conectores
- PROIBIDO: "Neste sentido", "Diante do exposto", "Cabe ressaltar", "Desta forma", "Outrossim", "Ademais"

**Seções do trabalho:**
${secoesTxt}

Escreva APENAS o texto do resumo, sem título, sem "Resumo:", sem palavras-chave, sem metacomentários.`
}

export function buildGerarAbstractPrompt(
  tipoTrabalho: TipoTrabalho,
  resumoPt: string
): string {
  return `Rewrite the following Brazilian Portuguese academic abstract into fluent academic English.

IMPORTANT RULES:
- Do NOT translate literally word-by-word — rewrite it as native academic English
- Use past tense for methods and results ("was conducted", "were analyzed")
- Use present tense for conclusions and general statements
- Maintain the same structure: background, objective, methods, results, conclusion
- Keep it between 150 and 350 words
- Do NOT include keywords, title, or any labels — only the abstract text

**Original abstract in Portuguese:**
${resumoPt}

Write ONLY the abstract text in English, no labels, no title, no keywords.`
}

export function buildSugerirPalavrasChavePrompt(
  texto: string,
  area: string,
  idioma: 'pt' | 'en' = 'pt'
): string {
  const en = idioma === 'en'
  return `Analise o texto acadêmico abaixo e sugira ${en ? 'KEYWORDS in ENGLISH' : 'palavras-chave/descritores'} adequados.

**Área do conhecimento:** ${area}

**Texto:**
${texto.substring(0, 2000)}

Regras:
- Sugira entre 5 e 10 termos
${en
  ? `- TODOS os termos OBRIGATORIAMENTE em INGLÊS — esta é a lista de Keywords em inglês (não traduza para português)
- Para Ciências da Saúde: use descritores MeSH (Medical Subject Headings) oficiais em inglês (ex: "Sepsis", "Hospital Mortality", "Risk Factors", "Health Policy")
- Para outras áreas: termos técnicos consolidados na literatura internacional em inglês
- NUNCA inclua termos em português`
  : `- Para Ciências da Saúde: priorize descritores DeCS (Descritores em Ciências da Saúde) em português
- Para outras áreas: use termos técnicos consolidados na literatura
- Inclua termos em português`}
- Os termos devem ser específicos (não genéricos como "${en ? 'health' : 'saúde'}" ou "${en ? 'research' : 'pesquisa'}")

Responda APENAS com JSON válido:
{"palavras": ["${en ? 'Sepsis' : 'termo1'}", "${en ? 'Hospital Mortality' : 'termo2'}", "termo3", "termo4", "termo5"]}`
}
