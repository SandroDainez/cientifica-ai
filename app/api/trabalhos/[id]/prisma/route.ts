import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', id).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { data } = await supabase.from('prisma_dados').select('*').eq('trabalho_id', id).single()
  return NextResponse.json(data ?? {})
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', id).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const allowed = [
    'bases_pesquisadas', 'registros_identificados', 'registros_duplicados', 'registros_triagem',
    'registros_excluidos_titulo', 'textos_completos_avaliados', 'textos_excluidos',
    'estudos_incluidos', 'criterios_inclusao', 'criterios_exclusao',
    'estrategia_busca', 'data_busca', 'motivos_exclusao',
    'pergunta_pico', 'numero_prospero',
  ]
  const dados = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { error } = await supabase
    .from('prisma_dados')
    .upsert({ ...dados, trabalho_id: id }, { onConflict: 'trabalho_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
