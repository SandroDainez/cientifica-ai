import type { Referencia } from '@/types'
import type { ClaimCandidate } from './evidence-engine'

function refForPrompt(ref: Referencia): string {
  return JSON.stringify({
    id: ref.id,
    titulo: ref.titulo,
    ano: ref.ano,
    journal: ref.journal,
    doi: ref.doi,
    pmid: ref.pmid,
    abstract: ref.abstract ?? null,
  })
}

export function buildEvidenceAssessmentPrompt(claims: ClaimCandidate[], references: Referencia[]): { system: string; user: string } {
  const system = `Você atua como auditor de evidência científica. Sua função NÃO é escrever texto acadêmico e NÃO é escolher uma fonte plausível pelo título.

Você recebe claims e referências reais cadastradas no projeto. Avalie somente o conteúdo fornecido, principalmente o abstract. Nunca use memória externa para completar resultados.

REGRAS INVIOLÁVEIS:
1. Só use claimId e referenceId exatamente fornecidos.
2. Fonte real não significa suporte real. Se o abstract não sustenta o claim, marque insuficiente/parcial.
3. Nunca marque confirmado se não houver abstract ou conteúdo suficiente.
4. Para número específico (%/RR/OR/HR/média/N), ele precisa estar explicitamente presente no conteúdo fornecido; caso contrário numericSupport=nao_encontrado e o suporte não pode ser confirmado.
5. Diferencie associação de causalidade. Estudo observacional não deve sustentar sozinho linguagem causal forte.
6. Verifique compatibilidade de população, intervenção/exposição e desfecho.
7. supportingExcerpt, se usado, deve ser trecho curto e literal do abstract fornecido.
8. Não crie DOI, PMID, autores, dados, resultados ou excertos.
9. Uma referência pode sustentar zero, um ou vários claims; um claim pode exigir várias referências.
10. Retorne APENAS JSON válido, sem markdown.`

  const user = `CLAIMS:\n${claims.map(c => JSON.stringify(c)).join('\n')}\n\nREFERÊNCIAS:\n${references.map(refForPrompt).join('\n')}\n\nRetorne um array JSON de objetos com esta forma exata:\n[{\n  "claimId":"C1",\n  "referenceId":"uuid-real",\n  "supportStatus":"nao_avaliado|insuficiente|parcial|confirmado|contraditorio",\n  "directness":"direta|indireta|incerta",\n  "sourceTier":"sintese_alta|ensaio|observacional|diagnostico_prognostico|qualitativo|preclinico|diretriz|outra|incerta",\n  "populationMatch":"alta|parcial|baixa|incerta",\n  "outcomeMatch":"alta|parcial|baixa|incerta",\n  "numericSupport":"nao_aplicavel|confirmado|nao_encontrado|incerto",\n  "rationale":"justificativa curta e específica",\n  "supportingExcerpt":"trecho literal curto do abstract, somente se realmente existir"\n}]\n\nNão precisa criar ligação para uma fonte que claramente não ajuda.`

  return { system, user }
}
