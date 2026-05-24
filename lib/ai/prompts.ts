import type { TipoTrabalho, FormatoCitacao, NivelExperiencia, FaseConfig, Referencia } from '@/types'
import { citacaoInTexto } from '@/lib/referencias/formatar'

// ============================================================
// Sistema base — personaliza o tom conforme nível do usuário
// ============================================================

export function buildSystemPrompt(
  tipoTrabalho: TipoTrabalho,
  nivel: NivelExperiencia,
  formato: FormatoCitacao
): string {
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
    ? `Para citações numéricas Vancouver, use [1], [2], [3] etc. conforme a ordem de aparição.`
    : formato === 'apa'
    ? `Para citações APA, use (Sobrenome, Ano) no texto e liste as referências ao final.`
    : `Para citações ABNT (NBR 10520), use a notação SOBRENOME (ANO) ou (SOBRENOME, ANO) no texto.
Para 2 autores: SOBRENOME; SOBRENOME (ANO). Para 3 ou mais: SOBRENOME et al. (ANO).
Se o trabalho tiver referências cadastradas, use-as diretamente com o sobrenome correto do autor.
Se não houver referências cadastradas, use (SOBRENOME, ANO) como formato indicativo — nunca use colchetes [AUTOR, ANO].`

  return `Você é um assistente especializado em escrita científica acadêmica brasileira.
Está ajudando um ${nivelDesc}
O trabalho em elaboração é um ${tipoDesc[tipoTrabalho]}.
O formato de citação adotado é ${formato.toUpperCase()}.
Sempre escreva em português brasileiro formal e acadêmico.
Jamais invente dados, estatísticas ou fatos — deixe espaço explícito para o autor preencher.
${instrucaoCitacao}
Siga rigorosamente as normas ABNT para trabalhos brasileiros quando aplicável.`
}

// ============================================================
// Helper — formata referências para contexto do prompt
// ============================================================

