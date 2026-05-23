import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFluxo } from '@/lib/tipos/fluxos-trabalho'
import { buildSystemPrompt, buildGerarSecaoPrompt } from '@/lib/ai/prompts'
import { getSystemPromptEspecializado } from '@/lib/ai/prompts-secoes'
import { streamText } from '@/lib/ai/stream'
import type { Trabalho, Referencia } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { trabalhoId, chaveSecao, instrucoes_usuario, respostas_usuario } = await request.json() as {
    trabalhoId: string
    chaveSecao: string
    instrucoes_usuario?: string
    respostas_usuario?: Record<string, string>
  }

  // Carrega trabalho e valida ownership
  const { data: trabalhoData } = await supabase
    .from('trabalhos')
    .select('*')
    .eq('id', trabalhoId)
    .eq('usuario_id', user.id)
    .single()

  if (!trabalhoData) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
  const trabalho = trabalhoData as Trabalho

  const fluxo = getFluxo(trabalho.tipo_trabalho)
  const fase = fluxo?.fases.find(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  if (!fase) return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 })

  // Carrega referências bibliográficas do trabalho
  const { data: referenciasData } = await supabase
    .from('referencias')
    .select('*')
    .eq('trabalho_id', trabalhoId)
    .order('created_at')
  const referencias = (referenciasData ?? []) as Referencia[]

  // Carrega conteúdo das seções anteriores para contexto
  const { data: secoesAnteriores } = await supabase
    .from('secoes_trabalho')
    .select('nome_secao, conteudo')
    .eq('trabalho_id', trabalhoId)
    .in('status', ['gerado', 'editado', 'aprovado'])
    .order('ordem')

  // Extrai texto legível de conteúdo de seções (alguns campos são JSON — ex: resumo)
  function extrairTextoSecao(conteudo: string): string {
    if (!conteudo) return ''
    try {
      const parsed = JSON.parse(conteudo)
      if (typeof parsed === 'object' && parsed !== null) {
        // ResumoEditor serializa: { resumo, abstract, palavras_chave, keywords }
        const partes: string[] = []
        if (parsed.resumo) partes.push(`Resumo: ${parsed.resumo}`)
        if (parsed.abstract) partes.push(`Abstract: ${parsed.abstract}`)
        if (parsed.palavras_chave?.length) partes.push(`Palavras-chave: ${parsed.palavras_chave.join('; ')}`)
        return partes.join('\n')
      }
    } catch {
      // não é JSON — usa o texto puro
    }
    return conteudo
  }

  const contexto_anterior = secoesAnteriores
    ?.map(s => {
      const textoLimpo = extrairTextoSecao(s.conteudo ?? '')
      return `**${s.nome_secao}**:\n${textoLimpo.substring(0, 1500)}`
    })
    .join('\n\n') ?? ''

  const systemPromptEspecializado = getSystemPromptEspecializado(
    trabalho.tipo_trabalho,
    chaveSecao
  )
  const systemPrompt = systemPromptEspecializado ?? buildSystemPrompt(
    trabalho.tipo_trabalho,
    trabalho.nivel_experiencia,
    trabalho.formato_citacao
  )

  const userPrompt = buildGerarSecaoPrompt(fase, {
    titulo: trabalho.titulo,
    area: trabalho.area_conhecimento ?? undefined,
    orientador: trabalho.orientador ?? undefined,
    contexto_anterior: contexto_anterior || undefined,
    instrucoes_usuario,
    respostas_usuario,
    referencias: referencias.length > 0 ? referencias : undefined,
    formato_citacao: trabalho.formato_citacao,
  })

  // Garante que a seção existe na tabela (upsert)
  const faseIndex = fluxo!.fases.findIndex(f => f.chave_secao === chaveSecao || f.id === chaveSecao)
  await supabase.from('secoes_trabalho').upsert({
    trabalho_id: trabalhoId,
    nome_secao: fase.nome,
    chave_secao: fase.chave_secao,
    ordem: faseIndex,
    status: 'gerando',
    sugestoes_ia: [],
    metadados: {},
  }, { onConflict: 'trabalho_id,chave_secao' })

  return streamText(systemPrompt, userPrompt, false)
}
