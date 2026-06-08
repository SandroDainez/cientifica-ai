import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText, callAI, streamStringComEfeito } from '@/lib/ai/stream'
import { removerTravessoes } from '@/lib/ai/validar-citacoes'

export const maxDuration = 300
import { checkRateLimit } from '@/lib/auth/rate-limit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-estrategia-busca')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'X-RateLimit-Reset': rl.resetAt.toISOString() } }
    )
  }

  const { pergunta_pico, bases, criterios_inclusao } =
    await request.json() as { pergunta_pico?: string; bases?: string[]; criterios_inclusao?: string }

  const systemPrompt = `Você é um especialista em pesquisa bibliográfica sistemática, com amplo conhecimento em:
- Estratégias de busca em bases de dados científicas (PubMed, EMBASE, Cochrane, LILACS, etc.)
- Descritores MeSH (Medical Subject Headings) e DeCS (Descritores em Ciências da Saúde)
- Operadores booleanos e truncamentos
- Filtros de busca metodológica`

  const userPrompt = `Elabore estratégias de busca detalhadas para uma revisão sistemática com a seguinte pergunta PICO:

${pergunta_pico ?? '[Pergunta PICO não informada]'}

**Critérios de inclusão:** ${criterios_inclusao ?? 'Não informado'}

**Bases a incluir:** ${bases?.join(', ') ?? 'PubMed, LILACS'}

Para cada base selecionada, forneça:
1. A string de busca completa com descritores MeSH/DeCS e palavras-livres
2. Os filtros a aplicar (tipo de estudo, idioma, período)
3. Observações específicas da base

Formato esperado:
---
**PubMed/MEDLINE**
\`\`\`
(descritor1[MeSH] OR "palavra livre") AND (descritor2[MeSH]) AND (filter)
\`\`\`
*Filtros:* ...
*Observações:* ...

---
**LILACS/BVS**
...

Forneça strings prontas para copiar e colar em cada base.`

  // Pós-processamento mínimo padronizado (remove travessões/protege decimais);
  // cai no streaming cru se a geração não-streaming falhar.
  try {
    const texto = await callAI(systemPrompt, userPrompt, false, 6000)
    if (texto && texto.trim().length > 20) return streamStringComEfeito(removerTravessoes(texto))
  } catch { /* fallback abaixo */ }
  return streamText(systemPrompt, userPrompt, false)
}