export function formatarRefsParaPrompt(refs: Referencia[], formato: FormatoCitacao = 'abnt'): string {
  if (!refs.length) return ''
  return refs.map((ref, i) => {
    // Usa o helper centralizado de citação inline
    const citacao = citacaoInTexto(ref, formato, i + 1)

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
  achado_principal:     'Achado principal',
  outros_achados:       'Outros achados',
  dados_numericos:      'Dados numéricos',
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

  // ── Respostas do questionário do usuário (dados reais — máxima prioridade) ──
  if (dadosTrabalho.respostas_usuario) {
    const preenchidas = Object.entries(dadosTrabalho.respostas_usuario)
      .filter(([, v]) => v?.trim())
    if (preenchidas.length > 0) {
      partes.push(`\n## DADOS REAIS DO PESQUISADOR — USE OBRIGATORIAMENTE`)
      partes.push(`O pesquisador forneceu as informações abaixo sobre seu trabalho.`)
      partes.push(`REGRA CRÍTICA: Você DEVE usar esses dados reais no texto gerado. Não invente informações diferentes. Não use placeholders genéricos como "[inserir dados]" ou "[autor, ano]" quando o pesquisador já forneceu a informação real. O texto deve refletir EXATAMENTE o que o pesquisador descreveu.`)
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
    const refsFormatadas = formatarRefsParaPrompt(dadosTrabalho.referencias, dadosTrabalho.formato_citacao ?? 'abnt')
    partes.push(`\n**REFERÊNCIAS DISPONÍVEIS — USE APENAS ESTAS:**\n${refsFormatadas}`)
    partes.push(`
REGRA ABSOLUTA DE CITAÇÃO (violá-la invalida todo o texto):
- Cite SOMENTE as referências da lista acima — extrai o sobrenome do primeiro autor e o ano.
- É PROIBIDO inventar qualquer autor, título ou ano que não esteja na lista.
- É PROIBIDO usar como citação o título de um documento (ex: "TÓPICOS EM SAÚDE, 2021") — cite sempre pelo SOBRENOME do autor.
- Se precisar de um conceito não coberto pelas referências disponíveis, escreva o argumento sem citar — NÃO invente uma referência.
- Distribua as citações disponíveis de forma natural ao longo do texto.`)
  } else {
    partes.push(`
REGRA ABSOLUTA DE CITAÇÃO — SEM REFERÊNCIAS CADASTRADAS:
O autor ainda não cadastrou referências. Para marcar onde uma citação deveria aparecer, use EXCLUSIVAMENTE o marcador genérico: (SOBRENOME, ANO).
- PROIBIDO inventar nomes de autores reais (ex: Silva, Costa, Hahn).
- PROIBIDO usar título de documento como citação (ex: "PERFIL DE COMPETÊNCIAS, s.d.").
- PROIBIDO inventar anos específicos (ex: 2019, 2023).
- Use SEMPRE: (SOBRENOME, ANO) — exatamente assim, sem variação.
O autor substituirá esses marcadores pelas referências reais depois.`)
  }

  partes.push(`\n**Elementos obrigatórios nesta seção:**`)
  fase.elementos_obrigatorios.forEach(el => partes.push(`- ${el}`))

  partes.push(`\n**Erros comuns a evitar:**`)
  fase.erros_comuns.forEach(er => partes.push(`- ${er}`))

  if (fase.min_palavras || fase.max_palavras) {
    partes.push(`\n**Extensão:** entre ${fase.min_palavras ?? '—'} e ${fase.max_palavras ?? '—'} palavras.`)
  }

  partes.push(`\nAgora redija a seção "${fase.nome}" de forma completa e acadêmica em português brasileiro formal.
REGRAS FINAIS INEGOCIÁVEIS:
- Escreva APENAS o texto da seção — sem títulos introdutórios, sem "Seção X:", sem metacomentários
- Use SEMPRE os dados reais do pesquisador fornecidos acima — nunca escreva textos genéricos ou com placeholders como [autor], [ano], [inserir dados]
- O texto deve soar como se o pesquisador realmente fez aquilo que descreveu
- Qualidade mínima: um professor doutor experiente deve ficar impressionado com o texto

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
  const formatoInstrucao = formatoCitacao === 'vancouver'
    ? 'Citações devem ser numéricas [1], [2] etc. Verifique se há citações no formato errado como (AUTOR, ANO).'
    : formatoCitacao === 'apa'
    ? 'Citações devem ser no formato APA: (Sobrenome, Ano) ou Sobrenome (Ano) com & para dois autores. Verifique inconsistências.'
    : 'Citações devem ser no formato ABNT NBR 10520: SOBRENOME (ANO) ou (SOBRENOME, ANO). Para 3+ autores: SOBRENOME et al. (ANO). Verifique se há [AUTOR, ANO] ou outros formatos incorretos.'

  return `Avalie a seção "${fase.nome}" abaixo de acordo com os critérios de qualidade acadêmica.

**Texto enviado:**
${conteudo}

**Critérios de avaliação:**
- Elementos obrigatórios presentes: ${fase.elementos_obrigatorios.join(', ')}
- Erros a verificar: ${fase.erros_comuns.join(', ')}
- Extensão: ${fase.min_palavras ?? 0}–${fase.max_palavras ?? '∞'} palavras
- Formato de citação: ${formatoCitacao?.toUpperCase() ?? 'ABNT'}. ${formatoInstrucao}

Responda APENAS com JSON válido e compacto. Máximo 5 sugestões. Seja breve nas descrições:
{"aprovado":boolean,"score":number,"comentarios":"avaliação geral em 1-2 frases","sugestoes":[{"id":"s1","tipo":"critico"|"importante"|"sugestao","titulo":"título curto","descricao":"descrição objetiva"}]}`
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
  area: string
): string {
  return `Analise o texto acadêmico abaixo e sugira palavras-chave/descritores adequados.

**Área do conhecimento:** ${area}

**Texto:**
${texto.substring(0, 2000)}

Regras:
- Sugira entre 5 e 10 termos
- Para Ciências da Saúde: priorize descritores DeCS (Descritores em Ciências da Saúde) / MeSH
- Para outras áreas: use termos técnicos consolidados na literatura
- Os termos devem ser específicos (não genéricos como "saúde" ou "pesquisa")
- Inclua termos em português

Responda APENAS com JSON válido:
{"palavras": ["termo1", "termo2", "termo3", "termo4", "termo5"]}`
}
