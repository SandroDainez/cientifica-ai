import type { TipoTrabalho } from '@/types'

// Unused import kept for type reference; tree-shaken in production
void (null as unknown as TipoTrabalho)

interface PlanejadorOpts {
  tipoTrabalho?: string
  nomeTipo?: string
  requerCep?: boolean
  requerPrisma?: boolean
}

// Tipos de trabalho que são SEMPRE bibliográficos/documentais — nunca envolvem
// coleta de dados primária com seres humanos, logo NUNCA precisam de CEP.
const TIPOS_BIBLIOGRAFICOS = new Set(['artigo_revisao', 'revisao_sistematica'])

export function buildPlanejadorPrompt(descricao: string, opts: PlanejadorOpts = {}): { system: string; user: string } {
  const { tipoTrabalho, nomeTipo, requerCep = false, requerPrisma = false } = opts
  const ehBibliografico = tipoTrabalho ? TIPOS_BIBLIOGRAFICOS.has(tipoTrabalho) : false
  // CEP só é possível se o TIPO admite (requerCep) E não é um tipo puramente bibliográfico.
  const cepPossivel = requerCep && !ehBibliografico

  const system = `Você é um orientador acadêmico experiente especializado em pesquisa científica brasileira.
Sua tarefa é analisar a ideia de pesquisa de um estudante/pesquisador e criar um plano de projeto completo, realista e detalhado.
Você conhece profundamente as normas ABNT, o processo de submissão ao CEP/Plataforma Brasil, e os requisitos de cada tipo de trabalho acadêmico brasileiro.
Cada tipo de trabalho tem um FLUXO PRÓPRIO — você NUNCA inclui etapas que não pertencem ao tipo escolhido (ex: revisão de literatura não tem CEP, Plataforma Brasil, TCLE nem carta de anuência).
Seja direto, prático e acessível — o pesquisador pode ser iniciante.`

  const blocoTipo = tipoTrabalho
    ? `\nTIPO DE TRABALHO JÁ ESCOLHIDO PELO USUÁRIO: ${nomeTipo ?? tipoTrabalho} (use EXATAMENTE este tipo em "tipo_trabalho_sugerido").`
    : ''

  const regrasCep = !cepPossivel
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 ESTE TIPO DE TRABALHO NÃO ENVOLVE CEP / PLATAFORMA BRASIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${ehBibliografico ? 'É uma pesquisa BIBLIOGRÁFICA/DOCUMENTAL (análise de literatura já publicada). ' : 'Este tipo de trabalho não requer aprovação ética. '}Portanto, é OBRIGATÓRIO:
- "envolve_seres_humanos": false
- "precisa_cep": false
- "precisa_carta_anuencia": false
- "precisa_tcle": false
- "tipo_coleta": "${ehBibliografico ? 'bibliografica' : 'secundaria'}"
- O roadmap NÃO PODE conter NENHUMA etapa tipo="etica" nem tipo="aguardar" relacionada a CEP/Plataforma Brasil/TCLE/carta de anuência/protocolo CEP.
- O checklist NÃO PODE conter itens de categoria "etica" nem mencionar Plataforma Brasil.
- Fluxo correto: busca bibliográfica → seleção/leitura → análise/síntese → escrita → submissão.${requerPrisma ? '\n- Como é revisão sistemática: inclua etapas de protocolo PROSPERO, estratégia de busca, triagem PRISMA, extração e avaliação de viés.' : ''}`
    : `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ REGRA DE CEP — DECIDA COM RIGOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CEP/Plataforma Brasil é necessário APENAS quando a pesquisa COLETA dados primários diretamente de seres humanos (entrevistas, questionários, dados clínicos, prontuários identificáveis) ou animais.
- Se a descrição indica coleta primária com pessoas/animais → "tipo_coleta":"primaria", "envolve_seres_humanos":true, "precisa_cep":true e inclua as etapas de ética.
- Se é análise de dados públicos/secundários anonimizados, ou pesquisa bibliográfica → "envolve_seres_humanos":false, "precisa_cep":false e NÃO inclua etapas de ética.
- Defina cada flag (envolve_seres_humanos, precisa_cep, precisa_carta_anuencia, precisa_tcle) conforme a REALIDADE da descrição — NÃO copie os valores do exemplo do schema.`

  const user = `O pesquisador descreveu sua ideia assim:

"${descricao}"
${blocoTipo}

Com base nessa descrição${tipoTrabalho ? ' e no tipo de trabalho já escolhido' : ''}, analise e crie um plano completo de projeto de pesquisa.
${regrasCep}

Responda em duas partes:

PARTE 1 — ANÁLISE (texto livre, amigável, explicativo):
Escreva 3-4 parágrafos explicando:
- O que você entendeu da ideia e como ela se encaixa academicamente
- Como ela se desenvolve dentro do tipo de trabalho escolhido
${cepPossivel ? '- Se (e somente se) houver coleta primária com seres humanos: explique o processo de CEP/Plataforma Brasil' : '- NÃO mencione CEP, Plataforma Brasil, TCLE nem comitê de ética — este tipo de trabalho não passa por isso'}
- O que o pesquisador precisa providenciar ANTES de começar a escrever
- Uma estimativa realista de quanto tempo vai levar até a publicação

PARTE 2 — PLANO ESTRUTURADO:
Ao final, após a linha "===PLANO_JSON===", retorne APENAS um JSON válido com esta estrutura exata:

{
  "titulo_provisorio": "título provisório baseado na ideia",
  "tipo_trabalho_sugerido": "artigo_original|tcc|artigo_revisao|relato_caso|monografia|dissertacao_mestrado|tese_doutorado|revisao_sistematica|projeto_pesquisa|relatorio_ic",
  "pergunta_pesquisa": "pergunta de pesquisa clara e específica",
  "objetivo_geral": "objetivo geral do trabalho",
  "tipo_coleta": "primaria|secundaria|bibliografica",
  "delineamento": "tipo de delineamento (ex: observacional transversal, revisão narrativa, ECR, etc.)",
  "envolve_seres_humanos": false,
  "local_previsto": "local onde será realizada a pesquisa ou 'Não se aplica (pesquisa bibliográfica)'",
  "periodo_previsto": "período estimado de execução",
  "populacao_alvo": "descrição da população-alvo ou 'Não se aplica'",
  "amostra_estimada": "estimativa de amostra ou 'Não se aplica'",
  "instrumentos_previstos": "instrumentos/escalas/métodos de coleta ou 'Não se aplica'",
  "analise_prevista": "método de análise (software, tipo de estatística) ou 'Análise qualitativa de literatura'",
  "precisa_cep": false,
  "precisa_carta_anuencia": false,
  "precisa_tcle": false,
  "contexto_geral": "parágrafo de contexto que alimentará a introdução e justificativa",
  "justificativa_resumida": "por que este estudo é relevante — em 2-3 frases",
  "tempo_total_estimado": "ex: 4-6 meses para pesquisa bibliográfica, 12-18 meses para pesquisa com coleta primária",
  "alertas": ["alerta 1", "alerta 2"],
  "roadmap": [
    {
      "id": "r1",
      "titulo": "nome curto da etapa",
      "descricao": "o que precisa ser feito nesta etapa (2-3 frases práticas)",
      "tipo": "preparacao|etica|aguardar|coleta|analise|escrita|submissao",
      "duracao_estimada": "ex: 1-2 semanas",
      "app_executa": false,
      "obrigatoria": true,
      "bloqueante": false
    }
  ],
  "checklist": [
    {
      "id": "c1",
      "item": "nome do item",
      "descricao": "o que fazer exatamente",
      "categoria": "etica|institucional|metodologia|coleta|escrita",
      "etapa_tipo": "preparacao|etica|aguardar|coleta|analise|escrita|submissao",
      "urgencia": "alta|media|baixa",
      "link_ajuda": null,
      "concluido": false
    }
  ]
}

REGRAS para o roadmap:
- NUNCA use placeholders como {app_name}, {nome_app} ou similares — quando precisar mencionar o app, use "Científica AI"
- ATENÇÃO: tipo=preparacao é EXCLUSIVO para a primeira etapa de revisão de literatura e planejamento. NÃO use preparacao para protocolo CEP, TCLE, anuência ou qualquer etapa de ética.
- Etapas tipo=preparacao: apenas revisão bibliográfica e delineamento inicial. app_executa=true.
- Etapas tipo=etica: OBRIGATÓRIO para TODAS as etapas relacionadas a CEP, Plataforma Brasil, TCLE, protocolo de pesquisa, carta de anuência, submissão ética.
- Etapas tipo=etica que elaboram documentos (protocolo, TCLE, carta): app_executa=true
- Etapas tipo=etica que envolvem submissão ou espera presencial: app_executa=false
- Se precisa_cep=true: inclua EXATAMENTE estas etapas:
  1. "Elaborar protocolo de pesquisa" → tipo=etica, app_executa=true
  2. "Obter carta de anuência da instituição" → tipo=etica, app_executa=true
  3. "Submeter ao CEP via Plataforma Brasil" → tipo=etica, bloqueante=true, app_executa=false
  4. "Aguardar aprovação do CEP" → tipo=aguardar, duracao="30-60 dias", app_executa=false
- Etapas tipo=coleta: app_executa=false (coleta física o usuário faz)
- Etapas tipo=analise: app_executa=false (análise o usuário ou estatístico faz)
- A etapa de escrita (tipo=escrita): app_executa=true, descricao deve mencionar que o Científica AI gera com IA (nunca use {app_name} ou outros placeholders — escreva "Científica AI" diretamente)
- Etapas tipo=submissao: app_executa=false (usuário submete manualmente)
- Se tipo_coleta=primaria: inclua etapas de coleta e análise
- Se tipo_coleta=bibliografica: inclua etapas de busca bibliográfica
- Sempre inclua uma etapa de submissão ao periódico/banca como última etapa
- Gere apenas os campos listados no schema — não adicione campos extras

REGRAS para o checklist:
- OBRIGATÓRIO: cada item deve ter o campo "etapa_tipo" preenchido com a fase do roadmap à qual a tarefa pertence
- etapa_tipo deve ser um dos: preparacao, etica, aguardar, coleta, analise, escrita, submissao
- Distribua os items pelas fases reais: ex. "Elaborar TCLE" → etapa_tipo="etica", "Analisar dados" → etapa_tipo="analise", "Escrever monografia" → etapa_tipo="escrita", "Submeter ao periódico" → etapa_tipo="submissao"
- Se precisa_cep=true: items de CEP com link_ajuda="https://plataformabrasil.saude.gov.br"
- Máximo 10 items no checklist
- Inclua apenas items realmente necessários para o tipo de pesquisa`

  return { system, user }
}
