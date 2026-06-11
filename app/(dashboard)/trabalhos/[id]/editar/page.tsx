import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { fasesEfetivas, getDadosProjeto } from '@/lib/tipos/fases-efetivas'
import { ordenarSecoesParaDocumento } from '@/lib/tipos/ordem-documento'
import { EditorClient } from './EditorClient'
import type { Trabalho, SecaoTrabalho } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: trabalhoData }, { data: secoesData }, { count: refsCount }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('*').eq('trabalho_id', id).order('ordem'),
    supabase.from('referencias').select('id', { count: 'exact', head: true }).eq('trabalho_id', id),
  ])

  if (!trabalhoData) redirect('/trabalhos')

  const trabalho = trabalhoData as Trabalho
  const secoes = (secoesData ?? []) as SecaoTrabalho[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  if (!fluxo) redirect('/trabalhos')

  // Remove a etapa de Ética/CEP quando a pesquisa não envolve coleta primária
  // com seres humanos (revisão/dados secundários públicos) — coerente com o
  // roadmap do projeto, que já não mostra essas etapas.
  // Ordem coerente também no editor: Introdução → Objetivos → … → Conclusão →
  // Resumo → Referências (mesma ordem do documento exportado). Evita a Introdução
  // aparecer depois do Resumo/Abstract na lista de seções.
  const fases = ordenarSecoesParaDocumento(
    fasesEfetivas(fluxo.fases, getDadosProjeto(trabalho), trabalho.tipo_trabalho),
  )

  return (
    <EditorClient
      trabalho={trabalho}
      fases={fases}
      secoesIniciais={secoes}
      refsCount={refsCount ?? 0}
    />
  )
}
