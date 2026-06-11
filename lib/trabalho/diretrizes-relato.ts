// ============================================================
// CIENTÍFICA AI — Diretrizes de relato (EQUATOR) por NATUREZA do trabalho
// ============================================================
// Trabalhos reconhecidos como de excelência seguem a diretriz de relato do seu tipo —
// é o que um revisor de periódico ou uma banca de distinção confere. Aqui a diretriz
// CERTA é escolhida pela natureza/desenho, com um checklist curado (itens essenciais,
// em linguagem acessível). O verificador (rota) confere o trabalho item a item; a IA
// GUIA o autor no que falta (sem o deixar perdido).

import type { DadosProjeto } from '@/types'
import type { NaturezaTrabalho } from '@/lib/trabalho/pontos-autor'

export interface ItemDiretriz {
  id: string
  rotulo: string
  /** O que o item exige — explicado de forma simples, para quem não é da área. */
  exige: string
}

export interface Diretriz {
  sigla: string
  nome: string
  itens: ItemDiretriz[]
}

const PRISMA: Diretriz = {
  sigla: 'PRISMA', nome: 'Revisão sistemática (PRISMA 2020)',
  itens: [
    { id: 'pergunta', rotulo: 'Pergunta estruturada', exige: 'A pergunta no formato PICO (população, intervenção, comparação, desfecho).' },
    { id: 'protocolo', rotulo: 'Protocolo / registro', exige: 'Menção a protocolo e registro (ex.: PROSPERO).' },
    { id: 'elegibilidade', rotulo: 'Critérios de elegibilidade', exige: 'Critérios de inclusão e exclusão dos estudos.' },
    { id: 'fontes', rotulo: 'Fontes de informação', exige: 'As bases consultadas e a data da busca.' },
    { id: 'busca', rotulo: 'Estratégia de busca', exige: 'A estratégia de busca completa (descritores + operadores), reproduzível.' },
    { id: 'selecao', rotulo: 'Processo de seleção', exige: 'Como os estudos foram triados e selecionados.' },
    { id: 'vies', rotulo: 'Risco de viés', exige: 'A avaliação do risco de viés dos estudos incluídos.' },
    { id: 'sintese', rotulo: 'Síntese dos resultados', exige: 'A síntese (qualitativa e/ou meta-análise) dos achados.' },
    { id: 'fluxo', rotulo: 'Fluxo de seleção', exige: 'O número de estudos identificados, triados e incluídos (fluxograma PRISMA).' },
    { id: 'certeza', rotulo: 'Certeza da evidência', exige: 'A avaliação da certeza/qualidade da evidência (ex.: GRADE).' },
    { id: 'limitacoes', rotulo: 'Limitações', exige: 'As limitações da revisão.' },
  ],
}

const STROBE: Diretriz = {
  sigla: 'STROBE', nome: 'Estudo observacional (STROBE)',
  itens: [
    { id: 'desenho', rotulo: 'Desenho do estudo', exige: 'O desenho declarado (coorte, caso-controle, transversal).' },
    { id: 'cenario', rotulo: 'Cenário', exige: 'Locais, contexto e datas (período de coleta).' },
    { id: 'participantes', rotulo: 'Participantes', exige: 'Critérios de elegibilidade e como foram selecionados.' },
    { id: 'variaveis', rotulo: 'Variáveis', exige: 'Desfecho, exposições e fatores de confusão definidos.' },
    { id: 'mensuracao', rotulo: 'Fontes e mensuração', exige: 'Como os dados foram obtidos e medidos.' },
    { id: 'amostra', rotulo: 'Tamanho amostral', exige: 'O número de participantes e como foi determinado.' },
    { id: 'estatistica', rotulo: 'Métodos estatísticos', exige: 'As análises estatísticas utilizadas.' },
    { id: 'resultados', rotulo: 'Resultados principais', exige: 'Os achados principais com medidas e precisão (IC).' },
    { id: 'etica', rotulo: 'Ética', exige: 'Aprovação ética (CEP) e consentimento.' },
    { id: 'limitacoes', rotulo: 'Limitações', exige: 'As limitações do estudo (vieses, generalização).' },
  ],
}

