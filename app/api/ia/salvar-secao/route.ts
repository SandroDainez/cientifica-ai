import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { StatusSecao } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId, chaveSecao, conteudo, status } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    conteudo: string
    status?: StatusSecao
  }

  // Valida ownership
  const { data: trabalho } = await supabase
    .from('trabalhos')
    .select('id, fases_concluidas, fase_atual')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  // Salva conteúdo da seção
  const { error: secaoError } = await supabase
    .from('secoes_trabalho')
    .update({
      conteudo,
      conteudo_ia: status === 'gerado' ? conteudo : undefined,
      conteudo_usuario: status === 'editado' ? conteudo : undefined,
      status: status ?? 'gerado',
    })
    .eq('trabalho_id', trabalhoId)
    .eq('chave_secao', chaveSecao)

  if (secaoError) {
    return NextResponse.json({ error: 'Erro ao salvar seção' }, { status: 500 })
  }

  // Marca fase como concluída se status for aprovado/gerado
  if (status === 'aprovado' || status === 'gerado') {
    const fasesConcluidas = Array.from(
      new Set([...trabalho.fases_concluidas, chaveSecao])
    )
    await supabase
      .from('trabalhos')
      .update({ fases_concluidas: fasesConcluidas })
      .eq('id', trabalhoId)
  }

  return NextResponse.json({ ok: true })
}
