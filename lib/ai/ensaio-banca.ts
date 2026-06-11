// ============================================================
// CIENTÍFICA AI — Ensaio para a Banca (prepara o autor para a defesa)
// ============================================================
// A IA age como PRESIDENTE de banca E orientador: gera as perguntas que a banca
// realmente faria ao trabalho e, para CADA uma, (a) explica o que a banca quer ver e
// (b) oferece um ESBOÇO de resposta ancorado no que o trabalho de fato traz — NÃO
// deixa o autor sozinho. Onde o trabalho não deixa algo claro (contribuição, dados),
// aponta a LACUNA com franqueza, sem inventar. Objetivo: preparar, nunca enganar.

import type { NaturezaTrabalho } from '@/lib/trabalho/pontos-autor'

export interface EnsaioBancaParams {
  tipo: string
  natureza: NaturezaTrabalho
  nivelExpectativa: string   // o que o NÍVEL acadêmico exige (TCC ≠ tese)
  tema: string
  corpo: string           // seções do trabalho (texto)
  referencias?: string    // lista curta de referências citadas (opcional)
}

// Domínios de pergunta POR NATUREZA — não generalista. Uma revisão não responde sobre
// amostra/dados primários; um projeto ainda não tem resultados.
const DOMINIOS: Record<NaturezaTrabalho, string> = {
  revisao: 'contribuição/recorte crítico; estratégia de busca e critérios de seleção; lacunas que a revisão evidencia; atualidade e qualidade das fontes; força da síntese. NÃO pergunte sobre coleta de dados primários, amostra ou estatística — é uma revisão.',
  empirico: 'contribuição original; justificativa das escolhas de método; amostra, instrumentos e ÉTICA (CEP/consentimento); o que os dados de fato sustentam; validade e limitações; coerência conclusão↔resultados.',
  relato: 'relevância do caso (por que relatá-lo); ÉTICA (consentimento, anonimização); fidelidade da descrição clínica; articulação do caso com a literatura; a lição prática. NÃO pergunte sobre amostra/estatística.',
  projeto: 'lacuna e contribuição ESPERADA; adequação e VIABILIDADE do método proposto (recursos, prazo, acesso); aspectos éticos previstos; clareza dos objetivos. NÃO pergunte sobre resultados — é uma proposta, ainda não há dados.',
}

export const ENSAIO_BANCA_SYS = `Você é, ao mesmo tempo, o PRESIDENTE de uma banca examinadora experiente e um ORIENTADOR que PREPARA o autor para a defesa. Para o trabalho dado, gere as perguntas que a banca realmente faria — diretas, do nível de uma arguição real — e, para CADA pergunta, ENTREGUE três coisas:
1. "o_que_a_banca_quer": o que o examinador está realmente sondando com essa pergunta.
2. "esboco_resposta": um esboço de resposta ANCORADO no que o trabalho de fato traz (use o conteúdo real e as referências reais). É um ponto de partida para o autor adaptar com as próprias palavras — organize a resposta para ele, não o deixe sozinho. NUNCA invente dados, contribuição ou achados que o trabalho não tem.
3. "lacuna": se o trabalho NÃO deixa claro o que a pergunta exige (ex.: a contribuição original, a justificativa do método, os dados que sustentam a conclusão), diga isso com franqueza e indique o que o autor precisa DEFINIR ou ESCLARECER antes da defesa. Se está claro no trabalho, deixe "".
Seja honesto: preparar o autor é melhor do que tranquilizá-lo. Responda em português.`

export function buildEnsaioBancaPrompt(params: EnsaioBancaParams): string {
  return `Trabalho: ${params.tipo} sobre "${params.tema}".

${params.referencias ? `Referências citadas (amostra):\n${params.referencias}\n\n` : ''}TEXTO DO TRABALHO (base das perguntas e dos esboços de resposta):
${params.corpo}

Este trabalho é da natureza "${params.natureza}" e do nível "${params.tipo}". NÍVEL EXIGIDO: ${params.nivelExpectativa}
Gere de 6 a 9 perguntas de banca ADEQUADAS a essa natureza — cobrindo: ${DOMINIOS[params.natureza]} Calibre a PROFUNDIDADE e a EXIGÊNCIA ao nível acima: um TCC não é arguido como uma tese, e uma tese DEVE ser cobrada quanto à contribuição original. NÃO faça perguntas que não cabem nesta natureza nem cobre de um nível mais alto do que o trabalho é.
Retorne APENAS JSON válido:
{"perguntas":[{"pergunta":"...","o_que_a_banca_quer":"...","esboco_resposta":"...","lacuna":"..."}]}`
}
