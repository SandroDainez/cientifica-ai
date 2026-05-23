import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { PrismaClient } from './PrismaClient'
import type { Trabalho } from '@/types'

export default async function PrismaPage({ params }: { params: Promise<{ id: string }> }) {
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

  // PRISMA só faz sentido para tipos que requerem revisão sistemática
  const fluxo = getFluxo(trabalhoData.tipo_trabalho)
  if (!fluxo?.requer_prisma) redirect(`/trabalhos/${id}/editar`)

  const { data: prismaData } = await supabase
    .from('prisma_dados')
    .select('*')
    .eq('trabalho_id', id)
    .single()

  return <PrismaClient trabalho={trabalhoData as Trabalho} prismaInicial={prismaData} />
}
