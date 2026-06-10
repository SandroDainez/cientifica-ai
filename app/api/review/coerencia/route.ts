// COERÊNCIA GLOBAL: alinha o trabalho como um todo. Os ajustes só tocam seções
// de ENQUADRAMENTO (intro/justificativa/discussão/conclusão) para casar com os
// FATOS (metodologia/resultados), nunca o contrário. Travas anti-fabricação e
// anti-piora; backup da versão anterior. Server-only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { reviewService } from '@/lib/ai/reviewService'
import { ehSecaoEnquadramento, parseAjustesCoerencia } from '@/lib/revisao/coerencia'
import { aplicarEdicoes, edicaoSeguraCirurgica, reescritaSegura } from '@/lib/ai/aplicar-edicoes'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { parseResumoEstruturado } from '@/lib/resumo/proteger'
import { alinhamentoResumoSeguro } from '@/lib/resumo/alinhar'
import type { SecaoTrabalho, Referencia, FormatoCitacao, Trabalho } from '@/types'

export const maxDuration = 300

const Schema = z.object({ trabalhoId: z.string() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'review-iterate')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const { trabalhoId } = parsed.data

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho
  const formato: FormatoCitacao = trabalho.formato_citacao ?? 'abnt'
  const tipo = (trabalho.tipo_trabalho ?? 'trabalho').replace(/_/g, ' ')
  const tema = trabalho.titulo ?? trabalho.area_conhecimento ?? ''

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo, status, ordem')
    .eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo' | 'status'>[]
  const comTexto = secoes.filter(s => (s.conteudo ?? '').trim())
  if (comTexto.length < 2) return NextResponse.json({ ok: true, ajustesAplicados: 0, corpoAtualizado: '', mensagem: 'Seções insuficientes.' })

  // Mapa do trabalho INTEIRO (a coerência precisa ver tudo para casar as seções).
  const mapa = comTexto
    .map(s => `### ${s.nome_secao} | chave=${s.chave_secao}\n${extrairTextoSecao(s.conteudo ?? '')}`)
    .join('\n\n')

  const out = await reviewService.ajustarCoerenciaGlobal({ mapa, tipo, tema })
  if (!out.ok) return NextResponse.json({ error: out.error, codigo: out.codigo }, { status: out.codigo === 'CONFIG_ERROR' ? 503 : 502 })

  const ajustes = parseAjustesCoerencia(out.data)
  const { data: refsData } = await supabase.from('referencias').select('*').eq('trabalho_id', trabalhoId)
  const referencias = (refsData ?? []) as Referencia[]

  // Aplica cada ajuste APENAS em seções de enquadramento (trava de segurança).
  const novoPorChave = new Map<string, string>()
  let aplicados = 0
  for (const aj of ajustes) {
    const secao = comTexto.find(s => s.chave_secao === aj.chave_secao)
    if (!secao) continue
    if (!ehSecaoEnquadramento(aj.chave_secao)) continue           // nunca toca fatos/estrutura
    const conteudoBase = novoPorChave.get(aj.chave_secao) ?? secao.conteudo ?? ''
    if (conteudoBase.trim().startsWith('{')) continue              // nunca JSON (resumo)
    if (!edicaoSeguraCirurgica(aj.buscar, aj.substituir).ok) continue
    const { texto, aplicadas } = aplicarEdicoes(conteudoBase, [{ buscar: aj.buscar, substituir: aj.substituir }])
    if (aplicadas === 0 || texto === conteudoBase) continue
    if (!reescritaSegura(conteudoBase, texto).ok) continue
    novoPorChave.set(aj.chave_secao, texto)
    aplicados++
  }

  // ALINHA o RESUMO (PT) e o ABSTRACT (EN) ao CORPO — corrige promessas/comparações/
  // fontes que o corpo NÃO sustenta (ex.: abstract cita países/bases que o trabalho não
  // usa). Resumo é JSON protegido: PRESERVA palavras-chave/keywords, faz BACKUP antes e
  // só grava se passar nas travas (sem número fabricado, sem colapso/inflação). Universal.
  let resumoAjustado = 0
  const secaoResumo = comTexto.find(s => s.chave_secao === 'resumo')
  const estrut = parseResumoEstruturado(secaoResumo?.conteudo)
  if (secaoResumo && estrut && (estrut.resumo.trim() || estrut.abstract.trim())) {
    const corpoTexto = comTexto
      .filter(s => s.chave_secao !== 'resumo' && s.chave_secao !== 'referencias')
      .map(s => extrairTextoSecao(novoPorChave.get(s.chave_secao) ?? s.conteudo ?? ''))
      .join('\n\n')
    const out2 = await reviewService.alinharResumoAoCorpo({ resumoPt: estrut.resumo, abstractEn: estrut.abstract, corpo: corpoTexto, tipo, tema })
    if (out2.ok) {
      const base = `${estrut.resumo}\n${estrut.abstract}\n${corpoTexto}`
      const novoResumo = alinhamentoResumoSeguro(estrut.resumo, out2.data.resumo, base).aceitar ? out2.data.resumo.trim() : estrut.resumo
      const novoAbstract = alinhamentoResumoSeguro(estrut.abstract, out2.data.abstract, base).aceitar ? out2.data.abstract.trim() : estrut.abstract
      if (novoResumo !== estrut.resumo || novoAbstract !== estrut.abstract) {
        const novoJson = JSON.stringify({ resumo: novoResumo, abstract: novoAbstract, palavras_chave: estrut.palavras_chave, keywords: estrut.keywords })
        await supabase.from('secao_versoes').insert({ trabalho_id: trabalhoId, chave_secao: 'resumo', conteudo: secaoResumo.conteudo ?? '', status: secaoResumo.status ?? 'editado' })
        await supabase.from('secoes_trabalho').update({ conteudo: novoJson, status: 'editado' }).eq('trabalho_id', trabalhoId).eq('chave_secao', 'resumo')
        resumoAjustado = 1
      }
    }
  }

  if (aplicados === 0 && resumoAjustado === 0) {
    return NextResponse.json({ ok: true, ajustesAplicados: 0, corpoAtualizado: '', mensagem: 'Trabalho já coerente (nenhum ajuste seguro a aplicar).' })
  }

  // Pós-processa, faz backup e salva cada seção alterada.
  for (const [chave, texto] of novoPorChave) {
    const limpo = posProcessarTextoGerado(texto, referencias, formato)
    const secao = comTexto.find(s => s.chave_secao === chave)
    await supabase.from('secao_versoes').insert({ trabalho_id: trabalhoId, chave_secao: chave, conteudo: secao?.conteudo ?? '', status: secao?.status ?? 'editado' })
    await supabase.from('secoes_trabalho').update({ conteudo: limpo, status: 'editado' }).eq('trabalho_id', trabalhoId).eq('chave_secao', chave)
    novoPorChave.set(chave, limpo)
  }

  const corpoAtualizado = secoes
    .filter(s => (novoPorChave.get(s.chave_secao) ?? s.conteudo)?.trim())
    .map(s => `${s.nome_secao}\n\n${extrairTextoSecao(novoPorChave.get(s.chave_secao) ?? s.conteudo ?? '')}`)
    .join('\n\n')

  console.log(`[review/coerencia] ajustes aplicados=${aplicados} seções=${novoPorChave.size} resumoAjustado=${resumoAjustado}`)
  return NextResponse.json({ ok: true, ajustesAplicados: aplicados + resumoAjustado, secoesAfetadas: novoPorChave.size + resumoAjustado, resumoAjustado, corpoAtualizado })
}
