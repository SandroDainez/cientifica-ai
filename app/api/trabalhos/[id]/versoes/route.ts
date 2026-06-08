import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const chaveSecao = searchParams.get('chave')
  if (!chaveSecao) return NextResponse.json({ error: 'chave obrigatória' }, { status: 400 })

  // Valida ownership
  const { data: trabalho } = await supabase
    .from('trabalhos').select('id')
    .eq('id', id).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('secao_versoes')
    .select('id, status, palavras, created_at, conteudo')
    .eq('trabalho_id', id)
    .eq('chave_secao', chaveSecao)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: 'Erro ao buscar versões' }, { status: 500 })
  return NextResponse.json({ versoes: data ?? [] })
}
