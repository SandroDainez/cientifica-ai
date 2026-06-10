<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ⭐ REGRA SUPREMA DA REVISÃO DE EXCELÊNCIA (vale para TODO tipo de trabalho)

Esta é uma regra PERMANENTE do app, para QUALQUER trabalho gerado aqui, de
qualquer tipo (TCC, artigo, revisão, dissertação, tese, relato, etc.). NUNCA
remover, enfraquecer ou regredir:

> **A revisão final deve revisar o trabalho INTEIRO, encontrar TUDO que está
> errado ou pode melhorar e CORRIGIR de fato — excluindo o que não serve,
> adaptando, reescrevendo, aprofundando e alinhando — até o trabalho ficar
> correto, coerente e de nível PROFISSIONAL/EXCELÊNCIA. Detectar sem corrigir é
> falha. NUNCA inventar dados, números, autores, anos ou referências.**

Pipeline obrigatório (orquestrado em "Revisão final completa", travado pelo teste
`MANIFESTO revisão de excelência` — se alguma peça sumir, o build quebra):
1. **Detectar** — `/api/review/analyze` (sabe o ANO ATUAL; classifica refs
   remover/corrigir_contexto/verificar).
2. **Remover o que não serve (determinístico)** — `/api/review/limpar-suspeitas`
   (`lib/revisao/sanear-refs.ts`): apaga refs off-topic e suas citações por código,
   inclusive em grupo; exclui da lista. NÃO depender de LLM para isso.
3. **Reescrever/adaptar/aprofundar + pesquisar o que falta** — `/api/review/revisar`
   (`buildRevisaoProfundaPrompt` + gap-filling `garantirReferenciasReais`): remove
   citação sem suporte, mantém AMPLITUDE de citações, acrescenta fontes reais.
4. **Coerência global** — `/api/review/coerencia`: alinha enquadramento aos fatos
   (metodologia/resultados nunca são alterados).
5. **Re-analisar e repetir** até a meta / parar de melhorar / teto de passadas.

Invariantes invioláveis em CADA passo: anti-fabricação (`posProcessarTextoGerado`),
preservar dados reais, AMPLITUDE de citações, BACKUP em `secao_versoes` antes de
sobrescrever, e NUNCA tocar na seção `resumo` (JSON) com texto puro.

ISOLAMENTO POR TRABALHO (travado por `ISOLAMENTO:` no teste): TODA rota de revisão
age SÓ no trabalho do dono — sempre `eq('id', trabalhoId).eq('usuario_id', user.id)`
e sub-queries por `eq('trabalho_id', trabalhoId)`. NUNCA misturar dados de trabalhos
diferentes. Não há estado mutável a nível de módulo com conteúdo de trabalho — os
singletons (`aiClient`, `reviewService._client`) guardam só a conexão da API.

DETERMINÍSTICO ANTES DO LLM (ordem fixa, igual para todo trabalho): o que dá para
resolver por CÓDIGO é feito por código e NUNCA depende do modelo —
- remover refs off-topic + citações órfãs: `/api/review/limpar-suspeitas`
  (`lib/revisao/sanear-refs.ts`);
- a bibliografia (seção `referencias`) é SEMPRE derivada da TABELA via
  `compilarSecaoReferencias` — entrada órfã na seção nunca sobrevive. Na revisão é
  recompilada com o CORPO atual (`compilarSecaoReferencias(refs, formato, corpo)`) e
  lista APENAS as refs CITADAS no texto: citação removida do corpo faz a ref SUMIR
  da lista sozinha — quebra a cascata "não citada no texto" que piorava a cada
  correção. Travado por `CONTRATO bibliografia`. NÃO regredir para listar todas.
Só o que exige julgamento (linguagem, profundidade, coerência) usa o LLM, com travas.

# Contrato de consistência (NÃO regredir as melhorias)

As melhorias de qualidade são CENTRALIZADAS em fontes únicas de verdade. Ao
mexer em geração/formatação, altere AQUI — nunca duplique a lógica em outro lugar:

