// ============================================================
// CIENTÍFICA AI — "Me ajude a escrever" (assistente do ponto do autor)
// ============================================================
// Usuário inexperiente não sabe o que pôr no campo. A IA gera um RASCUNHO de partida,
// simples, em 1ª pessoa, ancorado no que o trabalho já traz — que o autor só adapta.
// REGRA: onde o ponto exige um DADO REAL que só o autor tem (números, N, datas, nº do
// CEP), NUNCA inventa — deixa um espaço [preencha: ...] para ele completar. Mais um
// exemplo curto do que um bom preenchimento contém. Assim ninguém fica diante do nada.

export interface AjudarPontoParams {
  titulo: string
  oQueEscrever: string
  porQue: string
  campo: string
  tema: string
  corpo: string   // trecho do trabalho, para ancorar o rascunho
}

export const AJUDAR_PONTO_SYS = `Você ajuda um autor INEXPERIENTE a preencher um campo do trabalho que SÓ ele pode dar. Gere um RASCUNHO de partida — curto, em linguagem simples, em 1ª pessoa ("Meu recorte é...", "Coletei...") — que ele só precise ADAPTAR e confirmar. Ancore o rascunho no que o trabalho já traz (tema, seções). REGRA INVIOLÁVEL: onde o ponto exige um DADO REAL que só o autor tem (números, N de participantes, datas, número/parecer do CEP), NUNCA invente — deixe um espaço claro entre colchetes para ele preencher, ex.: "[preencha: nº de participantes]", "[preencha: a porcentagem que você encontrou]". Dê também um EXEMPLO curtinho do que um bom preenchimento contém. Seja gentil e concreto. Responda em português.`

export function buildAjudarPontoPrompt(p: AjudarPontoParams): string {
  return `Ponto a preencher: "${p.titulo}".
O que ele pede: ${p.oQueEscrever}
Por que importa: ${p.porQue}

Tema do trabalho: "${p.tema}".
Trecho do trabalho (para ancorar; NÃO copie, use como contexto):
${p.corpo.slice(0, 6000)}

Gere um rascunho de partida para o autor adaptar (sem inventar dado real — use [preencha: ...]) e um exemplo curto.
Retorne APENAS JSON válido:
{"rascunho":"<texto de partida, 2-5 frases, com [preencha: ...] onde precisar de dado real>","exemplo":"<uma frase de exemplo do que um bom preenchimento contém>"}`
}
