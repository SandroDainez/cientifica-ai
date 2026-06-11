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

## ⭐ INTEGRIDADE CIENTÍFICA (regra séria do editor — travado por `CONTRATO integridade`)

O app é um EDITOR de excelência: não entrega número inventado nem fonte de outro
assunto. Vale para TODO tipo/área. Prevenção na GERAÇÃO + captura na REVISÃO:
- GERAÇÃO (`buildInstrucaoCitacaoReferencias`, regras 8-10): NUNCA inventar/estimar
  dado numérico — só afirmar número específico (%, taxa, n, magnitude, recorte
  regional) se constar no "Resumo da fonte"; senão, descrever QUALITATIVAMENTE.
  Fonte tem que ser do ASSUNTO (não usar câncer/projeção p/ sustentar outro tema).
  Não alegar base de dados (DATASUS) que não será apresentada. EVIDÊNCIA, NÃO ENSAIO
  (regra 11): proibida afirmação causal/promissória sem fonte ("reduz a mortalidade",
  "telemedicina pode conectar") — ancorar numa ref ou reformular como possibilidade.
- OFF-TOPIC DETERMINÍSTICO (`lib/referencias/off-topic.ts` → `detectarRefsOutroAssunto`,
  travado por `CONTRATO off-topic`): complementa o LLM. Sinaliza (acao "verificar",
  NUNCA remove sozinho) ref cujo TÍTULO é dominado por uma doença/campo (lista bilíngue
  PT/EN: câncer, diabetes, HIV, projeção demográfica, etc.) que o TEMA do trabalho não
  cobre. Conservador (só dispara se o tópico está no título e ausente do tema). A rota
  `analyze` mescla nas `referencias_suspeitas` sem duplicar. NÃO transformar em remoção
  automática (risco de falso-positivo) nem regredir.
- CURADORIA DE QUALIDADE (`lib/referencias/qualidade.ts` → `ehFonteFraca`, travado por
  `CONTRATO qualidade`): detecta fonte FRACA/não-primária (newsletter, nota de jornal,
  preprint SSRN/bioRxiv/medRxiv, item de 1 página). No auto-import (`auto-import.ts` e
  `gerar-secao`), as fracas são DEPRIORIZADAS (`.sort` por `ehFonteFraca` → vão para o fim,
  antes do corte da cota): a qualidade preenche primeiro. NÃO remove o que já existe (a
  revisão flagra as fracas existentes). NÃO regredir para hard-reject (removeria válidas).
- VERIFICAÇÃO DE SUPORTE (`lib/revisao/verificar-suporte.ts` → `verificarNumerosSemSuporte`,
  travado por `CONTRATO suporte`): por CÓDIGO, flagra PERCENTUAL citado ao lado de uma
  referência cujo RESUMO (abstract) NÃO contém aquele número → problema categoria "citacao",
  "média" (verificar), correção = confirmar na fonte ou generalizar. Conservador: só
  percentuais; só acusa se a fonte citada TEM resumo (senão não verificável → cala); casa
  citação↔ref por `acharRefPorCitacao`. A rota `analyze` mescla nos `problemas_encontrados`.
  É o ponto #1 de confiabilidade (número atribuído a fonte que não o sustenta). NÃO regredir.
- REVISÃO (`REVIEW_SYSTEM_PROMPT`, bloco INTEGRIDADE A-E): caça (A) número sem fonte
  → "alta", correcao generaliza o número; (B) ref off-topic pelo ASSUNTO REAL (câncer
  num trabalho de sepse) → "remover"; (C) fonte fraca/não-primária (newsletter,
  congresso 1-2 pág, preprint) → "verificar"; (D) gênero metodológico incoerente
  (linguagem de sistemática em revisão narrativa); (E) base de dados alegada e não
  usada. NÃO regredir nem enfraquecer.

- NUMERAÇÃO DE SUBSEÇÕES (`lib/formatacao/subsecoes.ts` → `renumerarSubsecoes`, travado
  por `CONTRATO subseções`): o modelo numera subseções a partir de 1 em cada seção
  ("1.1" no Desenvolvimento). No RENDER/EXPORT (docx, docx-periodico, visualizar) o
  prefixo é corrigido pelo número da seção pai (i+1): "1.1"→"4.1". Só toca linha que
  começa com d.d[.d] + espaço + MAIÚSCULA (não confunde com "2.5 vezes"). NÃO regredir.

