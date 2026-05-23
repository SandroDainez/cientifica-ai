'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Eye, BookMarked, Download, Presentation, Shield, Filter, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { EditorArea, type StatusIA } from '@/components/editor/EditorArea'
import { PainelIA } from '@/components/editor/PainelIA'
import { ResumoEditor } from '@/components/resumo/ResumoEditor'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import type { Trabalho, FaseConfig, SecaoTrabalho, ResultadoValidacao } from '@/types'

// ── Extrai opções de título de respostas da IA ────────────────────────────────
// Captura strings entre aspas que parecem títulos (5–35 palavras)
function extrairOpcoesTitulo(texto: string): string[] {
  const matches = [...texto.matchAll(/"([^"]{20,250})"/g)]
  return matches
    .map(m => m[1].trim())
    .filter(t => {
      const words = t.split(/\s+/).length
      return words >= 5 && words <= 35
    })
    .slice(0, 6)
}

interface EditorClientProps {
  trabalho: Trabalho
  fases: FaseConfig[]
  secoesIniciais: SecaoTrabalho[]
}

export function EditorClient({ trabalho, fases, secoesIniciais }: EditorClientProps) {
  const router = useRouter()

  // Mapa chaveSecao → conteúdo (pré-carregado do servidor)
  const [conteudos, setConteudos] = useState<Record<string, string>>(() =>
    Object.fromEntries(secoesIniciais.map(s => [s.chave_secao, s.conteudo ?? '']))
  )

  const [faseAtiva, setFaseAtiva] = useState(trabalho.fase_atual ?? fases[0]?.chave_secao)
  const [fasesConcluidas, setFasesConcluidas] = useState<string[]>(trabalho.fases_concluidas)
  const [statusIA, setStatusIA] = useState<StatusIA>('idle')
  const [validacao, setValidacao] = useState<ResultadoValidacao | null>(null)
  const [iaPanelOpen, setIAPanelOpen] = useState(true)
  // Opções de título geradas pela IA (picker visual em vez de markdown bruto)
  const [tituloOpcoes, setTituloOpcoes] = useState<string[]>([])

  // Detecta fim de geração para seções de título e extrai opções
  const prevStatusRef = useRef<StatusIA>('idle')
  const faseAtualRef = useRef(fases.find(f => f.chave_secao === faseAtiva || f.id === faseAtiva) ?? fases[0])
  const conteudosRef = useRef(conteudos)

  const faseAtualConfig = fases.find(f => f.chave_secao === faseAtiva || f.id === faseAtiva) ?? fases[0]
  const faseIndex = fases.indexOf(faseAtualConfig)
  const isUltimaFase = faseIndex === fases.length - 1
  const progresso = Math.round((fasesConcluidas.length / fases.length) * 100)

  const conteudoAtual = conteudos[faseAtualConfig.chave_secao] ?? conteudos[faseAtiva] ?? ''

  // Mantém refs sincronizadas para uso no useEffect
  faseAtualRef.current = faseAtualConfig
  conteudosRef.current = conteudos

  function setConteudoAtual(valor: string) {
    const chave = faseAtualConfig.chave_secao
    setConteudos(prev => ({ ...prev, [chave]: valor }))
  }

  function trocarFase(chave: string) {
    setFaseAtiva(chave)
    setValidacao(null)
    setTituloOpcoes([])
  }

  // Detecta fim de geração de seção de título → extrai opções e limpa textarea
  useEffect(() => {
    if (prevStatusRef.current === 'gerando' && statusIA === 'idle') {
      const fase = faseAtualRef.current
      const isTitulo = fase?.chave_secao?.includes('titulo')
      if (isTitulo) {
        const textoGerado = conteudosRef.current[fase.chave_secao] ?? ''
        if (textoGerado.length > 60) {
          const opcoes = extrairOpcoesTitulo(textoGerado)
          if (opcoes.length >= 2) {
            setTituloOpcoes(opcoes)
            // Limpa o texto bruto do textarea
            setConteudos(prev => ({ ...prev, [fase.chave_secao]: '' }))
          }
        }
      }
    }
    prevStatusRef.current = statusIA
  }, [statusIA])

  // ── Selecionar opção de título ───────────────────────────────
  function handleSelecionarTituloOpcao(opcao: string) {
    setConteudoAtual(opcao)
    setTituloOpcoes([])
  }

  // ── Gerar seção com IA (streaming) ──────────────────────────
  async function handleGerar() {
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
        }),
      })
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
    } catch (err) {
      console.error('Erro na geração:', err)
    } finally {
      setStatusIA('idle')
    }
  }

  // ── Validar seção ────────────────────────────────────────────
  async function handleValidar() {
    if (!conteudoAtual.trim()) return
    setStatusIA('validando')
    setValidacao(null)
    try {
      const res = await fetch('/api/ia/validar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: faseAtualConfig.chave_secao,
          conteudo: conteudoAtual,
        }),
      })
      const json = await res.json()
      if (res.ok) setValidacao(json)
    } catch (err) {
      console.error('Erro na validação:', err)
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
      await fetch('/api/ia/salvar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: faseAtualConfig.chave_secao,
          conteudo,
          status,
        }),
      })

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

  // ── Aplicar sugestão (marca como aplicada localmente) ────────
  const handleAplicarSugestao = useCallback((id: string) => {
    setValidacao(prev => {
      if (!prev) return prev
      return {
        ...prev,
        sugestoes: prev.sugestoes.map(s => s.id === id ? { ...s, aplicado: true } : s),
      }
    })
  }, [])

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
            title={trabalho.titulo || 'Trabalho sem título'}
            description={getTipoLabel(trabalho.tipo_trabalho)}
            breadcrumbs={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Meus Trabalhos', href: '/trabalhos' },
              { label: 'Editor' },
            ]}
            actions={
              <div className="flex items-center gap-0.5">
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
                <Link href={`/trabalhos/${trabalho.id}/apresentacao`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="Gerar Slides">
                  <Presentation className="h-4 w-4" />
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/exportar`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} title="Exportar">
                  <Download className="h-4 w-4" />
                </Link>
                <div className="w-px h-5 bg-border mx-1" />
                <Link href="/trabalhos" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Sair
                </Link>
              </div>
            }
          />
        </div>

        {/* Editor + painel IA */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {faseAtualConfig.chave_secao === 'resumo' ? (
              <ResumoEditor
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
                onValidar={handleValidar}
                onSalvar={handleSalvar}
                onAbrirIA={() => setIAPanelOpen(true)}
                statusIA={statusIA}
                validacao={validacao}
                onAplicarSugestao={handleAplicarSugestao}
                iaPanelOpen={iaPanelOpen}
                isUltimaFase={isUltimaFase}
                tituloOpcoes={faseAtualConfig.chave_secao?.includes('titulo') ? tituloOpcoes : []}
                onSelecionarTituloOpcao={handleSelecionarTituloOpcao}
              />
            )}
          </div>

          {/* Painel IA lateral direito — oculto na fase de resumo (tem UI própria) */}
          {faseAtualConfig.chave_secao !== 'resumo' && (
            <PainelIA
              trabalhoId={trabalho.id}
              fase={faseAtualConfig}
              isOpen={iaPanelOpen}
              onClose={() => setIAPanelOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
