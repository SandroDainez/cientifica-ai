'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, MessageSquare, Lightbulb, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownText } from '@/components/ui/MarkdownText'
import type { MensagemIA, FaseConfig } from '@/types'

// ── Sugestões de perguntas contextuais por tipo de seção ─────────────────
function getSugestoesChat(chaveSecao: string, nomeSecao: string, temConteudo: boolean): string[] {
  const chave = chaveSecao.toLowerCase()

  if (temConteudo) {
    return [
      `O que está faltando neste texto da ${nomeSecao}?`,
      `Como posso melhorar a qualidade acadêmica deste texto?`,
      `Este texto está adequado para a seção "${nomeSecao}"?`,
    ]
  }

  if (chave.includes('titulo')) return [
    `Quais características deve ter um bom título acadêmico?`,
    `Como identificar se meu título está claro e informativo?`,
    `Devo incluir o tipo de estudo no título?`,
  ]

  if (chave.includes('introducao') || chave.includes('introdução')) return [
    `Qual é a estrutura ideal de uma introdução científica?`,
    `Como fazer o "funil" da contextualização para o problema?`,
    `O que NÃO deve aparecer na introdução?`,
  ]

  if (chave.includes('justificativa')) return [
    `Como argumentar que meu tema é relevante sem ser genérico?`,
    `Que tipo de dados fortalecem uma justificativa?`,
    `Como identificar e demonstrar a lacuna de conhecimento?`,
  ]

  if (chave.includes('objetivo')) return [
    `Qual a diferença entre objetivo geral e específicos?`,
    `Quais verbos usar nos objetivos científicos (ABNT)?`,
    `Como garantir que os objetivos são mensuráveis?`,
  ]

  if (chave.includes('metodolog') || chave.includes('metodos') || chave.includes('método')) return [
    `Qual a diferença entre pesquisa qualitativa e quantitativa?`,
    `O que é e como fazer o cálculo amostral?`,
    `Como descrever instrumentos de coleta na metodologia?`,
  ]

  if (chave.includes('resultado')) return [
    `Como apresentar resultados negativos no texto?`,
    `Qual a diferença entre resultados e discussão?`,
    `Como descrever tabelas e figuras no texto?`,
  ]

  if (chave.includes('discussao') || chave.includes('discussão')) return [
    `Como comparar meus resultados com a literatura existente?`,
    `Como discutir resultados que contradizem outros estudos?`,
    `Onde e como mencionar as limitações do estudo?`,
  ]

  if (chave.includes('conclusao') || chave.includes('conclusão') || chave.includes('consideracoes')) return [
    `O que não pode faltar em uma conclusão científica?`,
    `Como diferenciar conclusão de resumo dos resultados?`,
    `Como fazer recomendações práticas baseadas nos achados?`,
  ]

  if (chave.includes('revisao') || chave.includes('revisão') || chave.includes('referencial')) return [
    `Como organizar uma revisão de literatura por subtemas?`,
    `Como fazer síntese crítica sem apenas resumir artigos?`,
    `Como identificar artigos fundamentais vs. recentes para incluir?`,
  ]

  if (chave.includes('resumo') || chave.includes('abstract')) return [
    `Qual a estrutura de um resumo ABNT NBR 6028?`,
    `Como escrever um abstract em inglês acadêmico?`,
    `Que informações são obrigatórias no resumo?`,
  ]

  if (chave.includes('estrategia_busca') || chave.includes('busca')) return [
    `Como montar uma string de busca com operadores booleanos?`,
    `Quais bases de dados usar para revisão sistemática?`,
    `Como usar descritores MeSH/DeCS na busca?`,
  ]

  if (chave.includes('investigacao_diagnostica') || chave.includes('diagnostica')) return [
    `Como apresentar o raciocínio diagnóstico em um relato de caso?`,
    `Como descrever exames de imagem no texto?`,
    `O que incluir no diagnóstico diferencial?`,
  ]

  if (chave.includes('conduta') || chave.includes('tratamento')) return [
    `Como descrever um esquema terapêutico em linguagem científica?`,
    `Por que devo justificar as decisões de tratamento?`,
    `Como mencionar medicamentos (genérico vs. marca)?`,
  ]

  if (chave.includes('cronograma')) return [
    `Como montar um cronograma de pesquisa realista?`,
    `Quais atividades não podem faltar em um cronograma de IC/mestrado?`,
    `Como apresentar o cronograma em formato de tabela?`,
  ]

  if (chave.includes('etico') || chave.includes('ético') || chave.includes('cep')) return [
    `Quando é obrigatório submeter ao CEP?`,
    `O que deve constar no TCLE?`,
    `Como mencionar aspectos éticos em pesquisa com dados secundários?`,
  ]

  // default
  return [
    `Como deve ser a "${nomeSecao}" de um trabalho científico?`,
    `Qual é a extensão ideal para esta seção?`,
    `Quais são os erros mais comuns nesta seção?`,
  ]
}

interface PainelIAProps {
  trabalhoId: string
  fase: FaseConfig
  isOpen: boolean
  onClose: () => void
  conteudoAtual?: string
}

