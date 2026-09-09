import type { AcademicPurpose } from './types'

export interface IntakeExtractionContext {
  description: string
  academicPurpose?: AcademicPurpose
  area?: string
}

export function buildScientificIntakeExtractionPrompt(ctx: IntakeExtractionContext): { system: string; user: string } {
  const system = `Você é um metodologista científico. Sua única tarefa nesta etapa é EXTRAIR FATOS explicitamente informados pelo usuário sobre a ideia de pesquisa.

REGRAS INVIOLÁVEIS:
- NÃO escolha o desenho do estudo.
- NÃO complete lacunas por plausibilidade clínica ou acadêmica.
- NÃO presuma que TCC, mestrado ou doutorado envolvem seres humanos.
- NÃO presuma CEP, CEUA, Plataforma Brasil, CONSORT, STROBE ou qualquer guideline.
- Quando um fato não estiver explícito, use null.
- "Prontuários antigos" pode marcar historicalDataOnly=true e involvesHumans=true, mas NÃO infira startsFromOutcome.
- "Vou sortear tratamento" pode marcar investigatorAssignsIntervention=true e randomized=true.
- "Revisão sistemática" explicitamente declarada pode marcar literatureOnly=true e systematicSearch=true.
- Retorne APENAS JSON válido, sem markdown.`

  const user = `IDEIA DO USUÁRIO:\n${ctx.description}\n\nÁREA: ${ctx.area ?? 'não informada'}\nFINALIDADE ACADÊMICA: ${ctx.academicPurpose ?? 'não informada'}\n\nRetorne exatamente estas chaves. Use true/false somente quando houver evidência textual; caso contrário null:\n{
  "literatureOnly": null,
  "systematicSearch": null,
  "metaAnalysisPlanned": null,
  "caseCount": null,
  "animalExperiment": null,
  "qualitativeData": null,
  "quantitativeData": null,
  "investigatorAssignsIntervention": null,
  "randomized": null,
  "startsFromOutcome": null,
  "followsForwardInTime": null,
  "historicalDataOnly": null,
  "singleTimePoint": null,
  "diagnosticAccuracyQuestion": null,
  "prognosticQuestion": null,
  "predictionModelQuestion": null,
  "qualityImprovement": null,
  "economicEvaluation": null,
  "involvesHumans": null,
  "involvesAnimals": null,
  "humanDataSource": null,
  "vulnerablePopulation": null,
  "multicenter": null
}`

  return { system, user }
}