- ANTIPLÁGIO / ORIGINALIDADE (PRONTO mas DESLIGADO — `lib/integridade/antiplagio.ts` +
  `app/api/integridade/antiplagio`, travado por `CONTRATO antiplágio`): fiação completa,
  provider-agnóstica, LIGA só com env (`ANTIPLAGIO_ENABLED=true` + `ANTIPLAGIO_API_URL` +
  `ANTIPLAGIO_API_KEY`). Sem isso → `disponivel:false` gracioso (nada quebra) e o botão
  "Verificar originalidade" no painel de revisão fica OCULTO (aparece sozinho quando
  ligado). Ao escolher o provedor real (Turnitin/Copyleaks/…), ajustar só `chamarProvedor`
  ao formato da API dele. Documentado em `.env.example`. NÃO ligar por padrão.

## Citações: AMPLITUDE + ancoragem (vale para TODO tipo de trabalho)

Regras travadas por teste (`CONTRATO citações`/`CONTRATO geração`). Aplicam-se a
QUALQUER tipo de trabalho — a lógica é type-agnostic e centralizada:

- ESQUELETO ANCORADO ANTES DA PROSA (`buildGerarSecaoPrompt`, travado por `CONTRATO
  geração`): a geração PLANEJA internamente os subtópicos da seção + as referências que
  ancoram cada um, e SÓ ENTÃO escreve a prosa em cima — como um orientador. Entrega só a
  prosa (não imprime o plano). Mata o texto ensaístico na origem. NÃO remover.
- COERÊNCIA NA CRIAÇÃO (`lib/trabalho/coerencia.ts` → `analisarCoerenciaTituloTipo`,
  travado por `CONTRATO coerência criação`): a criação avisa quando o TÍTULO contradiz o
  TIPO e sugere o tipo certo (desenho original × revisão × relato). Orienta, não bloqueia
  à força (abordagem do professor). NÃO transformar em hard-block.
- ORDEM DE REDAÇÃO (`/api/ia/gerar-resumo`): o RESUMO é por ÚLTIMO — se o corpo está
  vazio/raso (< 800 chars), a geração recusa e orienta a escrever o corpo antes (senão o
  resumo sairia inventado). NÃO remover essa guarda.
- NORMA E GÊNERO — CONSCIENTE DO FORMATO (`buildGerarSecaoPrompt`, travado por `CONTRATO
  norma/gênero`): as regras MUDAM conforme `formato_citacao` (NÃO impor ABNT a todos):
  • VOZ: ABNT = impessoalidade (nunca 1ª pessoa); APA 7 = 1ª pessoa PERMITIDA; Vancouver
    = voz ativa, 1ª pessoa aceitável. • CITAÇÃO DIRETA: ABNT (>3 linhas recuo 4cm, p. X) /
    APA (≥40 palavras bloco, p. X) / Vancouver (aspas + [n]). • TABELAS: ABNT "Fonte:" /
    APA "Note." / Vancouver numerada. • Resumo (`buildGerarResumoPrompt`): tamanho/norma
    por formato (ABNT 150–500 / APA ≤250 / Vancouver ~250–300). Regras de GÊNERO por seção
    (introdução não antecipa resultado; conclusão sem citação/tema novo; discussão compara
    + limitações) são format-agnósticas. NÃO regredir para "tudo ABNT".
- CAPA/TÍTULO E SUMÁRIO POR FORMATO (DOCX): ABNT = capa + FOLHA DE ROSTO (natureza do
  trabalho, só tipos acadêmicos); APA 7 = title page na ordem correta (título no terço
  superior → autor → afiliação → curso → Instructor → data); Vancouver = title page
  simples. SUMÁRIO: no export PADRÃO (documento completo) para trabalhos com seções; no
  export para PERIÓDICO (`docx-periodico`) NÃO há sumário (revista não usa índice). NÃO regredir.
