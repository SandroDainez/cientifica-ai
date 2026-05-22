'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, BookMarked, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { EditorArea, type StatusIA } from '@/components/editor/EditorArea'
import { PainelIA } from '@/components/editor/PainelIA'
import { getTipoLabel } from '@/components/trabalho/TipoTrabalhoIcon'
import type { Trabalho, FaseConfig, SecaoTrabalho, ResultadoValidacao } from '@/types'

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

  const faseAtualConfig = fases.find(f => f.chave_secao === faseAtiva || f.id === faseAtiva) ?? fases[0]
  const faseIndex = fases.indexOf(faseAtualConfig)
  const isUltimaFase = faseIndex === fases.length - 1
  const progresso = Math.round((fasesConcluidas.length / fases.length) * 100)

  const conteudoAtual = conteudos[faseAtualConfig.chave_secao] ?? conteudos[faseAtiva] ?? ''

  function setConteudoAtual(valor: string) {
    const chave = faseAtualConfig.chave_secao
    setConteudos(prev => ({ ...prev, [chave]: valor }))
  }

  function trocarFase(chave: string) {
    setFaseAtiva(chave)
    setValidacao(null)
  }

  // ── Gerar seção com IA (streaming) ──────────────────────────
  async function handleGerar() {
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
  async function handleSalvar(avancar = false) {
    if (!conteudoAtual.trim()) return
    setStatusIA('salvando')
    try {
      const status = avancar ? 'aprovado' : 'gerado'
      await fetch('/api/ia/salvar-secao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabalhoId: trabalho.id,
          chaveSecao: faseAtualConfig.chave_secao,
          conteudo: conteudoAtual,
          status,
        }),
      })

      if (avancar) {
        const novasConcluidas = Array.from(new Set([...fasesConcluidas, faseAtualConfig.chave_secao]))
        setFasesConcluidas(novasConcluidas)

        if (!isUltimaFase) {
          const proximaFase = fases[faseIndex + 1]
          trocarFase(proximaFase.chave_secao)
        } else {
          // Trabalho concluído — volta para a lista
          router.push('/trabalhos')
        }
      }
    } catch (err) {
      console.error('Erro ao salvar:', err)
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
      />

      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-white sticky top-16 z-10">
          <PageHeader
            title={trabalho.titulo || 'Trabalho sem título'}
            description={getTipoLabel(trabalho.tipo_trabalho)}
            breadcrumbs={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Meus Trabalhos', href: '/trabalhos' },
              { label: 'Editor' },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Link href={`/trabalhos/${trabalho.id}/referencias`} className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2')}>
                  <BookMarked className="h-4 w-4" /> Refs
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/visualizar`} className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2')}>
                  <Eye className="h-4 w-4" /> Preview
                </Link>
                <Link href={`/trabalhos/${trabalho.id}/exportar`} className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2')}>
                  <Download className="h-4 w-4" /> Exportar
                </Link>
                <Link href="/trabalhos" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
                  <ArrowLeft className="h-4 w-4" /> Sair
                </Link>
              </div>
            }
          />
        </div>

        {/* Editor + painel IA */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
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
            />
          </div>

          {/* Painel IA lateral direito */}
          <PainelIA
            trabalhoId={trabalho.id}
            fase={faseAtualConfig}
            isOpen={iaPanelOpen}
            onClose={() => setIAPanelOpen(false)}
          />
        </div>
      </div>
    </div>
  )
}
