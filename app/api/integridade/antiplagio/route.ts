// Antiplágio / Originalidade — PRONTO mas DESLIGADO até configurar o provedor.
// GET: diz se o serviço está configurado (para a UI mostrar/ocultar o botão).
// POST { trabalhoId }: monta o texto do corpo e consulta o provedor (se ligado).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { extrairTextoSecao } from '@/lib/ai/utils'
import { verificarPlagio, antiplagioConfigurado } from '@/lib/integridade/antiplagio'
import type { SecaoTrabalho } from '@/types'

export const maxDuration = 300

export async function GET() {
  return NextResponse.json({ disponivel: antiplagioConfigurado() })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Sem provedor configurado: responde "indisponível" sem custo nem chamada externa.
  if (!antiplagioConfigurado()) {
    return NextResponse.json({ disponivel: false, motivo: 'Antiplágio não configurado neste ambiente.' })
  }

  const rl = await checkRateLimit(supabase, user.id, 'review-iterate')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const trabalhoId = (body as { trabalhoId?: string })?.trabalhoId
  if (!trabalhoId) return NextResponse.json({ error: 'trabalhoId é obrigatório' }, { status: 400 })

  const { data: trab } = await supabase
    .from('trabalhos').select('id').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trab) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const { data: secoesData } = await supabase
    .from('secoes_trabalho').select('nome_secao, chave_secao, conteudo').eq('trabalho_id', trabalhoId).order('ordem')
  const secoes = (secoesData ?? []) as Pick<SecaoTrabalho, 'nome_secao' | 'chave_secao' | 'conteudo'>[]
  // Corpo para checagem: exclui resumo (JSON) e a lista de referências.
  const texto = secoes
    .filter(s => s.chave_secao !== 'resumo' && s.chave_secao !== 'referencias' && (s.conteudo ?? '').trim())
    .map(s => extrairTextoSecao(s.conteudo ?? ''))
    .join('\n\n')

  const resultado = await verificarPlagio(texto)
  return NextResponse.json(resultado)
}
