import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { ExportarClient } from './ExportarClient'
import { Paywall } from '@/components/pagamento/Paywall'
import type { Trabalho, SecaoTrabalho, Referencia } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ExportarPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tData }, { data: sData }, { data: rData }] = await Promise.all([
    supabase.from('trabalhos').select('*').eq('id', id).eq('usuario_id', user.id).single(),
    supabase.from('secoes_trabalho').select('nome_secao, chave_secao, status, conteudo').eq('trabalho_id', id).order('ordem'),
    supabase.from('referencias').select('*').eq('trabalho_id', id).order('created_at'),
  ])

  if (!tData) redirect('/trabalhos')

  const trabalho = tData as Trabalho

  // Busca perfil do usuário para verificar acesso beta
  const { data: profile } = await supabase
    .from('profiles')
    .select('acesso_beta')
    .eq('id', user.id)
    .single()

  // Paywall: pula se o trabalho está liberado OU se usuário tem acesso beta
  if (!trabalho.liberado && !profile?.acesso_beta) {
    return <Paywall trabalhoId={trabalho.id} tituloTrabalho={trabalho.titulo} />
  }

  const secoes = (sData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'status' | 'conteudo'>[]
  const fluxo = getFluxo(trabalho.tipo_trabalho)

  const totalFases = fluxo?.fases.length ?? 1
  const secoesComConteudo = secoes.filter(s => !!s.conteudo?.trim()).length

  // Texto do trabalho para a Revisão Avançada. Exclui o "resumo" (abstract): é
  // editado à parte (editor do Resumo) e protegido — a revisão não consegue
  // corrigi-lo, então não deve apontá-lo (geraria problema "que nunca sai").
  const corpoTrabalho = secoes
    .filter(s => !!s.conteudo?.trim() && s.chave_secao !== 'resumo')
    .map(s => `${s.nome_secao}\n\n${extrairTextoSecao(s.conteudo ?? '')}`)
    .join('\n\n')

  return (
    <ExportarClient
      trabalho={trabalho}
      totalFases={totalFases}
      secoesComConteudo={secoesComConteudo}
      referencias={(rData ?? []) as Referencia[]}
      corpoTrabalho={corpoTrabalho}
    />
  )
}
