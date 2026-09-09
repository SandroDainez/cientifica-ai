# Research OS v2

Este módulo inicia a migração do Científica AI de um gerador orientado a documento para um sistema orientado ao **estado científico do projeto**.

## Regra arquitetural central

**Finalidade acadêmica não é desenho científico.**

TCC, especialização, mestrado e doutorado descrevem a finalidade/nível acadêmico. O desenho deve ser inferido separadamente a partir da pergunta, temporalidade, intervenção, forma de seleção, origem dos dados e objetivo analítico.

Exemplo: uma tese de doutorado pode ser um ensaio clínico, uma coorte, um estudo diagnóstico, uma revisão sistemática ou um estudo experimental animal.

## Três eixos independentes

1. `AcademicPurpose` — para que o trabalho será usado.
2. `StudyDesign` — como a pergunta científica será respondida.
3. `RegulatoryContext` — humanos, animais, origem dos dados e requisitos regulatórios.

A prosa do manuscrito é uma projeção desses estados; ela não deve ser a fonte de verdade do projeto.

## Ordem alvo do pipeline

1. Ideia livre do pesquisador.
2. Estruturação da pergunta.
3. Busca exploratória e lacuna de conhecimento.
4. Comparação de desenhos possíveis.
5. Classificação/seleção do desenho.
6. Protocolo metodológico.
7. Roteamento ético/regulatório determinístico.
8. Plano estatístico.
9. Evidence map (claim ↔ fonte ↔ suporte).
10. Coleta/análise quando aplicável.
11. Interpretação.
12. Redação.
13. Auditoria factual, metodológica e de reporting guideline.
14. Revisão linguística.

## Compatibilidade

A migração deve ser não destrutiva. `legacy-bridge.ts` converte tipos antigos para finalidade acadêmica quando possível, mas **não inventa desenho** para `tcc`, `monografia`, `dissertacao_mestrado`, `tese_doutorado` ou `projeto_pesquisa`.

## Determinístico antes do LLM

- O código determina trilhas éticas e reporting guideline quando os fatos já são conhecidos.
- O LLM pode entrevistar o usuário e extrair fatos, mas não deve substituir regras determinísticas.
- Quando faltam fatos, o estado deve permanecer `indefinido`/`pendente` e registrar `unresolvedIssues`.

## Evidence-first

A meta futura não é atingir uma quantidade fixa de referências. Cada afirmação científica relevante deve ser ligada à melhor evidência adequada e ter o suporte verificado. O objetivo é migrar de `referência real` para `afirmação realmente suportada pela fonte`.
