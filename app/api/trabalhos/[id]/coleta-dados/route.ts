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

  const { data } = await supabase.from('coleta_dados').select('*').eq('trabalho_id', id).order('created_at')
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', id).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { nome, tipo, descricao, campos } = await request.json() as {
    nome: string; tipo: string; descricao?: string; campos?: unknown[]
  }

  const { data, error } = await supabase
    .from('coleta_dados')
    .insert({ trabalho_id: id, nome, tipo, descricao: descricao ?? '', campos: campos ?? [] })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
