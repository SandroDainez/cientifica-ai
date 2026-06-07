/**
 * Lê dados brutos colados pelo usuário (CSV/TSV) e, quando há uma coluna de
 * GRUPO, calcula de forma determinística as estatísticas comparativas
 * (média ± DP + teste para contínuas; n (%) + teste para categóricas), incluindo
 * o VALOR-P real. O resultado vira um bloco de texto autoritativo injetado no
 * prompt de geração de tabela — a IA apenas formata, sem recalcular nada.
 */
import {
  media, desvioPadrao, testeTWelch, anovaUmFator, fisherExato2x2, quiQuadrado,
  formatarP, type ResultadoTeste,
} from './testes'

const RX_GRUPO = /^(grupo|grupos|group|bra[çc]o|arm|condi[çc][ãa]o|condition|trat(amento)?|treatment|categoria|classe)$/i

function detectarDelimitador(linha: string): string {
  const cands = ['\t', ';', ','] as const
  let melhor = ','
  let max = 0
  for (const d of cands) {
    const n = linha.split(d).length
    if (n > max) { max = n; melhor = d }
  }
  return melhor
}

function ehNumero(s: string, delim: string): number | null {
  let t = s.trim()
  if (!t) return null
  // decimal com vírgula só quando a vírgula NÃO é o delimitador
  if (delim !== ',') t = t.replace(',', '.')
  t = t.replace(/[^\d.\-+eE]/g, '') // remove unidades/símbolos
  if (!/\d/.test(t)) return null
  const n = Number(t)
  return isFinite(n) ? n : null
}

function fmtNum(n: number): string {
  return n.toFixed(2).replace('.', ',')          // médias e desvios: 2 casas
}
function fmtPct(n: number): string {
  return n.toFixed(1).replace('.', ',')          // percentuais: 1 casa
}

interface Coluna {
  nome: string
  valoresPorGrupo: Map<string, string[]>
}

/**
 * Retorna um bloco de texto com as estatísticas calculadas (pronto para o prompt)
 * ou `null` se os dados não puderem ser interpretados como tabela com grupos.
 */
