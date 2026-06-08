<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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

## REGRA DE OURO: rode os testes antes de cada deploy

`npm run check`  (= `npm test` + `npm run build`)

`lib/__regressao__/melhorias.test.ts` trava cada melhoria. Se quebrar, o teste
falha. NUNCA delete testes — só adicione um novo ao corrigir/implementar algo.
Não faça deploy com testes vermelhos.
