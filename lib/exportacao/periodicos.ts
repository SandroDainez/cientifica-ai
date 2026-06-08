/**
 * Mapa de periódicos científicos brasileiros e internacionais
 * com suas normas específicas de formatação.
 */

export interface NormasPeriodico {
  id: string
  nome: string
  abreviacao?: string
  area: string
  issn?: string
  formatoCitacao: 'abnt' | 'vancouver' | 'apa'
  limitesPalavras: {
    resumo?: number
    abstract?: number
    textoTotal?: number
    introducao?: number
    discussao?: number
  }
  estruturaObrigatoria: string[]   // chaves de seção obrigatórias
  estruturaProibida: string[]      // chaves que NÃO devem aparecer
  instrucoes: string               // instrução adicional para o autor
  urlInstrucoes?: string
}

export const PERIODICOS: NormasPeriodico[] = [
  {
    id: 'csp',
    nome: 'Cadernos de Saúde Pública',
    abreviacao: 'CSP',
    area: 'Saúde Pública',
    issn: '0102-311X',
    formatoCitacao: 'vancouver',
    limitesPalavras: {
      resumo: 150,
      abstract: 150,
      textoTotal: 6000,
    },
    estruturaObrigatoria: ['introducao', 'metodologia', 'resultados', 'discussao', 'conclusao', 'resumo'],
    estruturaProibida: [],
    instrucoes: 'Máximo 6.000 palavras, excluindo resumos e referências. Até 5 autores. Máximo 40 referências.',
    urlInstrucoes: 'https://www.scielo.br/journal/csp/about/#instructions',
  },
  {
    id: 'rba',
    nome: 'Revista Brasileira de Anestesiologia',
    abreviacao: 'RBA',
    area: 'Anestesiologia',
    issn: '0034-7094',
    formatoCitacao: 'vancouver',
    limitesPalavras: {
      resumo: 250,
      abstract: 250,
      textoTotal: 4000,
    },
    estruturaObrigatoria: ['introducao', 'metodologia', 'resultados', 'discussao', 'conclusao', 'resumo'],
    estruturaProibida: [],
    instrucoes: 'Artigos originais: máximo 4.000 palavras, 30 referências, 6 figuras/tabelas. Relatos de caso: máximo 1.500 palavras, 15 referências.',
    urlInstrucoes: 'https://www.sbahq.org/revista/',
  },
  {
    id: 'jped',
    nome: 'Jornal de Pediatria',
    abreviacao: 'JPED',
    area: 'Pediatria',
    issn: '0021-7557',
    formatoCitacao: 'vancouver',
    limitesPalavras: {
      resumo: 250,
      textoTotal: 3500,
    },
    estruturaObrigatoria: ['introducao', 'metodologia', 'resultados', 'discussao', 'resumo'],
    estruturaProibida: [],
    instrucoes: 'Máximo 3.500 palavras. Resumo estruturado com objetivo, métodos, resultados e conclusões.',
    urlInstrucoes: 'https://www.jped.com.br/instrucoes',
  },
  {
    id: 'rbep',
    nome: 'Revista Brasileira de Epidemiologia',
    area: 'Epidemiologia',
    issn: '1415-790X',
    formatoCitacao: 'vancouver',
    limitesPalavras: {
      resumo: 200,
      textoTotal: 5000,
    },
    estruturaObrigatoria: ['introducao', 'metodologia', 'resultados', 'discussao', 'conclusao', 'resumo'],
    estruturaProibida: [],
    instrucoes: 'Máximo 5.000 palavras, 40 referências. Resumo em português e inglês.',
  },
  {
    id: 'lancet',
    nome: 'The Lancet',
    area: 'Medicina Geral',
    issn: '0140-6736',
    formatoCitacao: 'vancouver',
    limitesPalavras: {
      resumo: 150,
      textoTotal: 3000,
    },
    estruturaObrigatoria: ['introducao', 'metodologia', 'resultados', 'discussao', 'resumo'],
    estruturaProibida: [],
    instrucoes: 'Articles: 3000 words, 50 references. Structured summary 150 words.',
    urlInstrucoes: 'https://www.thelancet.com/pb/assets/raw/Lancet/authors/lancet-information-for-authors.pdf',
  },
  {
    id: 'nejm',
    nome: 'New England Journal of Medicine',
    abreviacao: 'NEJM',
    area: 'Medicina Geral',
    issn: '0028-4793',
    formatoCitacao: 'vancouver',
    limitesPalavras: {
      resumo: 150,
      abstract: 150,
      textoTotal: 2700,
    },
    estruturaObrigatoria: ['introducao', 'metodologia', 'resultados', 'discussao', 'resumo'],
    estruturaProibida: [],
    instrucoes: 'Original articles: 2700 words, 70 references, structured abstract 150 words.',
    urlInstrucoes: 'https://www.nejm.org/author-center/new-manuscripts',
  },
  {
    id: 'abnt_generica',
    nome: 'ABNT Genérica (TCC/Monografia/Dissertação)',
    area: 'Qualquer',
    formatoCitacao: 'abnt',
    limitesPalavras: {},
    estruturaObrigatoria: [],
    estruturaProibida: [],
    instrucoes: 'Normas ABNT NBR 14724:2011. Sem limite de palavras definido pela norma.',
  },
]

export function getPeriodicoPorId(id: string): NormasPeriodico | undefined {
  return PERIODICOS.find(p => p.id === id)
}

export function getPeriodicosPorArea(area: string): NormasPeriodico[] {
  if (!area) return PERIODICOS
  return PERIODICOS.filter(p =>
    p.area.toLowerCase().includes(area.toLowerCase()) ||
    area.toLowerCase().includes(p.area.toLowerCase()) ||
    p.area === 'Qualquer'
  )
}