const CONSORT: Diretriz = {
  sigla: 'CONSORT', nome: 'Ensaio clínico randomizado (CONSORT)',
  itens: [
    { id: 'desenho', rotulo: 'Desenho do ensaio', exige: 'O desenho (paralelo, cruzado) e a razão de alocação.' },
    { id: 'elegibilidade', rotulo: 'Participantes', exige: 'Critérios de elegibilidade e o cenário.' },
    { id: 'intervencoes', rotulo: 'Intervenções', exige: 'As intervenções de cada grupo, com detalhe suficiente para replicar.' },
    { id: 'desfechos', rotulo: 'Desfechos', exige: 'Os desfechos primário e secundários definidos.' },
    { id: 'amostra', rotulo: 'Tamanho amostral', exige: 'Como o tamanho da amostra foi calculado.' },
    { id: 'randomizacao', rotulo: 'Randomização', exige: 'Geração da sequência e ocultação da alocação.' },
    { id: 'cegamento', rotulo: 'Cegamento', exige: 'Quem foi cegado (participantes, avaliadores).' },
    { id: 'fluxo', rotulo: 'Fluxo de participantes', exige: 'Número randomizado, que recebeu, que foi analisado (fluxograma).' },
    { id: 'resultados', rotulo: 'Resultados', exige: 'Efeito estimado com intervalo de confiança.' },
    { id: 'registro', rotulo: 'Registro do ensaio', exige: 'Número de registro do ensaio (ex.: ReBEC/ClinicalTrials).' },
    { id: 'limitacoes', rotulo: 'Limitações', exige: 'Limitações e fontes de viés.' },
  ],
}

const CARE: Diretriz = {
  sigla: 'CARE', nome: 'Relato de caso (CARE)',
  itens: [
    { id: 'paciente', rotulo: 'Informações do paciente', exige: 'Dados desidentificados (idade, sexo, relevante) — sem identificar.' },
    { id: 'queixa', rotulo: 'Queixa principal', exige: 'O motivo principal que levou ao atendimento.' },
    { id: 'historia', rotulo: 'História e achados', exige: 'História clínica e achados do exame.' },
    { id: 'timeline', rotulo: 'Cronologia', exige: 'A linha do tempo dos eventos (datas/sequência).' },
    { id: 'diagnostico', rotulo: 'Avaliação diagnóstica', exige: 'Exames, hipóteses e o diagnóstico.' },
    { id: 'intervencao', rotulo: 'Intervenção', exige: 'O tratamento/conduta adotado.' },
    { id: 'desfecho', rotulo: 'Acompanhamento e desfecho', exige: 'A evolução e o resultado.' },
    { id: 'consentimento', rotulo: 'Consentimento', exige: 'A confirmação do consentimento informado do paciente.' },
    { id: 'licao', rotulo: 'Lição/discussão', exige: 'O que o caso ensina, à luz da literatura.' },
  ],
}

const REVISAO_NARRATIVA: Diretriz = {
  sigla: 'SANRA', nome: 'Revisão narrativa (boas práticas / SANRA)',
  itens: [
    { id: 'objetivo', rotulo: 'Objetivo e recorte', exige: 'O objetivo claro e o recorte do tema.' },
    { id: 'relevancia', rotulo: 'Relevância', exige: 'Por que o tema importa (justificativa).' },
    { id: 'selecao', rotulo: 'Seleção da literatura', exige: 'Como você escolheu as fontes (mesmo que não sistemático): bases, período, critérios.' },
    { id: 'cobertura', rotulo: 'Cobertura', exige: 'Inclui as fontes seminais e as mais recentes do tema.' },
    { id: 'sintese', rotulo: 'Síntese crítica', exige: 'Análise crítica que conecta os estudos — não só descrição em sequência.' },
    { id: 'lacunas', rotulo: 'Lacunas', exige: 'As lacunas do conhecimento que a revisão evidencia.' },
    { id: 'limitacoes', rotulo: 'Limitações', exige: 'As limitações da própria revisão.' },
  ],
}