- PONTOS DO AUTOR — ADAPTADO POR NATUREZA (`lib/trabalho/pontos-autor.ts` →
  `naturezaTrabalho` + `prontidaoAutor(tipo, dados)`, travado por `CONTRATO pontos do
  autor`; UI `PontosDoAutor.tsx` no editor): os pontos que SÓ o autor pode dar, DIFERENTES
  por natureza (NÃO generalista): REVISÃO = recorte/contribuição crítica (não exige dados
  primários); EMPÍRICO = contexto + método + DADOS + interpretação; RELATO = relevância +
  o caso/consentimento + lições; PROJETO = lacuna + viabilidade (sem resultados). Cada
  ponto tem "o que escrever" + "por que a banca cobra"; ALERTAS visíveis de obrigatoriedade.
  NÍVEL ACADÊMICO (`nivelAcademico(tipo)`): a EXIGÊNCIA escala com o nível — TCC/graduação
  (não exige contribuição inédita) < especialização < mestrado < doutorado/tese (exige
  contribuição ORIGINAL). Usado para calibrar o Ensaio para a Banca e a Diretriz de Relato
  (rigor proporcional ao nível). NÃO cobrar de um TCC o de uma tese, nem o contrário.
  Salva nos campos de DadosProjeto que JÁ alimentam a geração (a IA integra, sem inventar). NÃO
  regredir nem afrouxar a obrigatoriedade. Botão "Integrar ao trabalho" (`POST
  /api/ia/integrar-ponto`): salva a nota E tece na seção-alvo (`secaoAlvo`), sem inventar
  (posProcessar + anti-colapso + backup). NA EXPORTAÇÃO: `exportar/page.tsx` calcula
  `prontidaoAutor` e o `ExportarClient` AVISA (não bloqueia) os pontos obrigatórios
  pendentes, exigindo um "ciente, exportar mesmo assim" antes de baixar.
- DIRETRIZ DE RELATO / EXCELÊNCIA (`lib/trabalho/diretrizes-relato.ts` → `diretrizPara`
  + `buildDiretrizPrompt`/`DIRETRIZ_SYS`; `POST /api/ia/diretriz-relato`; UI
  `components/banca/DiretrizRelato.tsx` na exportação; travado por `CONTRATO diretriz`):
  escolhe a diretriz EQUATOR CERTA pela natureza/desenho (REVISÃO sistemática=PRISMA /
  narrativa=SANRA; EMPÍRICO randomizado=CONSORT / observacional=STROBE; RELATO=CARE;
  PROJETO=checklist de qualificação) e confere o trabalho item a item. PRINCÍPIO: a IA
  ASSISTE o autor — para cada item ausente/parcial dá "como resolver" em linguagem simples
  + MODELO do que escrever + marca quem_resolve (ia|autor); NUNCA o deixa perdido nem
  inventa dado. NÃO regredir para checklist mudo nem generalista.
- ENSAIO PARA A BANCA (`lib/ai/ensaio-banca.ts` + `POST /api/ia/ensaio-banca`, travado
  por `CONTRATO ensaio banca`; UI `components/banca/EnsaioBanca.tsx` na exportação): a IA
  age como presidente de banca + orientador — gera as perguntas da defesa ancoradas no
  trabalho e, para CADA uma, dá "o que a banca quer" + um ESBOÇO de resposta (não deixa o
  autor sozinho) + a LACUNA honesta quando o trabalho não deixa algo claro (sem inventar).
  ADEQUADO À NATUREZA (`DOMINIOS` por natureza): revisão não pergunta sobre dados primários;
  projeto não pergunta sobre resultados; relato foca caso/ética; profundidade ajustada ao
  tipo. O autor treina a resposta com as próprias palavras. NÃO regredir para "só perguntar"
  nem para perguntas generalistas.
- ESQUELETO APROVÁVEL (Fase 2 do método-professor, travado por `CONTRATO esqueleto`):
  `buildOutlineSecaoPrompt` + rota `POST /api/ia/gerar-outline` devolvem o PLANO da seção
  em JSON (subtópicos + refs que ancoram cada um) para o usuário aprovar/editar ANTES da
  prosa (best-effort salvo em `secoes_trabalho.metadados.outline` via UPDATE — nunca toca
  conteudo). Quando `gerar-secao` recebe `outlineAprovado`, `buildGerarSecaoPrompt` injeta
  "ESQUELETO APROVADO PELO USUÁRIO — OBRIGATÓRIO seguir". Falta a UI de aprovação (fatia 2).
