import type { ResearchProjectState } from './types'

export function buildEvidenceClaimsPrompt(state: ResearchProjectState, title?: string, area?: string) {
  const system = `Você é um metodologista científico. Sua tarefa NÃO é escrever texto acadêmico, nem concluir nada por memória.
Você deve apenas propor afirmações científicas que PRECISARIAM ser verificadas na literatura antes de aparecerem em introdução/discussão.

REGRAS:
- Não invente números, prevalências, efeitos, OR/RR/HR, datas ou resultados específicos.
- Não diga que uma afirmação é verdadeira. Gere claims candidatos a serem auditados.
- Priorize claims que realmente importam para justificar a pergunta, sustentar plausibilidade biológica/metodológica e contextualizar o desfecho.
- Evite obviedades e frases vagas.
- Gere entre 6 e 12 claims.
- Cada claim deve ser atômico: uma ideia verificável por vez.
- Importance: alta para afirmações necessárias à lógica central; media para contexto; baixa apenas se acessória.
- kind deve ser um de: efeito, associacao, frequencia, diagnostico, prognostico, metodologia, definicao, outro.
- Responda APENAS JSON válido, sem markdown.`

  const user = `PROJETO
Título: ${title ?? 'não informado'}
Área: ${area ?? 'não informada'}
Finalidade: ${state.academicPurpose}
Desenho: ${state.studyDesign}
Pergunta livre: ${state.question.freeText ?? ''}
Pergunta estruturada: ${state.question.structuredQuestion ?? ''}
População: ${state.question.population ?? ''}
Intervenção/exposição: ${state.question.interventionOrExposure ?? ''}
Comparador: ${state.question.comparator ?? ''}
Desfecho primário: ${state.question.primaryOutcome ?? ''}
Hipótese: ${state.question.hypothesis ?? ''}

Retorne:
{
  "claims": [
    {"id":"C1","text":"...","importance":"alta|media|baixa","kind":"efeito|associacao|frequencia|diagnostico|prognostico|metodologia|definicao|outro"}
  ]
}`

  return { system, user }
}
