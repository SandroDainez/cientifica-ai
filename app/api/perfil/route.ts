import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (error) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  return NextResponse.json({ perfil: data })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  const campos: Record<string, unknown> = {}
  const permitidos: string[] = [
    'nome', 'instituicao', 'nivel_academico', 'area_conhecimento',
    'orientador_nome', 'orientador_email', 'lattes', 'orcid',
    'nivel_experiencia', 'formato_citacao_padrao',
  ]
  for (const key of permitidos) {
    if (key in body) campos[key] = body[key] ?? null
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  return NextResponse.json({ perfil: data })
}
