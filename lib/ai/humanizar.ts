/**
 * Scientific rewrite pass.
 *
 * Historical note: this module used to optimize text for AI-detector scores. That
 * objective is intentionally removed. The second pass now has one purpose only:
 * improve clarity and academic readability WITHOUT changing scientific meaning.
 *
 * Export names are preserved for backwards compatibility with existing routes.
 */

function unique(values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))]
}

function canonicalDirectionTerms(text: string): string[] {
  const lower = text.toLowerCase()
  const families: Array<[string, RegExp]> = [
    ['aumento', /\b(?:aument\w*|eleva\w*|increment\w*)\b/iu],
    ['reducao', /\b(?:reduz\w*|reduç\w*|diminu\w*)\b/iu],
    ['maior', /\b(?:maior|superior)\b/iu],
    ['menor', /\b(?:menor|inferior)\b/iu],
    ['associacao', /\b(?:associad\w*|associaç\w*)\b/iu],
    ['causalidade', /\b(?:caus\w*)\b/iu],
    ['predicao', /\b(?:predi\w*|prognostic\w*)\b/iu],
    ['negacao', /\b(?:não|nao|sem)\b/iu],
  ]
  return families.filter(([, pattern]) => pattern.test(lower)).map(([name]) => name)
}

export function extractProtectedScientificTokens(text: string): {
  numbers: string[]
  citations: string[]
  statistical: string[]
  directionTerms: string[]
} {
  const numbers = unique(
    [...text.matchAll(/\b\d+(?:[.,]\d+)?\s*%?/g)].map(m => m[0].replace(/\s+/g, '')),
  )

  const authorYear = [...text.matchAll(/\([^()\n]{1,100}\b(?:19|20)\d{2}[a-z]?(?:[^()\n]{0,80})\)/g)].map(m => m[0])
  const numericCitations = [...text.matchAll(/\[(?:\d+\s*(?:[-–,;]\s*\d+)*)\]/g)].map(m => m[0])
  const citations = unique([...authorYear, ...numericCitations])

  const statistical = unique(
    [...text.matchAll(/\b(?:p\s*[<=>]\s*0?[.,]\d+|IC\s*95%|CI\s*95%|RR|OR|HR|NNT|NNH|beta|β|r\s*=|R²|AUC)\b/gi)].map(m => m[0]),
  )

  // O lock compara famílias semânticas, não flexões superficiais. Assim,
  // "associada" -> "associação" é permitido, mas "associação" -> "causou" não é.
  const directionTerms = canonicalDirectionTerms(text)

  return { numbers, citations, statistical, directionTerms }
}

function protectedManifest(text: string): string {
  const p = extractProtectedScientificTokens(text)
  return [
    'ELEMENTOS PROTEGIDOS EXTRAÍDOS DO RASCUNHO:',
    `- números/percentuais: ${p.numbers.length ? p.numbers.join(' | ') : '(nenhum)'}`,
    `- citações: ${p.citations.length ? p.citations.join(' | ') : '(nenhuma)'}`,
    `- marcadores estatísticos: ${p.statistical.length ? p.statistical.join(' | ') : '(nenhum)'}`,
    `- famílias de direção/causalidade/polaridade: ${p.directionTerms.length ? p.directionTerms.join(' | ') : '(nenhuma)'}`,
  ].join('\n')
}

export const HUMANIZADOR_SYSTEM = `Você é um editor científico sênior. Sua tarefa é REVISAR linguagem e legibilidade sem alterar o conteúdo científico.

REGRAS ABSOLUTAS:
1. Não invente, remova ou modifique dados, números, percentuais, unidades, p-valores, intervalos de confiança, tamanhos amostrais ou medidas de efeito.
2. Não adicione resultados, interpretações, limitações, opiniões, hipóteses, exemplos ou fatos que não existam no rascunho.
3. Não mude associação para causalidade ou causalidade para associação.
4. Não mude direção de efeito, comparação, população, intervenção/exposição, desfecho, temporalidade ou grau de certeza.
5. Preserve todas as citações e mantenha cada citação ligada à mesma afirmação que sustentava no rascunho.
6. Não acrescente primeira pessoa, experiência da equipe ou observações pessoais se isso não existir no original.
7. Não tente otimizar o texto para detectores de IA e não mencione detectores, IA, software ou processo de geração.
8. Se uma frase estiver cientificamente ambígua, prefira conservá-la a "melhorá-la" semanticamente.
9. Você pode melhorar apenas: clareza, concisão, repetição, ordem sintática, conectivos e fluidez acadêmica.
10. Retorne SOMENTE o texto revisado.`

export function buildHumanizadorPrompt(rascunho: string): string {
  return `Faça uma revisão linguística conservadora do rascunho abaixo.

A revisão deve permanecer semanticamente equivalente ao original. Preserve aproximadamente o mesmo tamanho (variação ideal até 10%). Não acrescente conteúdo científico novo.

${protectedManifest(rascunho)}

Antes de devolver, faça uma checagem interna: cada número, citação, relação causal/associativa, direção de efeito e grau de certeza deve continuar equivalente ao rascunho.

RASCUNHO:
<<<INICIO_RASCUNHO>>>
${rascunho}
<<<FIM_RASCUNHO>>>`
}
