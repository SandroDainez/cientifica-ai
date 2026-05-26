import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatarReferencia } from '@/lib/referencias/formatar'
import type { Referencia } from '@/types'

// GET — lista referências de um trabalho
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const trabalhoId = searchParams.get('trabalhoId')
  if (!trabalhoId) return NextResponse.json({ error: 'trabalhoId obrigatório' }, { status: 400 })

  // Valida que o trabalho pertence ao usuário
  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('referencias')
    .select('*')
    .eq('trabalho_id', trabalhoId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Erro ao buscar referências' }, { status: 500 })
  return NextResponse.json({ referencias: data ?? [] })
}

// POST — cria referência
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { trabalhoId, ...campos } = body

  // Valida ownership e pega formato padrão
  const { data: trabalho } = await supabase
    .from('trabalhos').select('id, formato_citacao').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Gera textos pré-formatados
  const refParcial = { ...campos, id: '', trabalho_id: trabalhoId, dados_extras: {}, confiabilidade: 'alta', created_at: '' } as Referencia

  const insercao = {
    ...campos,
    trabalho_id: trabalhoId,
    fonte_tipo: 'manual',
    confiabilidade: 'alta',
    referencia_formatada_abnt: formatarReferencia(refParcial, 'abnt'),
    referencia_formatada_vancouver: formatarReferencia(refParcial, 'vancouver'),
    referencia_formatada_apa: formatarReferencia(refParcial, 'apa'),
    dados_extras: {},
  }

  const { data, error } = await supabase.from('referencias').insert(insercao).select().single()
  if (error) return NextResponse.json({ error: 'Erro ao criar referência' }, { status: 500 })
  return NextResponse.json({ referencia: data })
}
