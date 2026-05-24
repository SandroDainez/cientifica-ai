import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjetoCriadorClient } from './ProjetoCriadorClient'
import type { Trabalho, DadosProjeto } from '@/types'

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) redirect('/trabalhos')

  const trabalho = trabalhoData as Trabalho
  const dadosProjeto = (trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto ?? null

  return (
    <ProjetoCriadorClient
      trabalho={trabalho}
      dadosProjetoInicial={dadosProjeto as DadosProjeto | null}
    />
  )
}
