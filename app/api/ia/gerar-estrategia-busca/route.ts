import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText } from '@/lib/ai/stream'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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

  return streamText(systemPrompt, userPrompt, false)
}