export function PainelIA({ trabalhoId, fase, isOpen, onClose, conteudoAtual }: PainelIAProps) {
  const [mensagens, setMensagens] = useState<MensagemIA[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aba, setAba] = useState<'chat' | 'dicas'>('dicas')
  const listaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMensagens([])
  }, [fase.id])

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensagens])

  async function enviarTexto(texto: string) {
    if (!texto.trim() || enviando) return
    setEnviando(true)

    const novaMensagem: MensagemIA = { role: 'user', content: texto }
    setMensagens(prev => [...prev, novaMensagem])

    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId,
          chaveSecao: fase.chave_secao,
          mensagens: [...mensagens, novaMensagem],
          // Envia o conteúdo atual para que a IA possa analisar e sugerir melhorias no texto
          conteudoAtual: conteudoAtual ? conteudoAtual.substring(0, 3000) : undefined,
        }),
      })

      if (!res.body) throw new Error('Sem resposta')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let resposta = ''

      setMensagens(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // eslint-disable-next-line react-hooks/immutability
        resposta += decoder.decode(value, { stream: true })
        setMensagens(prev => {
          const copia = [...prev]
          copia[copia.length - 1] = { role: 'assistant', content: resposta }
          return copia
        })
      }
    } catch (err) {
      console.error('[PainelIA] Erro no chat:', err)
      setMensagens(prev => [
        ...prev,
        { role: 'assistant', content: 'Erro ao conectar com a IA. Tente novamente.' },
      ])
    } finally {
      setEnviando(false)
    }
  }

  async function enviar() {
    if (!input.trim() || enviando) return
    const texto = input.trim()
    setInput('')
    await enviarTexto(texto)
  }

  if (!isOpen) return null

  return (
    <aside className="w-80 shrink-0 flex flex-col border-l bg-card h-[calc(100vh-4rem)] sticky top-16 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Assistente IA</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Abas */}
      <div className="flex border-b">
        {([
          { id: 'dicas', label: 'Dicas', icon: Lightbulb },
          { id: 'chat', label: 'Chat', icon: MessageSquare },
        ] as { id: 'dicas' | 'chat'; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
              aba === id
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Aba Dicas */}
      {aba === 'dicas' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Passo a passo para esta seção */}
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-primary uppercase tracking-wide">
              Como fazer esta seção
            </p>
            <ol className="space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-foreground">
                <span className="shrink-0 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center mt-0.5">1</span>
                Clique em <strong>&quot;Gerar com IA&quot;</strong> para criar um rascunho automático
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 h-4 w-4 rounded-full bg-muted text-muted-foreground text-[9px] font-bold flex items-center justify-center mt-0.5">2</span>
                Revise e personalize o texto gerado com seus dados reais
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 h-4 w-4 rounded-full bg-muted text-muted-foreground text-[9px] font-bold flex items-center justify-center mt-0.5">3</span>
                Clique em <strong>&quot;Validar&quot;</strong> para checar a qualidade
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 h-4 w-4 rounded-full bg-muted text-muted-foreground text-[9px] font-bold flex items-center justify-center mt-0.5">4</span>
                Corrija os pontos indicados e <strong>avance</strong> para a próxima seção
              </li>
            </ol>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Objetivo desta seção
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{fase.instrucoes}</p>
          </div>

          {fase.elementos_obrigatorios?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                O que deve conter
              </p>
              <ul className="space-y-1.5">
                {fase.elementos_obrigatorios.map((el, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                    {el}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fase.dicas_ia.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Dicas importantes
              </p>
              <ul className="space-y-2">
                {fase.dicas_ia.map(dica => (
                  <li key={dica} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {dica}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fase.erros_comuns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                ⚠️ Erros comuns a evitar
              </p>
              <ul className="space-y-2">
                {fase.erros_comuns.map(erro => (
                  <li key={erro} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    {erro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => setAba('chat')}
            className="w-full text-xs text-primary hover:underline text-left mt-2"
          >
            Ficou com dúvida? Pergunte à IA →
          </button>
        </div>
      )}

      {/* Aba Chat */}
      {aba === 'chat' && (
        <>
          <div ref={listaRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensagens.length === 0 && (
              <div className="space-y-3 py-2">
                <div className="text-center">
                  <Bot className="h-8 w-8 text-primary/30 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">Assistente de escrita</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pergunte qualquer coisa sobre a seção &quot;{fase.nome}&quot;
                  </p>
                </div>
                {/* Perguntas sugeridas — contextuais por tipo de seção */}
                <div className="space-y-1.5">
                  {getSugestoesChat(fase.chave_secao, fase.nome, !!conteudoAtual?.trim()).map(pergunta => (
                    <button key={pergunta}
                      onClick={() => enviarTexto(pergunta)}
                      disabled={enviando}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50">
                      {pergunta}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mensagens.map((m, i) => (
              <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-800'
                )}>
                  {m.role === 'assistant'
                    ? (m.content
                        ? <MarkdownText content={m.content} className="space-y-1" />
                        : <Loader2 className="h-3.5 w-3.5 animate-spin" />)
                    : m.content
                  }
                </div>
                {m.role === 'user' && (
                  <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
                placeholder="Pergunte à IA…"
                disabled={enviando}
                className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
              />
              <button
                onClick={enviar}
                disabled={!input.trim() || enviando}
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {enviando
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
