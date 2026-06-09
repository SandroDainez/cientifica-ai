'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Eye, BookMarked, Download, Presentation, Shield, Filter, ClipboardList, Map, DatabaseZap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { EditorArea, type StatusIA } from '@/components/editor/EditorArea'
import { PainelIA } from '@/components/editor/PainelIA'
import { ResumoEditor } from '@/components/resumo/ResumoEditor'
import QuestionarioGeracaoModal, { type RespostasQuestionario } from '@/components/editor/QuestionarioGeracaoModal'
import { PainelDadosAutenticos } from '@/components/trabalho/PainelDadosAutenticos'
import { PainelPlanilhaResultados } from '@/components/editor/PainelPlanilhaResultados'
import { HistoricoVersoes } from '@/components/editor/HistoricoVersoes'
import { BlocoFinalizacao } from '@/components/editor/BlocoFinalizacao'
import { BuscaSecoes } from '@/components/editor/BuscaSecoes'
import { useVancouverNumbering } from '@/hooks/useVancouverNumbering'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import type { Trabalho, FaseConfig, SecaoTrabalho, ResultadoValidacao, DadosProjeto, Referencia } from '@/types'
import { limparCitacoesInventadas } from '@/lib/ai/limpar-citacoes'
import { tituloEfetivo, capitalizarTitulo } from '@/lib/trabalho/titulo'
import { shouldShowEditorSection } from '@/lib/tipos/workTypeSchemas'

// ── Extrai opções de título de respostas da IA ────────────────────────────────
// Estratégia primária: bloco delimitado ===OPÇÕES DE TÍTULO=== … ===FIM===
// Estratégias de fallback para respostas em formatos livres.
function extrairOpcoesTitulo(texto: string): string[] {
  // ── Estratégia 1 (confiável): bloco estruturado delimitado ─────────────────
  const blocoMatch = texto.match(
    /===OPÇÕES DE TÍTULO===([\s\S]+?)===FIM===/i
  )
  if (blocoMatch) {
    const linhas = blocoMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*\d+\.\s*/, '').replace(/\*+/g, '').replace(/^\[|\]$/g, '').trim())
      .filter(l => {
        const words = l.split(/\s+/).length
        return words >= 5 && words <= 40
      })
    if (linhas.length >= 2) return linhas.slice(0, 6)
  }

  // ── Estratégias de fallback (texto livre) ──────────────────────────────────
  const candidatos: string[] = []

  // F1: marcador de lista + negrito, ex: "- **Título aqui** (N palavras)"
  const re1 = /^[-•]\s+\*\*([^*]{10,}?)\*\*\s*(?:\(\d+\s*palavras?\))?/gm
  for (const m of texto.matchAll(re1)) {
    candidatos.push(m[1].replace(/\n/g, ' ').trim())
  }

  // F2: blockquote + negrito, ex: "> **Título aqui**"
  if (candidatos.length < 2) {
    const re2 = /^>\s+\*\*([^*]{10,}?)\*\*\s*(?:\(\d+\s*palavras?\))?$/gm
    for (const m of texto.matchAll(re2)) {
      candidatos.push(m[1].replace(/\n/g, ' ').trim())
    }
  }

  // F3: "**Opção N ...:**" seguido de título em negrito na linha seguinte
  if (candidatos.length < 2) {
    const re3 = /\*\*Opção\s+\d[^*]*\*\*\s*:?\s*\n+\s*\*\*([^*]{10,}?)\*\*/gm
    for (const m of texto.matchAll(re3)) {
      candidatos.push(m[1].replace(/\n/g, ' ').trim())
    }
  }

  // F4: lista numerada simples, ex: "1. Título da opção aqui"
  if (candidatos.length < 2) {
    const re4 = /^\d+\.\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^:\n*]{15,300}?)(?:\s*\(\d+\s*palavras?\))?$/gm
    for (const m of texto.matchAll(re4)) {
      candidatos.push(m[1].trim())
    }
  }

  // F5: aspas duplas — último recurso
  if (candidatos.length < 2) {
    for (const m of texto.matchAll(/"([^"]{20,300})"/g)) {
      candidatos.push(m[1].trim())
    }
  }

  return candidatos
    .map(t => t.replace(/\s*\(\d+\s*palavras?\)/gi, '').replace(/\*+/g, '').replace(/^\[|\]$/g, '').trim())
    .filter(t => {
      const words = t.split(/\s+/).length
      return words >= 5 && words <= 40
    })
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 6)
}