- ÂNCORA TEMPORAL (`buildGerarSecaoPrompt`, travado por `CONTRATO geração`): o prompt
  de geração injeta a DATA ATUAL (mês/ano). O modelo gerador tende a escrever datas
  perto do treinamento dele (ex.: "busca conduzida em março de 2024") mesmo num
  trabalho feito hoje → inconsistência temporal. A regra força a data da busca e o
  recorte de anos a TERMINAREM no ano corrente. Exceção: se houver PERÍODO REAL do
  estudo (dados_projeto), usar o real. NÃO remover essa injeção.

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
  `CONTRATO apontamentos`): trava DETERMINÍSTICA que descarta DOIS falsos-positivos
  recorrentes, aplicada em `normalizarResultado` (toda renderização da revisão):
  (1) FORMATAÇÃO da LISTA DE REFERÊNCIAS — o NEGRITO do título do periódico é destaque
  OBRIGATÓRIO da norma (ABNT/Vancouver), não é "negrito desnecessário"; a lista é
  gerada pelo app, o usuário não edita. (2) DATA ATUAL marcada como "inconsistência
  temporal" (`ehFalsoPositivoDataAtual`) — o trabalho citar a data atual da busca/estudo
  (ex.: "busca em junho de 2026" estando em 2026) é CORRETO; o revisor às vezes reclama
  "mas estamos em 2026". A trava só dispara quando o trecho cita o ano atual e nenhum
  ano futuro E o problema diz "estamos em <ano atual>" — NÃO suprime mismatch real entre
  seções nem data futura. NÃO regredir. (Reforço no prompt: regra "DATA DA PRÓPRIA PESQUISA".)
  (3) TRECHO INEXISTENTE (`trechoExisteNoTexto`): apontamento cujo `trecho` NÃO aparece
  (casamento tolerante) no texto analisado é DESCARTADO — o revisor citou errado/alucinou,
  e o corretor nunca acharia para corrigir (é a raiz do "acha e não corrige"). Por isso
  `normalizarResultado(data, textoAnalisado)` recebe o texto. Trechos < 15 chars não são
  validados (evita descarte indevido). Só vale quando o texto é passado. NÃO regredir.
  (4) PREFERÊNCIA DE ESTILO (`ehPreferenciaEstilo`): a calibração PROÍBE apontar "frase
  muito longa/dividir em frases" e troca de palavra por gosto ("uso impreciso/termo mais
  adequado/soaria melhor"); o modelo às vezes desobedece. A trava ENFORÇA a regra: descarta
  esses (categoria linguagem) — mas NUNCA erro real (repetição, redundância, concordância,
  gramática, ortografia, pontuação, acentuação continuam). NÃO regredir.
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
NÃO permitir que a coerência edite metodologia/resultados/título/objetivos.

ALINHAMENTO DO RESUMO (REGRA DO APP, universal — travado por `CONTRATO resumo`): a
coerência também ALINHA o resumo/abstract ao CORPO (`reviewService.alinharResumoAoCorpo`
+ `lib/resumo/alinhar.ts`), corrigindo promessas/comparações/fontes que o corpo não
sustenta (ex.: abstract cita países/bases que o trabalho não usa). O resumo é JSON: o
passo PRESERVA palavras-chave/keywords, faz BACKUP em `secao_versoes`, e só grava se
passar nas travas DETERMINÍSTICAS `alinhamentoResumoSeguro` (sem número fabricado fora
do corpo, sem colapso >50% nem inflação >2x). O corpo é a VERDADE; o resumo descreve o
corpo, nunca o contrário. NÃO inventar dados. Vale p/ TODO tipo de trabalho. Esta é a
ÚNICA via que pode reescrever o JSON do resumo — fora dela, `resumo` continua intocável.
- `app/api/ia/salvar-secao` → `lib/resumo/proteger.ts` (`protegerConteudoResumo`):
  a seção `resumo` é JSON — texto puro NUNCA a sobrescreve; save parcial não zera
  abstract/keywords. Qualquer rota que escreva em `secoes_trabalho` deve pular
  `chave_secao === 'resumo'` (ou conteúdo começando com `{`).

## REGRA DE OURO: rode os testes antes de cada deploy

`npm run check`  (= `npm test` + `npm run build`)

`lib/__regressao__/melhorias.test.ts` trava cada melhoria. Se quebrar, o teste
falha. NUNCA delete testes — só adicione um novo ao corrigir/implementar algo.
Não faça deploy com testes vermelhos.
