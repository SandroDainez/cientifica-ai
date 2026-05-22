import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { ExportarClient } from './ExportarClient'
import { Paywall } from '@/components/pagamento/Paywall'
import type { Trabalho, SecaoTrabalho } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ExportarPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tData }, { data: sData }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('nome_secao, chave_secao, status, conteudo').eq('trabalho_id', id).order('ordem'),
  ])

  if (!tData) redirect('/trabalhos')

  const trabalho = tData as Trabalho

  // Paywall: trabalho não liberado → mostra tela de pagamento
  if (!trabalho.liberado) {
    return <Paywall trabalhoId={trabalho.id} tituloTrabalho={trabalho.titulo} />
  }

  const secoes = (sData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'status' | 'conteudo'>[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  const totalFases = fluxo?.fases.length ?? 1
  const secoesComConteudo = secoes.filter(s => !!s.conteudo?.trim()).length

  return (
    <ExportarClient
      trabalho={trabalho}
      totalFases={totalFases}
      secoesComConteudo={secoesComConteudo}
    />
  )
}
