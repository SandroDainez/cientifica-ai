/**
 * Motor estatístico determinístico para tabelas científicas.
 *
 * Princípio do app: NUNCA inventar números. Valores-p calculados por um LLM são
 * pouco confiáveis (alucinações). Aqui calculamos os testes de hipótese de forma
 * determinística a partir dos dados brutos, para que a IA apenas FORMATE a tabela
 * usando os valores reais.
 *
 * Testes implementados:
 *  - Variáveis contínuas, 2 grupos: t de Welch (não assume variâncias iguais).
 *  - Variáveis categóricas 2×2: Fisher exato (ideal para amostras pequenas).
 *  - Categóricas r×c (ou 2×2 com amostra grande): qui-quadrado de Pearson.
 */

// ── Funções especiais ────────────────────────────────────────────────────────

/** ln(Γ(x)) — aproximação de Lanczos. */
function lnGamma(x: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) {
    // reflexão
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
  }
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Fração contínua para a função beta incompleta (Numerical Recipes, betacf). */
function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-12) break
  }
  return h
}

/** Função beta incompleta regularizada I_x(a,b). */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** p bicaudal da distribuição t de Student com `df` graus de liberdade. */
export function pValorT(t: number, df: number): number {
  if (!isFinite(t) || df <= 0) return NaN
  const x = df / (df + t * t)
  return betai(df / 2, 0.5, x) // já é bicaudal
}

/** Função gama incompleta regularizada inferior P(a,x) — série/fração contínua. */
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    // série
    let ap = a
    let sum = 1 / a
    let del = sum
    for (let n = 0; n < 200; n++) {
      ap += 1
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  } else {
    // fração contínua (Q) → P = 1 - Q
    const FPMIN = 1e-300
    let b = x + 1 - a
    let c = 1 / FPMIN
    let d = 1 / b
    let h = d
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a)
      b += 2
      d = an * d + b
      if (Math.abs(d) < FPMIN) d = FPMIN
      c = b + an / c
      if (Math.abs(c) < FPMIN) c = FPMIN
      d = 1 / d
      const del = d * c
      h *= del
      if (Math.abs(del - 1) < 1e-12) break
    }
    const q = Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
    return 1 - q
  }
}

/** p da distribuição qui-quadrado (cauda superior) com `df` graus de liberdade. */
export function pValorQuiQuadrado(x2: number, df: number): number {
  if (x2 <= 0) return 1
  return 1 - gammaP(df / 2, x2 / 2)
}

/** p da distribuição F (cauda superior) com df1, df2 graus de liberdade. */
export function pValorF(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1
  return betai(df2 / 2, df1 / 2, df2 / (df2 + df1 * f))
}

// ── Estatística descritiva ───────────────────────────────────────────────────

export function media(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length
}

/** Desvio-padrão amostral (n-1). */
export function desvioPadrao(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = media(xs)
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

// ── Testes de hipótese ───────────────────────────────────────────────────────

export interface ResultadoTeste {
  teste: string
  p: number
  estatistica?: number
  df?: number
}

/** t de Welch (variâncias desiguais) para 2 grupos contínuos. */
export function testeTWelch(a: number[], b: number[]): ResultadoTeste | null {
  if (a.length < 2 || b.length < 2) return null
  const ma = media(a), mb = media(b)
  const va = desvioPadrao(a) ** 2, vb = desvioPadrao(b) ** 2
  const na = a.length, nb = b.length
  const se2 = va / na + vb / nb
  if (se2 === 0) return null
  const t = (ma - mb) / Math.sqrt(se2)
  // Welch–Satterthwaite
  const df = se2 ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1))
  return { teste: 't de Welch', p: pValorT(t, df), estatistica: t, df }
}

/** Fisher exato bicaudal para tabela 2×2 [[a,b],[c,d]]. */
export function fisherExato2x2(a: number, b: number, c: number, d: number): ResultadoTeste {
  const n = a + b + c + d
  const lnFat = (k: number) => lnGamma(k + 1)
  // probabilidade hipergeométrica de uma tabela com as mesmas margens
  const lnP = (aa: number) => {
    const bb = a + b - aa
    const cc = a + c - aa
    const dd = d - (aa - a)
    if (bb < 0 || cc < 0 || dd < 0) return -Infinity
    return (
      lnFat(a + b) + lnFat(c + d) + lnFat(a + c) + lnFat(b + d) -
      lnFat(n) - lnFat(aa) - lnFat(bb) - lnFat(cc) - lnFat(dd)
    )
  }
  const pObs = lnP(a)
  const minA = Math.max(0, a - d) // a+? limites para manter margens
  const maxA = Math.min(a + b, a + c)
  let p = 0
  for (let aa = minA; aa <= maxA; aa++) {
    const lp = lnP(aa)
    if (lp <= pObs + 1e-7) p += Math.exp(lp)
  }
  return { teste: 'Fisher exato', p: Math.min(1, p) }
}

/** ANOVA de um fator para 3+ grupos contínuos. */
export function anovaUmFator(grupos: number[][]): ResultadoTeste | null {
  const validos = grupos.filter(g => g.length >= 2)
  if (validos.length < 2) return null
  const k = validos.length
  const todos = validos.flat()
  const n = todos.length
  const mediaGeral = media(todos)
  let ssEntre = 0, ssDentro = 0
  for (const g of validos) {
    const mg = media(g)
    ssEntre += g.length * (mg - mediaGeral) ** 2
    for (const x of g) ssDentro += (x - mg) ** 2
  }
  const dfEntre = k - 1
  const dfDentro = n - k
  if (dfDentro <= 0 || ssDentro === 0) return null
  const f = (ssEntre / dfEntre) / (ssDentro / dfDentro)
  return { teste: 'ANOVA (1 fator)', p: pValorF(f, dfEntre, dfDentro), estatistica: f, df: dfEntre }
}

/** Qui-quadrado de Pearson para tabela r×c (matriz de contagens). */
export function quiQuadrado(tabela: number[][]): ResultadoTeste | null {
  const r = tabela.length
  const c = tabela[0]?.length ?? 0
  if (r < 2 || c < 2) return null
  const totLinha = tabela.map(linha => linha.reduce((s, v) => s + v, 0))
  const totCol = Array.from({ length: c }, (_, j) => tabela.reduce((s, linha) => s + linha[j], 0))
  const n = totLinha.reduce((s, v) => s + v, 0)
  if (n === 0) return null
  let x2 = 0
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const esp = (totLinha[i] * totCol[j]) / n
      if (esp > 0) x2 += (tabela[i][j] - esp) ** 2 / esp
    }
  }
  const df = (r - 1) * (c - 1)
  return { teste: 'Qui-quadrado', p: pValorQuiQuadrado(x2, df), estatistica: x2, df }
}

/** Formata o valor-p no padrão científico (ABNT/biomédico). */
export function formatarP(p: number): string {
  if (!isFinite(p) || isNaN(p)) return '—'
  if (p < 0.001) return '< 0,001'
  return p.toFixed(3).replace('.', ',')
}
