// Geração do ESQUELETO (outline) de uma seção — Fase 2 do método-professor.
// Devolve o PLANO da seção (subtópicos + fontes que ancoram cada um) em JSON, para o
// usuário APROVAR/EDITAR antes de gerar a prosa. NÃO escreve prosa. SERVER-ONLY.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildOutlineSecaoPrompt } from '@/lib/ai/prompts'
import { callAI } from '@/lib/ai/stream'
import { garantirReferenciasReais, filtrarRefsCitaveis } from '@/lib/referencias/auto-import'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import type { Trabalho, Referencia } from '@/types'

export const maxDuration = 120

const SYS = `Você é um orientador acadêmico sênior que PLANEJA a estrutura de uma seção ANTES de redigir. Devolve apenas o PLANO (esqueleto) em JSON — subtópicos na ordem lógica do argumento e as referências REAIS que sustentam cada um. NUNCA inventa referência nem usa fonte de outro assunto. Não escreve prosa.`

interface SubtopicoOutline { titulo: string; argumento: string; referencias: string[] }

/** Extrai o primeiro objeto JSON do texto (tolerante a cercas markdown). */
function extrairJson(texto: string): { subtopicos: SubtopicoOutline[] } | null {
  const i = texto.indexOf('{')
  const j = texto.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try {
    const o = JSON.parse(texto.slice(i, j + 1))
    if (o && Array.isArray(o.subtopicos)) {
      return {
        subtopicos: o.subtopicos
          .filter((s: unknown): s is Record<string, unknown> => !!s && typeof s === 'object')
          .map((s: Record<string, unknown>) => ({
            titulo: typeof s.titulo === 'string' ? s.titulo : '',
            argumento: typeof s.argumento === 'string' ? s.argumento : '',
            referencias: Array.isArray(s.referencias) ? s.referencias.filter((r): r is string => typeof r === 'string') : [],
          }))
          .filter((s: SubtopicoOutline) => s.titulo.trim()),
      }
    }
  } catch { /* não era JSON válido */ }
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(supabase, user.id, 'gerar-secao')
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um momento.' }, { status: 429 })

  const { trabalhoId, chaveSecao, instrucoes_usuario } = await request.json() as {
    trabalhoId: string; chaveSecao: string; instrucoes_usuario?: string
  }

  const { data: trabalhoData } = await supabase
    .from('trabalhos').select('*').eq('id', trabalhoId).eq('usuario_id', user.id).single()
  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  if (!fase) return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 })

  const { data: refsData } = await supabase
    .from('referencias').select('*').eq('trabalho_id', trabalhoId).order('created_at')
  let referencias = (refsData ?? []) as Referencia[]
  // Garante uma base mínima de fontes reais (mesma lógica da geração de seção).
  if (referencias.length < 10) {
    try {
      const r = await garantirReferenciasReais({
        supabase, trabalhoId, titulo: trabalho.titulo ?? '', area: trabalho.area_conhecimento ?? '',
        tipoTrabalho: trabalho.tipo_trabalho, chaveSecao, refsExistentes: referencias,
      })
      referencias = r.referencias
    } catch { /* segue com o que há */ }
  }

  const userPrompt = buildOutlineSecaoPrompt(fase, {
    titulo: trabalho.titulo ?? undefined,
    area: trabalho.area_conhecimento ?? undefined,
    referencias: filtrarRefsCitaveis(referencias),
    formato_citacao: trabalho.formato_citacao,
    instrucoes_usuario,
  })

  let bruto: string
  try {
    bruto = await callAI(SYS, userPrompt, false, 2500)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar o esqueleto.' }, { status: 502 })
  }

  const outline = extrairJson(bruto)
  if (!outline || outline.subtopicos.length === 0) {
    return NextResponse.json({ error: 'O esqueleto não retornou um plano válido. Tente novamente.' }, { status: 502 })
  }

  // Best-effort: guarda o esqueleto em metadados SE a seção já existe (UPDATE só de
  // metadados — NUNCA toca conteudo/status). Se não existe, será criada na prosa.
  try {
    await supabase.from('secoes_trabalho')
      .update({ metadados: { outline: outline.subtopicos } })
      .eq('trabalho_id', trabalhoId).eq('chave_secao', fase.chave_secao)
  } catch { /* metadados é best-effort */ }

  return NextResponse.json({ ok: true, subtopicos: outline.subtopicos })
}