- `lib/ai/pos-processar.ts` → `posProcessarTextoGerado()`: camada única aplicada a
  TODO texto gerado por IA (seções do editor, documentos do projeto, refinamentos).
  Encadeia: correção de código R/Python → conversão de LaTeX → validação de citações
  → remoção de placeholders. Toda rota que gera prosa DEVE passar por aqui.
- `lib/ai/validar-citacoes.ts`: travessões (—), vírgula decimal, citações reais,
  anti-fabricação (software), remoção de placeholder `(SOBRENOME, ANO)`.
- `lib/ai/utils.ts`: `corrigirCodigoR`, `corrigirCodigoPython`.
- `lib/formatacao/latex.ts`: LaTeX matemático → Unicode legível.
- `lib/formatacao/documento-html.ts`: markdown → HTML de impressão (ABNT).
- `lib/referencias/qualidade.ts`: rejeita ref sem autor real / não-original.
- `lib/referencias/citadas.ts`: remove da lista refs não citadas no corpo.

## Citações: AMPLITUDE + ancoragem (vale para TODO tipo de trabalho)

Regras travadas por teste (`CONTRATO citações`/`CONTRATO geração`). Aplicam-se a
QUALQUER tipo de trabalho — a lógica é type-agnostic e centralizada:

- `lib/ai/prompts.ts` → `buildInstrucaoCitacaoReferencias()`: instrução ÚNICA de
  citação, usada PELAS DUAS rotas de geração (`gerar-secao` e
  `gerar-documento-projeto`). Exige AMPLITUDE (citar MUITAS fontes reais
  distintas — a lista de Referências mostra só o que é citado; citar pouco deixa
  o trabalho com poucas refs) E ancoragem (ancore no "Resumo da fonte" quando
  houver, sem contradizê-lo). Citar uma ref REAL da lista pelo tema é correto;
  PROIBIDO é INVENTAR fora da lista. NÃO reintroduzir "proibido citar pelo
  título" — isso colapsou as citações (trabalho saiu com 4 refs).
- `lib/referencias/dossie.ts` (`selecionarFontesRelevantes`, `resumirAbstract`):
  expõe o resumo (abstract, BLOCO A) das fontes relevantes no prompt. Ambas as
  rotas de geração usam `formatarRefsParaPrompt(refs, formato, idsComResumo)`.
- `lib/referencias/buscar-externo.ts` → `enriquecerAbstractsFaltantes`: backfill
  de abstracts em refs antigas (sem isso a ancoragem não pega em trabalhos velhos).

## Revisão final / correção (travas anti-piora e anti-fabricação)

Objetivo: TUDO que a revisão detecta de errado deve ser corrigido. A revisão
ACHA (analyze) e a Revisão Profunda CORRIGE (reescreve). Regras travadas por
teste (`CONTRATO revisão*`):

- `lib/revisao/filtrar-apontamentos.ts` (`filtrarApontamentos`, travado por
  `CONTRATO apontamentos`): trava DETERMINÍSTICA que descarta falso-positivo de
  formatação da LISTA DE REFERÊNCIAS — o NEGRITO do título do periódico é destaque
  OBRIGATÓRIO da norma (ABNT/Vancouver), NÃO é "negrito desnecessário". A lista é
  gerada pelo app; o usuário não a edita. Aplicado em `normalizarResultado` (toda
  renderização da revisão). NÃO regredir.
- `lib/ai/reviewService.ts` → `callReview` (analyze): roda a `temperature: 0`. A
  NOTA e os apontamentos têm de ser REPRODUTÍVEIS — o MESMO texto não pode dar 85
  numa execução e 78 noutra (isso fazia o usuário "corrigir" de novo achando que
  regrediu, quando o trabalho estava idêntico). NÃO subir a temperatura da análise.
- `lib/ai/reviewPrompt.ts` (`REVIEW_SYSTEM_PROMPT` + `buildReviewUserPrompt`):
  • Injeta o ANO ATUAL — só é "data futura" ano POSTERIOR ao atual; não
    falso-flagar publicações recentes (ano corrente/anteriores). NUNCA remover.
  • `acao_recomendada`: "remover" = fonte de OUTRO assunto que não pertence ao
    tema (ex.: suicídio/aneurisma num trabalho de sepse); "corrigir_contexto" =
    fonte pertinente citada no ponto errado; "verificar" = dúvida real (não pelo ano).
