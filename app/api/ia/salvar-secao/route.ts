import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { tituloEfetivo } from '@/lib/trabalho/titulo'
import { fasesEfetivas, getDadosProjeto } from '@/lib/tipos/fases-efetivas'
import { protegerConteudoResumo } from '@/lib/resumo/proteger'
import type { StatusSecao, SecaoTrabalho } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId, chaveSecao, conteudo: conteudoRecebido, status } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    conteudo: string
    status?: StatusSecao
  }
  let conteudo = conteudoRecebido

  // Valida ownership
  const { data: trabalho } = await supabase
    .from('trabalhos')
    .select('id, tipo_trabalho, fases_concluidas, fase_atual, dados_trabalho')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalho) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  // ── Trava anti-sumiço do resumo ────────────────────────────────────────────
  // A seção "resumo" é um JSON {resumo, abstract, palavras_chave, keywords}.
  // Nunca deixa texto puro apagar um resumo estruturado, nem um save parcial
  // zerar campos já preenchidos. Ver lib/resumo/proteger.ts.
  if (chaveSecao === 'resumo') {
    const { data: atual } = await supabase
      .from('secoes_trabalho').select('conteudo')
      .eq('trabalho_id', trabalhoId).eq('chave_secao', 'resumo').maybeSingle()
    const protecao = protegerConteudoResumo(conteudo, (atual as { conteudo?: string } | null)?.conteudo)
    if (protecao.bloqueado) {
      // Gravação destrutiva recusada — preserva o resumo estruturado existente.
      console.warn('[salvar-secao] gravação de texto puro no resumo bloqueada (abstract/keywords preservados)')
      return NextResponse.json({ ok: true, bloqueado: true })
    }
    conteudo = protecao.conteudo
  }

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

  // Salva versão no histórico — fire and forget (não bloqueia o save principal)
  void supabase.from('secao_versoes').insert({
    trabalho_id: trabalhoId,
    chave_secao: chaveSecao,
    conteudo,
    status: status ?? 'gerado',
  })

  // Mantém trabalhos.titulo sincronizado com a seção de TÍTULO, para que os cards
  // (Meus Trabalhos/Dashboard) e demais telas nunca mostrem "Trabalho sem título".
  if (/^titulo/.test(chaveSecao) && conteudo?.trim()) {
    const tituloExtraido = tituloEfetivo(null, [{ chave_secao: 'titulo', conteudo } as SecaoTrabalho])
    if (tituloExtraido) {
      await supabase.from('trabalhos').update({ titulo: tituloExtraido }).eq('id', trabalhoId)
    }
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

    // Marca o trabalho como concluído quando TODAS as fases EFETIVAS do fluxo já
    // estão concluídas (mesmo critério do progresso 100% no card — desconsidera
    // ética/CEP quando a pesquisa não exige).
    const fasesDoc = fluxoParaMeta
      ? fasesEfetivas(fluxoParaMeta.fases, getDadosProjeto(trabalho), trabalho.tipo_trabalho)
      : []
    const todasFases = fasesDoc.map(f => f.chave_secao)
    const concluido = todasFases.length > 0 && todasFases.every(c => fasesConcluidas.includes(c))

    await supabase
      .from('trabalhos')
      .update({
        fases_concluidas: fasesConcluidas,
        ...(proximaFase ? { fase_atual: proximaFase } : {}),
        ...(concluido ? { status: 'concluido' } : {}),
      })
      .eq('id', trabalhoId)
  }

  return NextResponse.json({ ok: true })
}
