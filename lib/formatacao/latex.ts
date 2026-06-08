// ============================================================
// CIENTÍFICA AI — Conversão de LaTeX matemático → texto legível
// ============================================================
// A IA às vezes gera fórmulas em LaTeX (\[ \frac{...}{...} \], \(Z_{\alpha/2}\),
// \times, ^2…). Sem renderizador de math, isso aparece como código cru no
// documento. Aqui convertemos para Unicode legível (×, frações, α, expoentes),
// que funciona em qualquer saída (tela, impressão, DOCX) sem dependências.
//
// IMPORTANTE: NÃO converte dentro de blocos de código ``` (onde "\n", "\\." etc.
// são código de verdade e não devem ser tocados).

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶',
  '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ',
}
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆',
  '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
}

const SIMBOLOS: [RegExp, string][] = [
  [/\\times/g, '×'], [/\\cdot/g, '·'], [/\\div/g, '÷'], [/\\ast/g, '∗'],
  [/\\pm/g, '±'], [/\\mp/g, '∓'],
  [/\\leq/g, '≤'], [/\\geq/g, '≥'], [/\\neq/g, '≠'], [/\\ll/g, '≪'], [/\\gg/g, '≫'],
  [/\\approx/g, '≈'], [/\\equiv/g, '≡'], [/\\propto/g, '∝'],
  [/\\infty/g, '∞'], [/\\sum/g, 'Σ'], [/\\prod/g, '∏'], [/\\int/g, '∫'],
  [/\\partial/g, '∂'], [/\\nabla/g, '∇'], [/\\in\b/g, '∈'], [/\\notin/g, '∉'],
  [/\\alpha/g, 'α'], [/\\beta/g, 'β'], [/\\gamma/g, 'γ'], [/\\delta/g, 'δ'],
  [/\\epsilon/g, 'ε'], [/\\varepsilon/g, 'ε'], [/\\zeta/g, 'ζ'], [/\\eta/g, 'η'],
  [/\\theta/g, 'θ'], [/\\iota/g, 'ι'], [/\\kappa/g, 'κ'], [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'], [/\\nu/g, 'ν'], [/\\xi/g, 'ξ'], [/\\pi/g, 'π'], [/\\rho/g, 'ρ'],
  [/\\sigma/g, 'σ'], [/\\tau/g, 'τ'], [/\\upsilon/g, 'υ'], [/\\phi/g, 'φ'],
  [/\\varphi/g, 'φ'], [/\\chi/g, 'χ'], [/\\psi/g, 'ψ'], [/\\omega/g, 'ω'],
  [/\\Gamma/g, 'Γ'], [/\\Delta/g, 'Δ'], [/\\Theta/g, 'Θ'], [/\\Lambda/g, 'Λ'],
  [/\\Sigma/g, 'Σ'], [/\\Phi/g, 'Φ'], [/\\Psi/g, 'Ψ'], [/\\Omega/g, 'Ω'],
  [/\\bar\s*\{([^{}]*)\}/g, '$1̄'],
  [/\\hat\s*\{([^{}]*)\}/g, '$1̂'],
]

function aplicarIndice(grupo: string, mapa: Record<string, string>, prefixo: string): string {
  // Se todos os caracteres têm equivalente Unicode (dígitos/sinais), usa-os.
  if ([...grupo].every(c => mapa[c] !== undefined)) {
    return [...grupo].map(c => mapa[c]).join('')
  }
  // Caso contrário (ex.: "α/2"), mantém legível entre parênteses.
  return `${prefixo}(${grupo})`
}

function converterTrecho(t: string): string {
  if (!t.includes('\\') && !/[_^{}]/.test(t)) return t

  // 1. Símbolos e letras gregas
  for (const [rx, ch] of SIMBOLOS) t = t.replace(rx, ch)

  // 2. \left( \right) → ( )
  t = t.replace(/\\left\s*/g, '').replace(/\\right\s*/g, '')

  // 3. \sqrt{x} → √(x)
  t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')

  // 4. Sobrescritos/subscritos (depois das gregas; repete p/ aninhamento simples)
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\^\s*\{([^{}]*)\}/g, (_m, g: string) => aplicarIndice(g, SUP, '^'))
    t = t.replace(/_\s*\{([^{}]*)\}/g, (_m, g: string) => aplicarIndice(g, SUB, '_'))
  }
  // Bare (sem chaves): SÓ dígitos isolados — não captura "(" para não comer os
  // parênteses que nós mesmos inserimos em _(...) / ^(...).
  t = t.replace(/\^([0-9n])(?![0-9])/g, (_m, c: string) => SUP[c] ?? `^${c}`)
  t = t.replace(/_([0-9])(?![0-9])/g, (_m, c: string) => SUB[c] ?? `_${c}`)

  // 5. \frac{A}{B} → (A) / (B)  (repete p/ aninhamento)
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1) / ($2)')
  }

  // 6. Espaçamentos LaTeX e delimitadores de math
  t = t.replace(/\\[,;:!> ]/g, ' ').replace(/\\quad/g, '  ')
  t = t.replace(/\\[()\[\]]/g, '')         // \( \) \[ \]
  t = t.replace(/\$\$?/g, '')              // $ ... $

  // 7. Comandos restantes desconhecidos e chaves soltas
  t = t.replace(/\\[a-zA-Z]+\b/g, '').replace(/[{}]/g, '')

  // 8. Limpeza de espaços
  t = t.replace(/[ \t]{2,}/g, ' ')
  return t
}

/**
 * Converte LaTeX matemático em texto Unicode legível, preservando blocos de
 * código cercados por ``` (onde barras invertidas são código real).
 */
export function converterMathLatexParaTexto(texto: string): string {
  if (!texto) return texto
  // Divide protegendo blocos ``` (índices ímpares = código, não converter).
  const partes = texto.split(/(```[\s\S]*?```)/g)
  return partes.map((p, i) => (i % 2 === 1 ? p : converterTrecho(p))).join('')
}
