// ============================================================
// CIENTÍFICA AI — Roteiro do Orientador (conduz o autor inexperiente, por tipo)
// ============================================================
// O app deixa de ser "ferramenta sob demanda" e passa a CONDUZIR: monta, em ordem, a
// lista do que o trabalho ESPECÍFICO precisa — o que a IA faz, o que é a parte do autor,
// o que já está pronto. Determinístico e TYPE-AWARE (um TCC bibliográfico não mostra
// CEP/TCLE; uma revisão sistemática mostra protocolo/PROSPERO; um empírico mostra
// cálculo amostral). Objetivo: o iniciante nunca fica perdido sobre o próximo passo.

import type { DadosProjeto } from '@/types'
import { naturezaTrabalho } from '@/lib/trabalho/pontos-autor'
import { diretrizPara } from '@/lib/trabalho/diretrizes-relato'

export type QuemResolve = 'ia' | 'autor' | 'misto'
export type StatusPasso = 'feito' | 'pendente' | 'opcional'

export interface PassoRoteiro {
  id: string
  titulo: string
  oQueE: string          // o que é, em linguagem simples
  comoFazer: string      // como fazer / o que a IA faz / qual a sua parte
  quemResolve: QuemResolve
  status: StatusPasso
  acao?: string          // dica para a UI (rota/recurso): editor | pontos-autor | revisao | diretriz | ensaio | exportar | doc:<tipo>
}

export interface RoteiroParams {
  tipo: string | undefined
  dados?: Partial<DadosProjeto> | null
  refsCount: number
  secoesComConteudo: number
  totalSecoesCorpo: number
  documentosGerados?: string[]   // chaves de documentos já gerados (gerar-documento-projeto)
  pontosAutorPendentes: number   // obrigatórios do autor ainda faltando (prontidaoAutor)
}

/**
 * Monta o roteiro do trabalho — só os passos que ESTE tipo/natureza exige, em ordem,
 * com status e quem resolve. Determinístico.
 */
