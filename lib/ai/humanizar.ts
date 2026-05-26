/**
 * Humanização de texto — segunda passagem dedicada a quebrar padrões estatísticos de IA.
 *
 * Detectores como GPTZero medem dois índices diretamente no texto:
 *   • Perplexidade  — imprevisibilidade de cada token dado o contexto anterior
 *   • Burstiness    — variância no comprimento de frases
 *
 * Instruções no prompt de geração não resolvem: o modelo ainda produz o texto
 * na sua distribuição padrão. A única solução confiável é uma segunda chamada
 * que aplica transformações estruturais sobre o rascunho gerado.
 */

export const HUMANIZADOR_SYSTEM = `Você é um especialista em reescrita de textos acadêmicos em português brasileiro. Recebe rascunhos gerados por IA e os reescreve para que soem genuinamente humanos, mantendo 100% do conteúdo técnico e da estrutura de seções.

Você conhece profundamente como detectores de IA funcionam e aplica as transformações corretas para reduzir os scores de perplexidade e burstiness.`

export function buildHumanizadorPrompt(rascunho: string): string {
  return `Reescreva o texto acadêmico abaixo para que passe nos detectores de IA (GPTZero, Turnitin, Originality.ai) com score abaixo de 30%, mantendo 100% do conteúdo técnico.

TRANSFORMAÇÕES OBRIGATÓRIAS — aplique TODAS, sem exceção:

━━ 1. BURSTINESS (variância de comprimento) ━━
Localize qualquer sequência de 3+ frases com comprimento similar (entre 12 e 25 palavras cada).
Para cada sequência encontrada: reescreva 1 delas como frase curtíssima de 3-7 palavras.
Meta: o texto deve ter frases de 3, 8, 30, 5, 22, 40 e 6 palavras misturadas — não 15, 17, 16, 18.
Exemplo de correção: "Os dados foram coletados entre janeiro e março. A análise seguiu protocolo pré-definido. Os resultados indicaram diferença significativa." → "Os dados foram coletados entre janeiro e março. A análise seguiu protocolo pré-definido. Diferença significativa detectada."

━━ 2. INCERTEZA GENUÍNA ━━
Insira estas expressões em pelo menos 4 lugares distintos (não todos juntos):
- "na maioria dos casos" (sem vírgula após)
- "(pelo menos no contexto deste estudo)"
- "isso pode variar conforme o desenho específico"
- "em geral" ou "tipicamente" no meio de frase
- "a depender do contexto institucional"
- "embora isso dependa de"

━━ 3. CONECTIVOS — ELIMINE OS MARCADORES DE IA ━━
Substitua TODAS as ocorrências abaixo quando aparecem no INÍCIO de frases:
❌ "Além disso," → remova ou use "Outro ponto relevante:" ou comece a frase diretamente
❌ "Outrossim" → remova
❌ "Destarte" → remova
❌ "Nesse sentido," → remova ou reescreva
❌ "Sendo assim," → use "Por isso," ou remova
❌ "É importante ressaltar que" → comece diretamente com o conteúdo
❌ "Cabe destacar que" → comece diretamente com o conteúdo
❌ "Diante do exposto," → remova
❌ "No que tange" → use "Sobre" ou "Quanto a"
❌ "Em suma," → "Em síntese:" ou nada

━━ 4. CONVERSÃO PARCIAL DE LISTAS ━━
Pegue 2-3 itens de lista/bullets e converta-os em prosa incorporada ao parágrafo:
"X, Y e Z são considerados essenciais — este último especialmente quando [condição específica]."
Deixe as outras listas como estão.

━━ 5. PARENTÉTICOS PRÁTICOS ━━
Adicione 3-4 inserções parentéticas com detalhes concretos:
"(o que na prática corresponde a cerca de [X] dias de coleta)"
"(exceto quando o N for inferior a 30)"
"(isso é especialmente verdadeiro em contexto hospitalar terciário)"
"(ver seção X para detalhes)"

━━ 6. PERGUNTA RETÓRICA ━━
Insira 1 pergunta genuína em alguma seção introdutória ou de discussão/conclusão.
Exemplo: "Por que isso importa para este estudo específico?" ou "O que fazer quando os dados violam essa premissa?"

━━ 7. VARIAÇÃO LEXICAL ━━
Em cada parágrafo, substitua pelo menos 1 verbo/substantivo previsível:
"realizar" → "conduzir" / "executar" / "levar a cabo"
"apresentar" → "revelar" / "exibir" / "mostrar"
"verificar" → "constatar" / "atestar" / "checar"
"analisar" → "examinar" / "debruçar-se sobre" / "investigar"
"observar" → "notar" / "perceber" / "identificar"

━━ PRESERVAR ABSOLUTAMENTE ━━
✓ Todos os dados numéricos, fórmulas e cálculos
✓ Código de software (blocos de código não são alterados)
✓ Referências ABNT e citações
✓ Campos entre [COLCHETES] (são placeholders para o pesquisador)
✓ Estrutura de seções e títulos numerados
✓ Termos técnicos e jargão específico da área
✓ Formatação em markdown (**, ##, listas restantes)

ENTREGUE APENAS o texto reescrito. Sem comentários, sem explicações, sem cabeçalhos adicionais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RASCUNHO:
${rascunho}`
}