interface EditorClientProps {
  trabalho: Trabalho
  fases: FaseConfig[]
  secoesIniciais: SecaoTrabalho[]
}

// ── Pré-preenche o questionário de geração com dados do plano do projeto ───────

function buildValoresIniciais(
  chaveSecao: string,
  dadosProjeto: DadosProjeto | null | undefined
): Record<string, string> | undefined {
  if (!dadosProjeto) return undefined
  const chave = chaveSecao.toLowerCase()
  const vals: Record<string, string> = {}

  // Seção: Introdução
  if (chave === 'introducao' || chave.includes('introducao_') || chave.includes('_introducao')) {
    if (dadosProjeto.contexto_geral) vals.contexto = dadosProjeto.contexto_geral
  }

  // Seção: Objetivo
  if (chave.includes('objetivo')) {
    if (dadosProjeto.objetivo_geral) vals.objetivo_geral = dadosProjeto.objetivo_geral
  }

  // Seção: Justificativa
  if (chave.includes('justificativa')) {
    if (dadosProjeto.justificativa_resumida) vals.relevancia = dadosProjeto.justificativa_resumida
    if (dadosProjeto.contexto_geral) vals.lacuna = dadosProjeto.contexto_geral
  }

  // Seção: Problema / PICO / pergunta de pesquisa
  if (chave.includes('problema') || chave.includes('pico')) {
    if (dadosProjeto.pergunta_pesquisa) vals.pergunta_pesquisa = dadosProjeto.pergunta_pesquisa
    if (dadosProjeto.populacao_alvo) vals.populacao = dadosProjeto.populacao_alvo
  }

  // Seção: Metodologia
  if (chave.includes('metodologia') || chave.includes('material') || chave.includes('metodo')) {
    if (dadosProjeto.instrumentos_previstos) vals.coleta_instrumentos = dadosProjeto.instrumentos_previstos
    if (dadosProjeto.analise_prevista) vals.analise_estatistica = dadosProjeto.analise_prevista
    if (dadosProjeto.populacao_alvo) {
      vals.criterios_inclusao = dadosProjeto.populacao_alvo
    }
    if (dadosProjeto.local_previsto) vals.local_periodo = `${dadosProjeto.local_previsto} — ${dadosProjeto.periodo_previsto}`
  }

  // Seção: Resultados
  if (chave.includes('resultado')) {
    if (dadosProjeto.dados_coletados) {
      vals.dados_numericos = dadosProjeto.dados_coletados
    }
  }

  // Seção: Tema
  if (chave.includes('tema')) {
    if (dadosProjeto.titulo_provisorio) vals.tema = dadosProjeto.titulo_provisorio
  }

  return Object.keys(vals).length > 0 ? vals : undefined
}

// Tipos de trabalho que NÃO coletam dados empíricos — não mostram o painel de planilha.
const TIPOS_SEM_DADOS_EMPIRICOS = new Set([
  'artigo_revisao', 'revisao_sistematica', 'projeto_pesquisa', 'relato_caso',
])