export function roteiroOrientador(p: RoteiroParams): PassoRoteiro[] {
  const d = p.dados ?? {}
  const natureza = naturezaTrabalho(p.tipo, d)
  const docs = new Set(p.documentosGerados ?? [])
  const empirico = natureza === 'empirico' || natureza === 'relato'
  const humanos = !!d.envolve_seres_humanos || !!d.precisa_cep
  const sistematica = (p.tipo ?? '').toLowerCase().includes('sistematica')
  const passos: PassoRoteiro[] = []
  const docStatus = (k: string): StatusPasso => (docs.has(k) ? 'feito' : 'pendente')

  // 1) Projeto — a base de tudo.
  passos.push({
    id: 'projeto', titulo: 'Definir o projeto (tema, pergunta, objetivo, método)',
    oQueE: 'A base do trabalho: o que você investiga, por quê e como.',
    comoFazer: 'A IA monta o plano a partir da sua ideia; você confirma e ajusta.',
    quemResolve: 'misto', acao: 'projeto',
    status: (d.confirmado || (d.pergunta_pesquisa ?? '').trim() || (d.objetivo_geral ?? '').trim()) ? 'feito' : 'pendente',
  })

  // 2) Referências reais.
  passos.push({
    id: 'referencias', titulo: 'Reunir referências reais',
    oQueE: 'As fontes verdadeiras que sustentam o trabalho.',
    comoFazer: 'A IA busca e importa referências reais (PubMed/CrossRef) e descarta fonte fraca. Você não precisa saber pesquisar.',
    quemResolve: 'ia', acao: 'referencias',
    status: p.refsCount >= 8 ? 'feito' : 'pendente',
  })

  // 3) Ética — só quando há seres humanos / coleta primária.
  if (humanos) {
    passos.push({ id: 'tcle', titulo: 'TCLE (consentimento informado)', oQueE: 'O termo que cada participante assina concordando em participar.', comoFazer: 'A IA gera o TCLE pronto a partir do seu projeto.', quemResolve: 'ia', acao: 'doc:tcle', status: docStatus('tcle') })
    if (d.precisa_carta_anuencia) passos.push({ id: 'anuencia', titulo: 'Carta de anuência', oQueE: 'A autorização da instituição onde a pesquisa será feita.', comoFazer: 'A IA gera a carta; você colhe a assinatura da instituição.', quemResolve: 'misto', acao: 'doc:carta_anuencia', status: docStatus('carta_anuencia') })
    passos.push({ id: 'cep_doc', titulo: 'Protocolo para o Comitê de Ética (CEP)', oQueE: 'O documento submetido ao CEP/Plataforma Brasil para aprovar a pesquisa.', comoFazer: 'A IA monta o protocolo; você submete na Plataforma Brasil.', quemResolve: 'misto', acao: 'doc:protocolo_cep', status: docStatus('protocolo_cep') })
    passos.push({ id: 'cep_aprov', titulo: 'Aprovação do CEP (sua parte)', oQueE: 'O parecer de aprovação do comitê — obrigatório para coletar dados.', comoFazer: 'Submeta o protocolo e aguarde o parecer. Sem isto você NÃO pode coletar dados. Depois, registre o número/data no painel Pontos do Autor.', quemResolve: 'autor', acao: 'pontos-autor', status: 'pendente' })
  }

  // 4) Revisão sistemática — protocolo + estratégia de busca.
  if (sistematica) {
    passos.push({ id: 'protocolo', titulo: 'Protocolo e registro (PROSPERO)', oQueE: 'O plano da revisão registrado antes de começar — exigência de excelência.', comoFazer: 'A IA ajuda a montar o protocolo; você registra no PROSPERO.', quemResolve: 'misto', acao: 'doc:protocolo_cep', status: 'pendente' })
    passos.push({ id: 'busca', titulo: 'Estratégia de busca (PICO/descritores)', oQueE: 'As bases, descritores e operadores que tornam sua busca reproduzível.', comoFazer: 'A IA monta a estratégia; você confere e registra as bases e a data.', quemResolve: 'misto', acao: 'pontos-autor', status: 'pendente' })
  }

  // 5) Empírico — cálculo amostral + instrumento.
  if (empirico && natureza === 'empirico') {
    passos.push({ id: 'amostra', titulo: 'Cálculo amostral', oQueE: 'Quantos participantes seu estudo precisa para ter validade.', comoFazer: 'A IA gera o cálculo a partir do seu delineamento; confira com seu orientador.', quemResolve: 'ia', acao: 'doc:calculo_amostral', status: docStatus('calculo_amostral') })
    passos.push({ id: 'instrumento', titulo: 'Instrumento de coleta', oQueE: 'O questionário/ficha que você usa para coletar os dados.', comoFazer: 'A IA gera o instrumento; você aplica na coleta.', quemResolve: 'ia', acao: 'doc:instrumento_coleta', status: docStatus('instrumento_coleta') })
  }

  // 6) Escrever as seções.
  passos.push({
    id: 'secoes', titulo: 'Escrever as seções',
    oQueE: 'O corpo do trabalho (introdução, método, desenvolvimento, conclusão…).',
    comoFazer: 'A IA escreve cada seção (com esqueleto aprovável e citações reais). Você revisa e edita.',
    quemResolve: 'ia', acao: 'editor',
    status: p.totalSecoesCorpo > 0 && p.secoesComConteudo >= p.totalSecoesCorpo ? 'feito' : 'pendente',
  })

  // 7) Pontos do Autor — a substância que só você tem.
  passos.push({
    id: 'pontos', titulo: 'Completar a sua parte (Pontos do Autor)',
    oQueE: 'O que só você pode dar: dados reais, método real, sua contribuição, interpretação.',
    comoFazer: 'A IA te diz exatamente o que escrever em cada ponto e integra ao texto, sem inventar.',
    quemResolve: 'autor', acao: 'pontos-autor',
    status: p.pontosAutorPendentes === 0 ? 'feito' : 'pendente',
  })

  // 8) Revisão final.
  passos.push({
    id: 'revisao', titulo: 'Revisão final (corrige o que está mal feito)',
    oQueE: 'A IA confere tudo e corrige erros — integridade, coerência e linguagem.',
    comoFazer: 'Rode a "Revisão final completa". A IA aponta e corrige; mostra antes/depois.',
    quemResolve: 'ia', acao: 'revisao', status: 'pendente',
  })

  // 9) Padrão de excelência — diretriz de relato (type-aware).
  passos.push({
    id: 'diretriz', titulo: `Conferir o padrão de excelência (${diretrizPara(natureza, p.tipo, d).sigla})`,
    oQueE: 'A diretriz de relato que trabalhos reconhecidos seguem, conferida item a item.',
    comoFazer: 'A IA confere e, no que falta, te diz como resolver — com modelo pronto.',
    quemResolve: 'misto', acao: 'diretriz', status: 'pendente',
  })

  // 10) Ensaio para a banca (defesa).
  passos.push({
    id: 'ensaio', titulo: 'Ensaiar a banca',
    oQueE: 'As perguntas que a banca fará, com o que ela quer e um esboço de resposta.',
    comoFazer: 'A IA simula a defesa e te prepara, ponto a ponto. Você treina a resposta.',
    quemResolve: 'misto', acao: 'ensaio', status: 'opcional',
  })

  // 11) Exportar.
  passos.push({
    id: 'exportar', titulo: 'Exportar (Word/PDF) na norma',
    oQueE: 'O arquivo final formatado na norma certa (ABNT/APA/Vancouver).',
    comoFazer: 'A IA formata; você baixa. O app avisa se faltou algo obrigatório seu.',
    quemResolve: 'ia', acao: 'exportar', status: 'pendente',
  })

  return passos
}