export function compararGruposDeDados(textoBruto: string): string | null {
  if (!textoBruto?.trim()) return null

  // Limpa linhas estruturais (cabeçalhos de planilha, separadores de upload)
  const linhas = textoBruto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^\[planilha/i.test(l) && !/^---/.test(l))

  if (linhas.length < 4) return null // precisa de header + alguns registros

  // Encontra o cabeçalho: primeira linha com ≥2 campos e a maioria não-numérica
  const delim = detectarDelimitador(linhas[0])
  const header = linhas[0].split(delim).map(c => c.trim())
  if (header.length < 2) return null

  // Localiza a coluna de grupo
  let idxGrupo = header.findIndex(h => RX_GRUPO.test(h))
  if (idxGrupo === -1) {
    // fallback: primeira coluna com 2–4 valores distintos nos dados
    for (let j = 0; j < header.length; j++) {
      const distintos = new Set(linhas.slice(1).map(l => l.split(delim)[j]?.trim()).filter(Boolean))
      if (distintos.size >= 2 && distintos.size <= 4) { idxGrupo = j; break }
    }
  }
  if (idxGrupo === -1) return null

  // Monta colunas
  const colunas: Coluna[] = header.map(nome => ({ nome, valoresPorGrupo: new Map() }))
  const gruposOrdem: string[] = []
  let nRegistros = 0
  for (const linha of linhas.slice(1)) {
    const campos = linha.split(delim).map(c => c.trim())
    if (campos.length < header.length) continue
    const g = campos[idxGrupo]?.trim()
    if (!g) continue
    if (!gruposOrdem.includes(g)) gruposOrdem.push(g)
    nRegistros++
    header.forEach((_, j) => {
      if (j === idxGrupo) return
      const mapa = colunas[j].valoresPorGrupo
      if (!mapa.has(g)) mapa.set(g, [])
      mapa.get(g)!.push(campos[j] ?? '')
    })
  }

  if (gruposOrdem.length < 2 || nRegistros < 4) return null

  const nPorGrupo = new Map<string, number>()
  for (const g of gruposOrdem) {
    nPorGrupo.set(g, colunas.find((_, j) => j !== idxGrupo)?.valoresPorGrupo.get(g)?.length ?? 0)
  }

  const linhasSaida: string[] = []
  let houveTeste = false

  for (let j = 0; j < colunas.length; j++) {
    if (j === idxGrupo) continue
    const col = colunas[j]
    // numérico se a maioria dos valores (todos os grupos) parseia como número
    const todos = gruposOrdem.flatMap(g => col.valoresPorGrupo.get(g) ?? [])
    const numericos = todos.map(v => ehNumero(v, delim)).filter((n): n is number => n !== null)
    const ehNumerica = numericos.length >= todos.filter(Boolean).length * 0.8 && numericos.length >= 4

    if (ehNumerica) {
      const porGrupoNum = gruposOrdem.map(g =>
        (col.valoresPorGrupo.get(g) ?? []).map(v => ehNumero(v, delim)).filter((n): n is number => n !== null)
      )
      const desc = gruposOrdem.map((g, gi) => {
        const arr = porGrupoNum[gi]
        if (arr.length === 0) return `${g}: —`
        return `Grupo ${g} = ${fmtNum(media(arr))} ± ${fmtNum(desvioPadrao(arr))}`
      }).join('; ')
      let teste: ResultadoTeste | null = null
      if (gruposOrdem.length === 2) teste = testeTWelch(porGrupoNum[0], porGrupoNum[1])
      else teste = anovaUmFator(porGrupoNum)
      if (teste) houveTeste = true
      linhasSaida.push(
        `- ${col.nome} (contínua): ${desc}` +
        (teste ? `; valor-p = ${formatarP(teste.p)} (${teste.teste})` : '')
      )
    } else {
      // categórica: contagem por categoria × grupo
      const categorias = Array.from(new Set(todos.map(v => v.trim()).filter(Boolean)))
      if (categorias.length === 0 || categorias.length > 6) continue
      const tabela: number[][] = categorias.map(cat =>
        gruposOrdem.map(g => (col.valoresPorGrupo.get(g) ?? []).filter(v => v.trim() === cat).length)
      )
      const detalhe = categorias.map((cat, ci) => {
        const partes = gruposOrdem.map((g, gi) => {
          const n = tabela[ci][gi]
          const tot = nPorGrupo.get(g) || 1
          return `Grupo ${g} = ${n} (${fmtPct((n / tot) * 100)}%)`
        }).join('; ')
        return `    - ${cat}: ${partes}`
      })
      let teste: ResultadoTeste | null = null
      if (categorias.length === 2 && gruposOrdem.length === 2) {
        teste = fisherExato2x2(tabela[0][0], tabela[0][1], tabela[1][0], tabela[1][1])
      } else {
        teste = quiQuadrado(tabela)
      }
      if (teste) houveTeste = true
      linhasSaida.push(
        `- ${col.nome} (categórica):\n${detalhe.join('\n')}` +
        (teste ? `\n    valor-p = ${formatarP(teste.p)} (${teste.teste})` : '')
      )
    }
  }

  if (!houveTeste || linhasSaida.length === 0) return null

  const cabecalhoGrupos = gruposOrdem.map(g => `Grupo "${g}" (n=${nPorGrupo.get(g) ?? 0})`).join(' vs ')

  return [
    'ESTATÍSTICAS JÁ CALCULADAS PELO SISTEMA (valores reais e verificados).',
    'Use EXATAMENTE estes números na tabela — especialmente o VALOR-P. NÃO recalcule, NÃO troque por "—" onde há um valor-p informado, NÃO arredonde diferente.',
    `Comparação entre grupos: ${cabecalhoGrupos}.`,
    '',
    ...linhasSaida,
    '',
    'Para cada variável com valor-p, inclua o resultado na coluna "Valor-p" e cite o teste usado em nota de rodapé da tabela.',
  ].join('\n')
}