export function EditorClient({ trabalho, fases: fasesRecebidas, secoesIniciais }: EditorClientProps) {
  const router = useRouter()

  // Filtro centralizado por tipo de trabalho (workTypeSchemas). Mantém a lógica
  // de fases existente — apenas oculta seções que não pertencem ao tipo. Para os
  // tipos mapeados é não-destrutivo (editorSections = fluxo completo).
  const fases = fasesRecebidas.filter(f => shouldShowEditorSection(trabalho.tipo_trabalho, f.chave_secao))

  // O painel de planilha (dados da pesquisa) só faz sentido em trabalhos com
  // dados empíricos — nunca em revisão de literatura, projeto ou relato de caso.
  const dadosProjetoTrabalho = ((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as DadosProjeto | undefined) ?? null
  const trabalhoTemDadosEmpiricos =
    !TIPOS_SEM_DADOS_EMPIRICOS.has(trabalho.tipo_trabalho) &&
    dadosProjetoTrabalho?.tipo_coleta !== 'bibliografica'

  // Mapa chaveSecao → conteúdo (pré-carregado do servidor)
  const [conteudos, setConteudos] = useState<Record<string, string>>(() =>
    Object.fromEntries(secoesIniciais.map(s => [s.chave_secao, s.conteudo ?? '']))
  )

  // Autosave + indicador de "não salvo"
  const [temAlteracoes, setTemAlteracoes] = useState(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimoConteudoSalvo = useRef<Record<string, string>>(
    Object.fromEntries(secoesIniciais.map(s => [s.chave_secao, s.conteudo ?? '']))
  )

  const [faseAtiva, setFaseAtiva] = useState(trabalho.fase_atual ?? fases[0]?.chave_secao)
  const [fasesConcluidas, setFasesConcluidas] = useState<string[]>(trabalho.fases_concluidas)
  const [statusIA, setStatusIA] = useState<StatusIA>('idle')
  const [validacao, setValidacao] = useState<ResultadoValidacao | null>(null)
  // Incrementa ao restaurar uma versão → força o ResumoEditor a remontar.
  const [restoreNonce, setRestoreNonce] = useState(0)
  const [iaPanelOpen, setIAPanelOpen] = useState(true)
  // Opções de título geradas pela IA (picker visual em vez de markdown bruto)
  const [tituloOpcoes, setTituloOpcoes] = useState<string[]>([])
  // Questionário pré-geração
  const [questionarioAberto, setQuestionarioAberto] = useState(false)
  // Painel de dados autênticos do pesquisador
  const [dadosAutenticosAberto, setDadosAutenticosAberto] = useState(false)

  // Detecta fim de geração para seções de título e extrai opções
  const prevStatusRef = useRef<StatusIA>('idle')
  const faseAtualRef = useRef(fases.find(f => f.chave_secao === faseAtiva || f.id === faseAtiva) ?? fases[0])
  const conteudosRef = useRef(conteudos)

  const faseAtualConfig = fases.find(f => f.chave_secao === faseAtiva || f.id === faseAtiva) ?? fases[0]
  const faseIndex = fases.indexOf(faseAtualConfig)
  const isUltimaFase = faseIndex === fases.length - 1
  const progresso = Math.round((fasesConcluidas.length / fases.length) * 100)

  const conteudoAtual = conteudos[faseAtualConfig.chave_secao] ?? conteudos[faseAtiva] ?? ''

  // Referências do trabalho — usadas pelo contador de citações Vancouver
  const [referencias, setReferencias] = useState<Referencia[]>([])
  useEffect(() => {
    fetch(`/api/referencias?trabalhoId=${trabalho.id}`)
      .then(r => r.json())
      .then(d => setReferencias(d.referencias ?? []))
      .catch(() => {})
  }, [trabalho.id])

  const { totalCitacoes: totalCitacoesVancouver } = useVancouverNumbering(
    conteudoAtual,
    referencias,
    trabalho.formato_citacao,
  )

  // Indicador de rate limit (gerar-secao) — consulta SEM consumir o limite
  const [bloqueadoPorLimite, setBloqueadoPorLimite] = useState(false)
  const [resetLimiteEm, setResetLimiteEm] = useState<string | undefined>()

  async function verificarLimite() {
    try {
      const res = await fetch('/api/ia/uso-atual')
      if (res.ok) {
        const json = await res.json()
        setBloqueadoPorLimite(!json.allowed)
        setResetLimiteEm(json.resetAt)
      }
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    verificarLimite()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Proteção: avisa se tentar fechar a aba com alterações não salvas
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (temAlteracoes) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [temAlteracoes])

  // Título do cabeçalho — derivado do conteúdo ATUAL da seção de título (reflete
  // edições ao vivo); cai para trabalho.titulo se a seção ainda estiver vazia.
  const chaveTitulo = fases.find(f => /^titulo/.test(f.chave_secao))?.chave_secao
  const conteudoTitulo = chaveTitulo ? conteudos[chaveTitulo] : undefined
  const tituloHeader =
    capitalizarTitulo(
      tituloEfetivo(null, [{ chave_secao: 'titulo', conteudo: conteudoTitulo ?? '' } as SecaoTrabalho]) || trabalho.titulo,
    ) || 'Trabalho sem título'

  // Mantém refs sincronizadas para uso no useEffect
  faseAtualRef.current = faseAtualConfig
  conteudosRef.current = conteudos

  function setConteudoAtual(valor: string) {
    const chave = faseAtualConfig.chave_secao
    setConteudos(prev => ({ ...prev, [chave]: valor }))

    // Marca como não salvo se o conteúdo mudou em relação ao último save
    const salvo = ultimoConteudoSalvo.current[chave] ?? ''
    setTemAlteracoes(valor !== salvo)

    // Autosave: cancela timer anterior e agenda novo save em 30s
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    if (valor.trim() && valor !== salvo) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleSalvarSilencioso(chave, valor)
      }, 30000) // 30 segundos
    }
  }

  async function handleSalvarSilencioso(chave: string, conteudo: string) {
    try {
      await fetch('/api/ia/salvar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: chave,
          conteudo,
          status: 'editado',
        }),
      })
      ultimoConteudoSalvo.current[chave] = conteudo
      setTemAlteracoes(false)
    } catch {
      // Falha silenciosa — não interrompe o usuário
    }
  }

  function trocarFase(chave: string) {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setFaseAtiva(chave)
    setValidacao(null)
    setTituloOpcoes([])
    setQuestionarioAberto(false)
  }

  // Detecta fim de geração → extrai opções de título OU dispara auto-validação
  useEffect(() => {
    if (prevStatusRef.current === 'gerando' && statusIA === 'idle') {
      const fase = faseAtualRef.current
      const isTitulo = fase?.chave_secao?.includes('titulo')
      const textoGerado = conteudosRef.current[fase.chave_secao] ?? ''

      // Atualiza o indicador de limite após cada geração
      verificarLimite()

      // Notificação do browser se o usuário não estiver com foco na aba
      if (typeof window !== 'undefined' && document.hidden) {
        if (Notification.permission === 'granted') {
          new Notification('Científica AI', {
            body: `Seção "${fase.nome}" gerada com sucesso.`,
            icon: '/favicon.ico',
          })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('Científica AI', {
                body: `Seção "${fase.nome}" gerada com sucesso.`,
                icon: '/favicon.ico',
              })
            }
          })
        }
      }

      if (isTitulo) {
        // Seção de título: mostra picker
        if (textoGerado.length > 60) {
          const opcoes = extrairOpcoesTitulo(textoGerado)
          if (opcoes.length >= 2) {
            setTituloOpcoes(opcoes)
            setConteudos(prev => ({ ...prev, [fase.chave_secao]: '' }))
          }
        }
      } else {
        // Outras seções: auto-valida 4s após geração terminar
        if (textoGerado.trim().split(/\s+/).length >= 80) {
          const t = setTimeout(() => {
            setValidacao(null)
            handleValidar()
          }, 4000)
          return () => clearTimeout(t)
        }
      }
    }
    prevStatusRef.current = statusIA
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusIA])

  // ── Selecionar opção de título ───────────────────────────────
  function handleSelecionarTituloOpcao(opcao: string) {
    setConteudoAtual(opcao)
    setTituloOpcoes([])
  }

  // ── Regenerar título com instrução de refinamento ────────────
  function handleGerarNovamenteTitulo(refinamento: string) {
    executarGeracao(undefined, refinamento)
  }

  // ── Gerar seção com IA (com questionário pré-geração) ───────
  function handleGerar() {
    // Para seção de título: gera direto (refinamento fica no picker)
    if (faseAtualConfig.chave_secao?.includes('titulo')) {
      executarGeracao()
      return
    }
    // Para resumo: tem UI própria; para demais seções: abre questionário
    setQuestionarioAberto(true)
  }

  async function executarGeracao(respostas?: RespostasQuestionario, instrucoes?: string) {
    setQuestionarioAberto(false)
    setTituloOpcoes([])
    setStatusIA('gerando')
    setConteudoAtual('')
    try {
      const res = await fetch('/api/ia/gerar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: faseAtualConfig.chave_secao,
          respostas_usuario: respostas,
          instrucoes_usuario: instrucoes,
        }),
      })
      if (!res.ok) throw new Error(`Erro na geração: ${res.status}`)
      if (!res.body) throw new Error('Sem stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        // Atualiza em batches para não re-render a cada char
        setConteudoAtual(acumulado)
      }
      // Pós-processamento: substitui citações com título no lugar de sobrenome
      const acumuladoLimpo = limparCitacoesInventadas(acumulado)
      if (acumuladoLimpo !== acumulado) {
        setConteudoAtual(acumuladoLimpo)
      }
    } catch (err) {
      console.error('Erro na geração:', err)
      toast.error('Erro ao gerar seção. Tente novamente.')
    } finally {
      setStatusIA('idle')
    }
  }

  // ── Validar seção ────────────────────────────────────────────
  // Aceita um texto explícito (conteudoOverride) para re-avaliar logo após uma
  // correção, sem depender da atualização assíncrona do estado.
  async function handleValidar(conteudoOverride?: string) {
    const conteudo = conteudoOverride ?? conteudoAtual
    if (!conteudo.trim()) return
    setStatusIA('validando')
    setValidacao(null)
    try {
      const res = await fetch('/api/ia/validar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: faseAtualRef.current.chave_secao,
          conteudo,
        }),
      })
      const json = await res.json()
      if (res.ok) setValidacao(json)
      else toast.error('Erro ao validar a seção. Tente novamente.')
    } catch (err) {
      console.error('Erro na validação:', err)
      toast.error('Erro ao validar a seção. Tente novamente.')
    } finally {
      setStatusIA('idle')
    }
  }

  // ── Inserir a lista de referências REAIS (do banco) na seção Referências ──
  async function handleInserirReferencias() {
    setStatusIA('gerando')
    try {
      const res = await fetch(`/api/trabalhos/${trabalho.id}/lista-referencias`)
      const data = await res.json() as { lista?: string; total?: number; semReferencias?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Falha ao montar a lista de referências')
      if (data.semReferencias || !data.lista) {
        toast.warning('Nenhuma referência cadastrada ainda. Gere/adicione referências antes de inserir a lista.')
        return
      }
      setConteudoAtual(data.lista)
      await handleSalvar(false, data.lista)
      toast.success(`Lista de referências inserida (${data.total} ${data.total === 1 ? 'referência' : 'referências'}).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao inserir a lista de referências.')
    } finally {
      setStatusIA('idle')
    }
  }

  // ── Salvar / Avançar ─────────────────────────────────────────
  async function handleSalvar(avancar = false, conteudoOverride?: string) {
    const conteudo = conteudoOverride ?? conteudoAtual
    if (!conteudo.trim()) return
    setStatusIA('salvando')
    try {
      const status = avancar ? 'aprovado' : 'gerado'
      const res = await fetch('/api/ia/salvar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: faseAtualConfig.chave_secao,
          conteudo,
          status,
        }),
      })
      if (!res.ok) throw new Error('Falha ao salvar')

      ultimoConteudoSalvo.current[faseAtualConfig.chave_secao] = conteudo
      setTemAlteracoes(false)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)

      if (avancar) {
        const novasConcluidas = Array.from(new Set([...fasesConcluidas, faseAtualConfig.chave_secao]))
        setFasesConcluidas(novasConcluidas)
        toast.success(`Seção "${faseAtualConfig.nome}" concluída!`)

        if (!isUltimaFase) {
          const proximaFase = fases[faseIndex + 1]
          trocarFase(proximaFase.chave_secao)
        } else {
          toast.success('Trabalho concluído! Parabéns! 🎉', { duration: 4000 })
          router.push(`/trabalhos/${trabalho.id}/exportar`)
        }
      }
    } catch (err) {
      console.error('Erro ao salvar:', err)
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setStatusIA('idle')
    }
  }

  // ── Marcar sugestão como aplicada (visual apenas) ───────────
  const handleAplicarSugestao = useCallback((id: string) => {
    setValidacao(prev => {
      if (!prev) return prev
      return {
        ...prev,
        sugestoes: prev.sugestoes.map(s => s.id === id ? { ...s, aplicado: true } : s),
      }
    })
  }, [])

  // ── Aplicar sugestão com IA (reescreve o texto automaticamente) ──
  const handleAplicarComIA = useCallback(async (sugestao: import('@/types').SugestaoIA) => {
    const chaveAlvo = faseAtualRef.current.chave_secao
    const conteudo = conteudosRef.current[chaveAlvo] ?? ''
    if (!conteudo.trim()) return

    // Guarda a versão ANTERIOR para permitir Desfazer (a aplicação às vezes piora)
    const conteudoAntes = conteudo
    const desfazer = async () => {
      setConteudos(prev => ({ ...prev, [chaveAlvo]: conteudoAntes }))
      await fetch('/api/ia/salvar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId: trabalho.id, chaveSecao: chaveAlvo, conteudo: conteudoAntes, status: 'editado' }),
      }).catch(() => {})
      toast.success('Correção desfeita — versão anterior restaurada.')
    }

    setStatusIA('gerando')
    setConteudoAtual('')
    try {
      const res = await fetch('/api/ia/aplicar-sugestao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: faseAtualRef.current.chave_secao,
          conteudo,
          sugestaoTitulo: sugestao.titulo,
          sugestaoDescricao: sugestao.descricao,
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Falha ao aplicar sugestão')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setConteudoAtual(acumulado)
      }
      // Persiste a correção aplicada (o auto-save não dispara em mudança programática)
      if (acumulado.trim()) {
        await fetch('/api/ia/salvar-secao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trabalhoId: trabalho.id,
            chaveSecao: faseAtualRef.current.chave_secao,
            conteudo: acumulado,
            status: 'editado',
          }),
        }).catch(() => {})
      }
      toast.success('Sugestão aplicada. Não gostou?', {
        action: { label: 'Desfazer', onClick: () => { void desfazer() } },
        duration: 12000,
      })
      // Re-avalia com o texto JÁ corrigido: os alertas antigos somem e aparece
      // uma nova avaliação refletindo a correção.
      if (acumulado.trim()) await handleValidar(acumulado)
    } catch (err) {
      console.error('Erro ao aplicar sugestão:', err)
      // Restaura o conteúdo original em caso de falha (NUNCA deixa pior)
      setConteudoAtual(conteudosRef.current[faseAtualRef.current.chave_secao] ?? '')
      toast.error(err instanceof Error ? err.message : 'Erro ao aplicar. Tente novamente.')
    } finally {
      setStatusIA('idle')
    }
  }, [trabalho.id])

  function handleRestaurarVersao(conteudo: string) {
    setConteudos(prev => ({ ...prev, [faseAtualConfig.chave_secao]: conteudo }))
    // Força o ResumoEditor (que lê o conteúdo só na montagem) a recarregar a
    // versão restaurada — essencial para recuperar abstract/palavras-chave.
    setRestoreNonce(n => n + 1)
    toast.success('Versão restaurada. Salve para confirmar.')
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Sidebar de fases */}
      <Sidebar
        fases={fases}
        faseAtual={faseAtiva}
        fasesConcluidas={fasesConcluidas}
        onSelectFase={trocarFase}
        progressoGeral={progresso}
        secoes={secoesIniciais.map(s => ({ ...s, conteudo: conteudos[s.chave_secao] ?? s.conteudo }))}
      />

      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-4 pb-3 border-b bg-background">
          <PageHeader
            title={tituloHeader}
            description={getTipoLabel(trabalho.tipo_trabalho)}
            breadcrumbs={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Meus Trabalhos', href: '/trabalhos' },
              { label: 'Editor' },
            ]}
            actions={
              <div className="flex items-center gap-0.5">
                <Link href={`/trabalhos/${trabalho.id}/projeto`} className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5')} title="Plano do Projeto — roadmap, checklists e documentos">
                  <Map className="h-3.5 w-3.5" />
                  Projeto
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/referencias`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="Referências">
                  <BookMarked className="h-4 w-4" />
                </Link>
                {trabalho.tipo_trabalho === 'revisao_sistematica' && (
                  <Link href={`/trabalhos/${trabalho.id}/prisma`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="PRISMA">
                    <Filter className="h-4 w-4" />
                  </Link>
                )}
                <Link href={`/trabalhos/${trabalho.id}/etica`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="Ética em Pesquisa">
                  <Shield className="h-4 w-4" />
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/coleta-dados`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="Coleta de Dados">
                  <ClipboardList className="h-4 w-4" />
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/visualizar`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="Preview do Documento">
                  <Eye className="h-4 w-4" />
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/apresentacao`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 px-2')} title="Gerar Slides (PowerPoint)">
                  <Presentation className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">Slides</span>
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/exportar`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="Exportar">
                  <Download className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setDadosAutenticosAberto(true)}
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 gap-1.5 px-2')}
                  title="Dados Autênticos — cole seus dados de pesquisa e a IA identifica onde incorporar"
                >
                  <DatabaseZap className="h-4 w-4 text-violet-500" />
                  <span className="text-xs hidden sm:inline text-violet-600 dark:text-violet-400">Meus Dados</span>
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <Link href="/trabalhos" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Sair
                </Link>
              </div>
            }
          />

          {/* Busca dentro do trabalho — salta para a seção que contém o termo */}
          <div className="mt-3 max-w-md">
            <BuscaSecoes
              fases={fases}
              conteudos={conteudos}
              onIrParaSecao={(chave) => trocarFase(chave)}
            />
          </div>
        </div>

        {/* Banner: plano do projeto não criado */}
        {!((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto) && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <span className="text-lg shrink-0">📋</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Crie o Plano do Projeto antes de escrever</p>
              <p className="text-xs text-amber-700 mt-0.5">
                O plano define o roadmap, os requisitos éticos (CEP) e alimenta a IA com dados reais do seu projeto — o resultado é muito melhor.
              </p>
            </div>
            <Link
              href={`/trabalhos/${trabalho.id}/projeto`}
              className="shrink-0 text-xs font-semibold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Criar plano →
            </Link>
          </div>
        )}

        {/* Banner: plano existe — lembrete de que pode retornar a qualquer momento */}
        {Boolean((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto) && (() => {
          const dados = (trabalho.dados_trabalho as Record<string, unknown>)
          const plano = dados.dados_projeto as Record<string, unknown>
          const checklist = (plano?.checklist ?? []) as Array<{ id: string; concluido: boolean }>
          const checklistStatus = (plano?.checklist_status ?? {}) as Record<string, boolean>
          const pendentes = checklist.filter(item => !(checklistStatus[item.id] ?? item.concluido)).length
          const temDocumentos = dados.documentos_projeto && Object.keys(dados.documentos_projeto as object).length > 0

          return (
            <div className="mx-6 mt-3 rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20 px-4 py-2.5 flex items-center gap-3">
              <Map className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0 text-xs text-blue-800 dark:text-blue-200">
                <span className="font-medium">Projeto de Pesquisa ativo</span>
                {pendentes > 0
                  ? <> — <span className="font-semibold text-amber-700 dark:text-amber-400">{pendentes} tarefa{pendentes > 1 ? 's' : ''} pendente{pendentes > 1 ? 's' : ''}</span> no roadmap</>
                  : temDocumentos
                    ? <> — documentos gerados disponíveis para edição</>
                    : <> — roadmap, checklists e geração de documentos disponíveis</>}
              </div>
              <Link
                href={`/trabalhos/${trabalho.id}/projeto`}
                className="shrink-0 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline underline-offset-2 whitespace-nowrap"
              >
                Ver Projeto →
              </Link>
            </div>
          )
        })()}

        {/* Editor + painel IA — lado a lado no desktop, empilhado no mobile */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          <div className="w-full lg:flex-1 min-w-0 lg:overflow-y-auto px-6 py-6">
            {faseAtualConfig.chave_secao === 'resumo' ? (
              <ResumoEditor
                key={`resumo-${restoreNonce}`}
                trabalho={trabalho}
                fase={faseAtualConfig}
                conteudoInicial={conteudoAtual}
                onSalvar={async (conteudo, avancar = false) => {
                  setConteudoAtual(conteudo)
                  await handleSalvar(avancar, conteudo)
                }}
                isUltimaFase={isUltimaFase}
                statusExterno={statusIA === 'salvando' ? 'salvando' : 'idle'}
              />
            ) : (
              <EditorArea
                fase={faseAtualConfig}
                conteudo={conteudoAtual}
                onConteudoChange={setConteudoAtual}
                onGerar={handleGerar}
                onValidar={() => handleValidar()}
                onInserirReferencias={handleInserirReferencias}
                onSalvar={handleSalvar}
                temAlteracoes={temAlteracoes}
                totalCitacoesVancouver={totalCitacoesVancouver}
                formatoCitacao={trabalho.formato_citacao}
                bloqueadoPorLimite={bloqueadoPorLimite}
                resetLimiteEm={resetLimiteEm}
                onAbrirIA={() => setIAPanelOpen(true)}
                statusIA={statusIA}
                validacao={validacao}
                onAplicarSugestao={handleAplicarSugestao}
                onAplicarComIA={handleAplicarComIA}
                iaPanelOpen={iaPanelOpen}
                isUltimaFase={isUltimaFase}
                tituloOpcoes={faseAtualConfig.chave_secao?.includes('titulo') ? tituloOpcoes : []}
                onSelecionarTituloOpcao={handleSelecionarTituloOpcao}
                onGerarNovamenteTitulo={handleGerarNovamenteTitulo}
                linkReferencias={`/trabalhos/${trabalho.id}/referencias`}
                slotDados={
                  trabalhoTemDadosEmpiricos && /resultado|metodo|metodolog|coleta|discuss/i.test(faseAtualConfig.chave_secao ?? '') ? (
                    <PainelPlanilhaResultados
                      trabalhoId={trabalho.id}
                      dadosProjeto={((trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as DadosProjeto | undefined) ?? null}
                      chaveSecao={faseAtualConfig.chave_secao}
                      onInserirNoTexto={(t) => setConteudoAtual((conteudosRef.current[faseAtualConfig.chave_secao] ?? '') + t)}
                    />
                  ) : null
                }
              />
            )}

            {/* Histórico de versões da seção (restaurar versões anteriores) —
                inclui o resumo, para recuperar abstract/palavras-chave perdidos. */}
            <div className="mt-4">
              <HistoricoVersoes
                trabalhoId={trabalho.id}
                chaveSecao={faseAtualConfig.chave_secao}
                onRestaurar={handleRestaurarVersao}
              />
            </div>

            {/* Encerramento — fase final (revisar → formatar → submeter), na última seção */}
            {isUltimaFase && <BlocoFinalizacao trabalhoId={trabalho.id} />}
          </div>

          {/* Painel IA — sempre visível (ao lado no desktop, abaixo no mobile);
              oculto apenas na fase de resumo, que tem UI própria */}
          {faseAtualConfig.chave_secao !== 'resumo' && (
            <div className="w-full lg:w-80 lg:shrink-0 px-6 pb-6 lg:py-6 lg:pl-0 lg:pr-6">
              <PainelIA
                trabalhoId={trabalho.id}
                fase={faseAtualConfig}
                isOpen={true}
                onClose={() => setIAPanelOpen(false)}
                conteudoAtual={conteudoAtual}
                onAplicarNoEditor={(novoTexto) => {
                  // Atualiza o editor e persiste reaproveitando o save existente
                  setConteudoAtual(novoTexto)
                  void handleSalvar(false, novoTexto)
                  // Re-avalia com o texto corrigido: alertas antigos somem, nova avaliação aparece
                  void handleValidar(novoTexto)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de questionário pré-geração ────────────────── */}
      {questionarioAberto && (
        <QuestionarioGeracaoModal
          chaveSecao={faseAtualConfig.chave_secao}
          nomeSecao={faseAtualConfig.nome}
          tipoTrabalho={trabalho.tipo_trabalho}
          valoresIniciais={buildValoresIniciais(
            faseAtualConfig.chave_secao,
            (trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as DadosProjeto | undefined
          )}
          onConfirmar={(respostas) => executarGeracao(respostas)}
          onPular={() => executarGeracao()}
          onCancelar={() => setQuestionarioAberto(false)}
        />
      )}

      {/* ── Painel de Dados Autênticos ────────────────────────── */}
      <PainelDadosAutenticos
        trabalhoId={trabalho.id}
        dadosProjeto={(trabalho.dados_trabalho as Record<string, unknown>)?.dados_projeto as DadosProjeto | null | undefined}
        fases={fases}
        isOpen={dadosAutenticosAberto}
        onClose={() => setDadosAutenticosAberto(false)}
        onIrParaSecao={(chaveSecao) => {
          trocarFase(chaveSecao)
          setDadosAutenticosAberto(false)
        }}
      />
    </div>
  )
}