const PROJETO: Diretriz = {
  sigla: 'PROJETO', nome: 'Projeto de pesquisa (qualificação)',
  itens: [
    { id: 'pergunta', rotulo: 'Pergunta e objetivos', exige: 'A pergunta de pesquisa e os objetivos (geral e específicos).' },
    { id: 'justificativa', rotulo: 'Justificativa / lacuna', exige: 'A lacuna real e a relevância do que se propõe.' },
    { id: 'metodo', rotulo: 'Método planejado', exige: 'Delineamento, população, amostra, instrumentos e análise PLANEJADOS.' },
    { id: 'etica', rotulo: 'Aspectos éticos', exige: 'Os aspectos éticos previstos (CEP, TCLE) quando aplicável.' },
    { id: 'viabilidade', rotulo: 'Viabilidade', exige: 'Cronograma, recursos e acesso que tornam o projeto exequível.' },
  ],
}

export const DIRETRIZ_SYS = `Você é um revisor de periódico experiente E um orientador que NÃO DEIXA O AUTOR PERDIDO. Recebe um trabalho e o checklist da diretriz de relato adequada. Para CADA item do checklist, diga se está "presente", "parcial" ou "ausente" no trabalho, e — para os parciais/ausentes — explique de forma SIMPLES (para alguém que NÃO é da área) o que falta e COMO resolver com o MENOR esforço possível:
- Se o item é algo que dá para a IA completar a partir do que já existe no trabalho, diga isso claramente ("a IA pode completar a partir de X").
- Se o item depende de informação que SÓ O AUTOR tem (um dado real, uma decisão, um número de registro/CEP), dê instruções curtas e um MODELO do que ele deve escrever — uma frase pronta para ele só adaptar. Nunca o deixe diante de "está faltando, se vire".
NÃO invente dados nem afirme que algo está presente se não está. Responda em português, com gentileza e objetividade.`

export function buildDiretrizPrompt(diretriz: Diretriz, tema: string, corpo: string, nivelExpectativa: string): string {
  const itens = diretriz.itens.map((it, i) => `${i + 1}. [${it.id}] ${it.rotulo}: ${it.exige}`).join('\n')
  return `Diretriz de relato: ${diretriz.nome}.
Tema do trabalho: "${tema}".
NÍVEL EXIGIDO (calibre o rigor a isto — não cobre de um TCC o de uma tese, nem o contrário): ${nivelExpectativa}

CHECKLIST a conferir:
${itens}

TEXTO DO TRABALHO:
${corpo}

Confira cada item do checklist no texto, com o rigor adequado ao NÍVEL acima. Retorne APENAS JSON válido:
{"itens":[{"id":"<id do item>","status":"presente|parcial|ausente","nota":"o que há ou o que falta","como_resolver":"instrução simples + modelo do que escrever (vazio se presente)","quem_resolve":"ia|autor"}]}`
}

/** Escolhe a diretriz de relato CERTA pela natureza e pelo desenho do estudo. */
export function diretrizPara(natureza: NaturezaTrabalho, tipo: string | undefined, dados?: Partial<DadosProjeto> | null): Diretriz {
  const t = (tipo ?? '').toLowerCase()
  const desenho = `${dados?.delineamento ?? ''} ${t}`.toLowerCase()
  if (natureza === 'relato') return CARE
  if (natureza === 'projeto') return PROJETO
  if (natureza === 'revisao') return t.includes('sistematica') ? PRISMA : REVISAO_NARRATIVA
  // empírico: ensaio randomizado → CONSORT; senão observacional → STROBE.
  if (/ensaio|randomiz|clinical trial|consort/.test(desenho)) return CONSORT
  return STROBE
}
