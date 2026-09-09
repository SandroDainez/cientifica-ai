import type { EthicsRoute, RegulatoryContext, StudyDesign } from './types'

export interface EthicsDecision {
  routes: EthicsRoute[]
  blockers: string[]
  notes: string[]
}

export function routeEthics(context: RegulatoryContext, design: StudyDesign): EthicsDecision {
  const routes = new Set<EthicsRoute>()
  const blockers: string[] = []
  const notes: string[] = []

  if (context.involvesHumans) {
    const publicAnonymous = context.humanDataSource === 'base_publica_anonimizada'
    if (publicAnonymous) {
      notes.push('Dados públicos anonimizados: não assumir submissão ao CEP automaticamente; confirmar norma institucional e natureza da base.')
    } else {
      routes.add('cep_conep_plataforma_brasil')
    }

    if (design === 'relato_caso' || design === 'serie_casos') {
      routes.add('consentimento_publicacao_caso')
    }
  }

  if (context.involvesAnimals || design === 'experimental_animal') {
    routes.add('ceua_concea')
  }

  if (context.clinicalTrial || design === 'ensaio_clinico_randomizado' || design === 'ensaio_clinico_nao_randomizado') {
    routes.add('registro_ensaio_clinico')
    if (!context.involvesHumans) {
      blockers.push('Ensaio clínico foi selecionado, mas o contexto não está marcado como envolvendo seres humanos.')
    }
  }

  if (!context.involvesHumans && !context.involvesAnimals && routes.size === 0) {
    routes.add('sem_fluxo_etico_especifico')
  }

  if (context.involvesHumans && context.involvesAnimals) {
    notes.push('Projeto misto humano-animal: manter trilhas regulatórias separadas; aprovação em uma não substitui a outra.')
  }

  if (context.involvesHumans && context.humanDataSource === 'nenhum') {
    blockers.push('Projeto marcado como envolvendo seres humanos sem fonte/tipo de dado humano definido.')
  }

  return { routes: [...routes], blockers, notes }
}
