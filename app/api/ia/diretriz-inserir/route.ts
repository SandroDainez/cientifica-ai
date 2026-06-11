// Insere (acrescenta) o texto JÁ EDITADO pelo autor — vindo do "Escrever com a IA"
// da Diretriz — na seção-alvo escolhida. Determinístico (sem 2ª chamada de IA, que
// poderia falhar): faz BACKUP da seção e acrescenta o parágrafo ao final. SERVER-ONLY.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { SecaoTrabalho } from '@/types'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-secao')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  const { trabalhoId, secaoChave, texto } = await request.json() as {
    trabalhoId?: string; secaoChave?: string; texto?: string
  }
  if (!trabalhoId || !secaoChave || !texto?.trim()) {
    return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })
  }

  const { data: trabalho } = await supabase
    .from('trabalhos').select('id').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const { data: secaoData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, status')
    .eq('trabalho_id', trabalhoId).eq('chave_secao', secaoChave).maybeSingle()
  const secao = secaoData as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo' | 'status'> | null
  if (!secao) {
    return NextResponse.json({ error: 'A seção indicada ainda não existe. Gere essa seção primeiro.' }, { status: 404 })
  }

  const atual = (secao.conteudo ?? '').trim()
  const adicao = texto.trim()
  // Evita duplicar se o autor inserir o mesmo trecho duas vezes.
  if (atual.includes(adicao)) {
    return NextResponse.json({ ok: true, jaPresente: true, secaoNome: secao.nome_secao })
  }
  const novo = atual ? `${atual}\n\n${adicao}` : adicao

  // Backup antes de alterar (restaurável no histórico do Editor) e salva.
  await supabase.from('secao_versoes').insert({
    trabalho_id: trabalhoId, chave_secao: secao.chave_secao,
    conteudo: secao.conteudo ?? '', status: secao.status ?? 'editado',
  })
  const { error } = await supabase.from('secoes_trabalho')
    .update({ conteudo: novo, status: 'editado' })
    .eq('trabalho_id', trabalhoId).eq('chave_secao', secao.chave_secao)
  if (error) return NextResponse.json({ error: 'Falha ao inserir no trabalho.' }, { status: 500 })

  return NextResponse.json({ ok: true, secaoNome: secao.nome_secao })
}