- `lib/ai/reviewService.ts` → `buildRevisaoProfundaPrompt` (PURO, travado):
  reescreve a seção — anti-fabricação, PRESERVA dados reais, AMPLITUDE de
  citações (não reduzir o nº), REMOVE decisivamente citação que a fonte não
  sustenta, e ELIMINA as refs da lista `remover` (todas as citações, inclusive
  em grupo "(A; B, 2022; C, 2023)", reescrevendo a frase). NÃO regredir essas regras.
- `app/api/review/revisar`: gap-filling (`garantirReferenciasReais`, meta 48/
  limiar 40) + backfill; cada seção passa por `posProcessarTextoGerado` +
  `revisaoProfundaSegura` (não esvazia <40% / não incha >3x) + anti-colapso de
  citações (não perde >40%). FAZ BACKUP em `secao_versoes` antes de sobrescrever.
  Pula resumo/título/objetivos/refs. O componente envia `problemas` + `remover`
  (suspeitas com ação "remover") em TODA passada.
- `components/review/AdvancedReview.tsx`: "Revisão final completa" orquestra
  analyze → revisar (gap-fill+reescreve+elimina) → re-analyze, em loop até a
  meta/parar de melhorar/3 passadas, e FECHA com a coerência global. Mostra delta.
  Vale p/ QUALQUER tipo de trabalho.

## Saneamento DETERMINÍSTICO de refs off-topic — REGRA DO APP

`app/api/review/limpar-suspeitas` + `lib/revisao/sanear-refs.ts` (travado por teste).
Quando a revisão marca uma ref como `remover` (off-topic), ela é eliminada POR
CÓDIGO — não depende do modelo: `acharRefPorCitacao` casa a citação textual com a
ref real (sobrenome+ano); `removerEntradaDeCitacoes` apaga as citações do corpo
INCLUSIVE dentro de grupos "(A; B, 2022; C, 2023)" (split por ';' que segue um ano),
limpa pontuação, faz backup e exclui a ref da lista. Roda como passo 0 da "Revisão
final completa" e como botão "Remover N ref(s) que não servem". TODOS os formatos:
ABNT/APA via `removerEntradaDeCitacoes`; Vancouver via `renumerarVancouverRemovendo`
(remove `[k]` e renumera os maiores → consistente com a bibliografia recompilada da
tabela). NÃO regredir para remoção dependente de LLM nem reintroduzir "pula Vancouver".

## Coerência global (cross-seção) — REGRA DO APP

`app/api/review/coerencia` + `buildCoerenciaGlobalPrompt` + `lib/revisao/coerencia.ts`
(travado por `CONTRATO coerência`). Alinha objetivos↔método↔resultados↔conclusão,
contradições de números/datas, promessas não cumpridas. SEGURANÇA INVIOLÁVEL:
metodologia/resultados/dados são a VERDADE e NUNCA são editados — só as seções de
ENQUADRAMENTO (`ehSecaoEnquadramento`: introdução/justificativa/discussão/conclusão/
revisão) são ajustadas para casar com os fatos. Edições cirúrgicas com
`edicaoSeguraCirurgica` + `reescritaSegura` + `posProcessarTextoGerado` + BACKUP em
`secao_versoes`. Roda no fim da "Revisão final completa" e como botão "Coerência global".
NÃO permitir que a coerência edite metodologia/resultados/título/resumo/objetivos.
- `app/api/ia/salvar-secao` → `lib/resumo/proteger.ts` (`protegerConteudoResumo`):
  a seção `resumo` é JSON — texto puro NUNCA a sobrescreve; save parcial não zera
  abstract/keywords. Qualquer rota que escreva em `secoes_trabalho` deve pular
  `chave_secao === 'resumo'` (ou conteúdo começando com `{`).

## REGRA DE OURO: rode os testes antes de cada deploy

`npm run check`  (= `npm test` + `npm run build`)

`lib/__regressao__/melhorias.test.ts` trava cada melhoria. Se quebrar, o teste
falha. NUNCA delete testes — só adicione um novo ao corrigir/implementar algo.
Não faça deploy com testes vermelhos.
