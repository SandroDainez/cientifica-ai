import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
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
    .select('id, tipo_trabalho, fases_concluidas, fase_atual')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  // Obtém metadados da fase para o upsert (caso a seção ainda não exista — ex.: digitação direta)
  const fluxoParaMeta = getFluxo(trabalho.tipo_trabalho)
  const faseConfig = fluxoParaMeta?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  const faseOrdem = fluxoParaMeta ? fluxoParaMeta.fases.findIndex(f => f.chave_secao === chaveSecao || f.id === chaveSecao) : 0

  // Upsert garante que a linha existe mesmo quando o usuário digita sem gerar via IA
  const { error: secaoError } = await supabase
    .from('secoes_trabalho')
    .upsert(
      {
        trabalho_id: trabalhoId,
        chave_secao: chaveSecao,
        nome_secao: faseConfig?.nome ?? chaveSecao,
        ordem: faseOrdem >= 0 ? faseOrdem : 0,
        conteudo,
        conteudo_ia: status === 'gerado' ? conteudo : undefined,
        conteudo_usuario: status === 'editado' ? conteudo : undefined,
        status: status ?? 'gerado',
        sugestoes_ia: [],
        metadados: {},
      },
      { onConflict: 'trabalho_id,chave_secao' }
    )

  if (secaoError) {
    return NextResponse.json({ error: 'Erro ao salvar seção' }, { status: 500 })
  }

  // Marca fase como concluída e atualiza fase_atual
  if (status === 'aprovado' || status === 'gerado') {
    const fasesConcluidas = Array.from(
      new Set([...trabalho.fases_concluidas, chaveSecao])
    )

    // Quando aprovado, avança fase_atual para a próxima fase não concluída
    let proximaFase: string | undefined
    if (status === 'aprovado') {
      const fluxo = getFluxo(trabalho.tipo_trabalho)
      if (fluxo) {
        const fases = fluxo.fases
        const idxAtual = fases.findIndex(f => f.chave_secao === chaveSecao)
        if (idxAtual >= 0 && idxAtual < fases.length - 1) {
          proximaFase = fases[idxAtual + 1].chave_secao
        }
      }
    }

    await supabase
      .from('trabalhos')
      .update({
        fases_concluidas: fasesConcluidas,
        ...(proximaFase ? { fase_atual: proximaFase } : {}),
      })
      .eq('id', trabalhoId)
  }

  return NextResponse.json({ ok: true })
}
