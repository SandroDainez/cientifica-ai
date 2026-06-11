/**
 * Guarda de coerência entre o TÍTULO/tema e o TIPO de trabalho escolhido.
 *
 * Erro comum (e que derruba a nota): escolher "Artigo de Revisão" mas dar um
 * título de pesquisa original ("...estudo ecológico"), ou o contrário. Aqui
 * detectamos o desenho declarado no título e avisamos quando ele conflita com o
 * tipo, sugerindo o tipo correto — guiando o usuário para a boa escolha.
 */

export type TipoSugerido =
  | 'artigo_original' | 'artigo_revisao' | 'revisao_sistematica'
  | 'relato_caso' | 'tcc' | 'dissertacao_mestrado' | 'tese_doutorado'
  | 'monografia' | 'projeto_pesquisa' | 'relatorio_ic'

export interface CoerenciaResultado {
  ok: boolean
  aviso?: string
  sugestaoTipo?: TipoSugerido
  sugestaoLabel?: string
}

// Termos que denunciam um DESENHO DE PESQUISA ORIGINAL (dados primários/secundários próprios)
const DESENHOS_ORIGINAIS = [
  'estudo ecológico', 'estudo ecologico', 'ecológico', 'ecologico',
  'coorte', 'cohort', 'caso-controle', 'caso controle', 'case-control',
  'transversal', 'seccional', 'cross-sectional',
  'ensaio clínico', 'ensaio clinico', 'randomizado', 'randomized', 'clinical trial',
  'experimental', 'quase-experimental', 'longitudinal', 'prospectivo', 'retrospectivo',
  'série de casos', 'serie de casos', 'observacional',
]

// Termos que denunciam uma REVISÃO
const TERMOS_REVISAO_SISTEMATICA = ['revisão sistemática', 'revisao sistematica', 'metanálise', 'metanalise', 'meta-análise', 'meta-analise', 'systematic review', 'meta-analysis']
const TERMOS_REVISAO_NARRATIVA = ['revisão narrativa', 'revisao narrativa', 'revisão integrativa', 'revisao integrativa', 'revisão de literatura', 'revisao de literatura', 'revisão bibliográfica', 'revisao bibliografica', 'scoping review', 'revisão da literatura', 'revisao da literatura']
const TERMOS_RELATO = ['relato de caso', 'case report']

function contem(texto: string, termos: string[]): string | null {
  const t = texto.toLowerCase()
  for (const termo of termos) if (t.includes(termo)) return termo
  return null
}

const LABELS: Record<TipoSugerido, string> = {
  artigo_original: 'Artigo Original',
  artigo_revisao: 'Artigo de Revisão',
  revisao_sistematica: 'Revisão Sistemática',
  relato_caso: 'Relato de Caso',
  tcc: 'TCC',
  dissertacao_mestrado: 'Dissertação (Mestrado)',
  tese_doutorado: 'Tese (Doutorado)',
  monografia: 'Monografia',
  projeto_pesquisa: 'Projeto de Pesquisa',
  relatorio_ic: 'Relatório de IC',
}

/**
 * Verifica se o título é coerente com o tipo. `tema` é o texto a analisar
 * (título do trabalho ou tema/descrição).
 */
export function analisarCoerenciaTituloTipo(tema: string, tipo: string): CoerenciaResultado {
  const texto = (tema ?? '').trim()
  if (texto.length < 4) return { ok: true }

  const tiposRevisao = ['artigo_revisao', 'revisao_sistematica']
  const tiposPesquisaPrimaria = ['artigo_original']

  // 1) Tipo é revisão, mas o título declara um desenho de pesquisa original
  if (tiposRevisao.includes(tipo)) {
    const termo = contem(texto, DESENHOS_ORIGINAIS)
    if (termo) {
      return {
        ok: false,
        sugestaoTipo: 'artigo_original',
        sugestaoLabel: LABELS.artigo_original,
        aviso: `O título indica um desenho de pesquisa original ("${termo}"), que coleta/analisa dados próprios — isso é um Artigo Original, não uma revisão. Para coerência, use "Artigo Original" OU ajuste o título para refletir uma revisão (ex.: "Revisão da literatura sobre…").`,
      }
    }
  }

  // 2) Tipo é pesquisa original, mas o título declara uma revisão
  if (tiposPesquisaPrimaria.includes(tipo)) {
    const termoSist = contem(texto, TERMOS_REVISAO_SISTEMATICA)
    if (termoSist) {
      return {
        ok: false,
        sugestaoTipo: 'revisao_sistematica',
        sugestaoLabel: LABELS.revisao_sistematica,
        aviso: `O título indica uma revisão ("${termoSist}"). Para isso, use o tipo "Revisão Sistemática" — ele tem o fluxo correto (PROSPERO, PRISMA, GRADE).`,
      }
    }
    const termoNarr = contem(texto, TERMOS_REVISAO_NARRATIVA)
    if (termoNarr) {
      return {
        ok: false,
        sugestaoTipo: 'artigo_revisao',
        sugestaoLabel: LABELS.artigo_revisao,
        aviso: `O título indica uma revisão ("${termoNarr}"). Para isso, use o tipo "Artigo de Revisão" (revisão narrativa) — sem coleta de dados primários.`,
      }
    }
    const termoRelato = contem(texto, TERMOS_RELATO)
    if (termoRelato) {
      return {
        ok: false,
        sugestaoTipo: 'relato_caso',
        sugestaoLabel: LABELS.relato_caso,
        aviso: `O título indica um relato de caso ("${termoRelato}"). Use o tipo "Relato de Caso", que tem o fluxo adequado (CARE).`,
      }
    }
  }

  // 3) Tipo é Relato de Caso, mas o título declara uma REVISÃO (gêneros incompatíveis).
  if (tipo === 'relato_caso') {
    const termoRev = contem(texto, TERMOS_REVISAO_SISTEMATICA) ?? contem(texto, TERMOS_REVISAO_NARRATIVA)
    if (termoRev) {
      return {
        ok: false,
        sugestaoTipo: 'artigo_revisao',
        sugestaoLabel: LABELS.artigo_revisao,
        aviso: `O título indica uma revisão ("${termoRev}"), mas o tipo selecionado é Relato de Caso — gêneros incompatíveis. Para uma revisão, use "Artigo de Revisão" (ou "Revisão Sistemática").`,
      }
    }
  }

  return { ok: true }
}
