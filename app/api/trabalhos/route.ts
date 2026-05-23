import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import type { TipoTrabalho, FormatoCitacao, NivelExperiencia } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const {
    tipo_trabalho,
    titulo,
    area_conhecimento,
    formato_citacao,
    instituicao_destino,
    tem_orientador,
    orientador,
    nivel_experiencia,
  } = body as {
    tipo_trabalho: TipoTrabalho
    titulo?: string
    area_conhecimento?: string
    formato_citacao: FormatoCitacao
    instituicao_destino?: string
    tem_orientador: boolean
    orientador?: string
    nivel_experiencia: NivelExperiencia
  }

  const fluxo = getFluxo(tipo_trabalho)
  const primeiraFase = fluxo?.fases[0]?.chave_secao ?? 'tema'

  const { data, error } = await supabase
    .from('trabalhos')
    .insert({
      usuario_id: user.id,
      tipo_trabalho,
      titulo: titulo || null,
      area_conhecimento: area_conhecimento || null,
      formato_citacao,
      instituicao_destino: instituicao_destino || null,
      tem_orientador,
      orientador: tem_orientador ? orientador : null,
      nivel_experiencia,
      status: 'em_andamento',
      fase_atual: primeiraFase,
      fases_concluidas: [],
      dados_trabalho: {},
      metadados: {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar trabalho:', error)
    return NextResponse.json({ error: 'Erro ao criar trabalho' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
