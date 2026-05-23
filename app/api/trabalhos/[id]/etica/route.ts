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

  const { data } = await supabase.from('comite_etica').select('*').eq('trabalho_id', id).single()
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
    'envolve_seres_humanos', 'envolve_animais', 'tipo_pesquisa', 'area_tematica', 'titulo_projeto',
    'pesquisador_responsavel', 'instituicao_proponente', 'resumo_projeto', 'objetivo_primario',
    'justificativa', 'metodologia', 'criterios_inclusao', 'criterios_exclusao',
    'tamanho_amostra', 'riscos', 'beneficios', 'termo_consentimento',
    'status_cep', 'numero_caae',
  ]
  const dados = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  const { error } = await supabase
    .from('comite_etica')
    .upsert({ ...dados, trabalho_id: id }, { onConflict: 'trabalho_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
