import type { TipoTrabalho, FormatoCitacao, NivelExperiencia, FaseConfig } from '@/types'

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

  return `Você é um assistente especializado em escrita científica acadêmica brasileira.
Está ajudando um ${nivelDesc}
O trabalho em elaboração é um ${tipoDesc[tipoTrabalho]}.
O formato de citação usado é ${formato.toUpperCase()}.
Sempre escreva em português brasileiro formal e acadêmico.
Jamais invente dados, estatísticas, referências ou fatos — deixe espaço para o autor preencher com dados reais.
Quando mencionar citações, use a notação [AUTOR, ANO] como placeholder.
Siga rigorosamente as normas ABNT para trabalhos brasileiros quando aplicável.`
}

// ============================================================
// Prompt para geração de seção
// ============================================================

export function buildGerarSecaoPrompt(
  fase: FaseConfig,
  dadosTrabalho: {
    titulo?: string
    area?: string
    instituicao?: string
    orientador?: string
    contexto_anterior?: string
    instrucoes_usuario?: string
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

  if (dadosTrabalho.contexto_anterior) {
    partes.push(`\n**Contexto das seções anteriores (use para manter coerência):**\n${dadosTrabalho.contexto_anterior}`)
  }

  if (dadosTrabalho.instrucoes_usuario) {
    partes.push(`\n**Instruções específicas do autor:**\n${dadosTrabalho.instrucoes_usuario}`)
  }

  partes.push(`\n**Elementos obrigatórios nesta seção:**`)
  fase.elementos_obrigatorios.forEach(el => partes.push(`- ${el}`))

  partes.push(`\n**Erros comuns a evitar:**`)
  fase.erros_comuns.forEach(er => partes.push(`- ${er}`))

  if (fase.min_palavras || fase.max_palavras) {
    partes.push(`\n**Extensão:** entre ${fase.min_palavras ?? '—'} e ${fase.max_palavras ?? '—'} palavras.`)
  }

  partes.push(`\nAgora redija a seção "${fase.nome}" de forma completa e acadêmica. Escreva apenas o texto da seção, sem títulos introdutórios, sem metacomentários sobre o processo.`)

  return partes.join('\n')
}

// ============================================================
// Prompt para validação de seção
// ============================================================

export function buildValidarSecaoPrompt(
  fase: FaseConfig,
  conteudo: string
): string {
  return `Avalie a seção "${fase.nome}" abaixo de acordo com os critérios de qualidade acadêmica.

**Texto enviado:**
${conteudo}

**Critérios de avaliação:**
- Elementos obrigatórios presentes: ${fase.elementos_obrigatorios.join(', ')}
- Erros a verificar: ${fase.erros_comuns.join(', ')}
- Extensão: ${fase.min_palavras ?? 0}–${fase.max_palavras ?? '∞'} palavras

Responda APENAS com JSON válido no seguinte formato:
{
  "aprovado": boolean,
  "score": number (0-100),
  "comentarios": "string com avaliação geral",
  "sugestoes": [
    {
      "id": "string único",
      "tipo": "critico" | "importante" | "sugestao",
      "titulo": "título curto",
      "descricao": "descrição da melhoria"
    }
  ]
}`
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
// Prompt para geração de referências
// ============================================================

export function buildGerarReferenciasPrompt(
  tema: string,
  area: string,
  tipoTrabalho: TipoTrabalho,
  formato: FormatoCitacao
): string {
  return `Sugira 10 referências bibliográficas relevantes para um ${tipoTrabalho} sobre "${tema}" na área de ${area}.

IMPORTANTE: Não invente referências reais. Crie exemplos ilustrativos com [PLACEHOLDER] onde os dados reais deveriam ser verificados.

Formato de saída: JSON com array de referências:
[
  {
    "tipo": "artigo" | "livro" | "site" | "tese" | "anais",
    "titulo": "string",
    "autores": [{"nome": "string", "sobrenome": "string"}],
    "ano": number,
    "journal": "string ou null",
    "volume": "string ou null",
    "numero": "string ou null",
    "paginas": "string ou null",
    "doi": "string ou null",
    "editora": "string ou null",
    "cidade": "string ou null",
    "referencia_formatada_${formato}": "string formatada em ${formato.toUpperCase()}"
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
    .map(([k, v]) => `### ${k}\n${v.substring(0, 800)}…`)
    .join('\n\n')

  return `Com base nas seções abaixo do trabalho, redija um resumo acadêmico completo.

O resumo deve:
- Ter entre 150 e 500 palavras (norma ABNT NBR 14724)
- Incluir: contexto/introdução, objetivos, metodologia, resultados esperados/encontrados, conclusão
- Não conter citações
- Ser redigido em um único parágrafo
- Terminar com 3-5 palavras-chave

**Seções do trabalho:**
${secoesTxt}

Escreva apenas o resumo e as palavras-chave, sem título nem metacomentários.`
}
