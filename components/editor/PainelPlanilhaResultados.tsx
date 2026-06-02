'use client'

import { useState, useRef } from 'react'
import {
  Table2, Upload, FileSpreadsheet, FileText, ImageIcon, X,
  Loader2, CheckCircle2, AlertTriangle, Sparkles, Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownText } from '@/components/ui/MarkdownText'
import type { DadosProjeto } from '@/types'

interface PainelPlanilhaResultadosProps {
  trabalhoId: string
  dadosProjeto: DadosProjeto | null
  /** chave_secao atual — permite análise contextualizada para a fase */
  chaveSecao: string
}

type ArquivoStatus = 'lendo' | 'extraindo' | 'concluido' | 'erro'
interface ArquivoProcessado {
  id: string
  nome: string
  tipo: string
  ext: string
  status: ArquivoStatus
  erro?: string
}

/**
 * Painel SEMPRE VISÍVEL na seção de Resultados do editor.
 * Permite colar dados de planilha ou fazer upload de arquivos (XLSX, CSV, TXT, imagens).
 * Salva em dados_projeto.dados_coletados — a geração da seção Resultados/Discussão/Conclusão
 * lê esse campo com prioridade máxima e usa os números reais (nunca inventa).
 */
export function PainelPlanilhaResultados({ trabalhoId, dadosProjeto, chaveSecao }: PainelPlanilhaResultadosProps) {
  const [texto, setTexto] = useState(dadosProjeto?.dados_coletados ?? '')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [arquivos, setArquivos] = useState<ArquivoProcessado[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [aberto, setAberto] = useState(true)
  const [analise, setAnalise] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textoRef = useRef(texto)
  const inputRef = useRef<HTMLInputElement>(null)
  textoRef.current = texto

  async function analisarComIA() {
    if (analisando || textoRef.current.trim().length < 10) return
    setAnalisando(true)
    setAnalise('')
    try {
      const res = await fetch('/api/ia/analisar-planilha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, chaveSecao, dadosPlanilha: textoRef.current }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? 'Falha ao analisar')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setAnalise(acc)
      }
    } catch (err) {
      setAnalise(`⚠️ ${err instanceof Error ? err.message : 'Erro ao analisar os dados. Tente novamente.'}`)
    } finally {
      setAnalisando(false)
    }
  }

  function salvar(valor: string) {
    setSalvo(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSalvando(true)
      try {
        await fetch(`/api/trabalhos/${trabalhoId}/projeto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dados_projeto: {
              ...(dadosProjeto ?? {}),
              dados_coletados: valor,
            },
          }),
        })
        setSalvo(true)
      } finally {
        setSalvando(false)
      }
    }, 1200)
  }

  function handleTextoChange(valor: string) {
    setTexto(valor)
    salvar(valor)
  }

  function appendTexto(conteudo: string, nomeArquivo: string) {
    const sep = `\n\n--- Dados de: ${nomeArquivo} ---\n`
    const novo = textoRef.current ? textoRef.current + sep + conteudo : conteudo
    setTexto(novo)
    salvar(novo)
  }

  function atualizarArquivo(id: string, patch: Partial<ArquivoProcessado>) {
    setArquivos(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  async function processarArquivo(file: File) {
    const id = `${file.name}-${file.size}`
    const tipo = file.type || ''
    const nome = file.name
    const ext = nome.split('.').pop()?.toLowerCase() ?? ''

    setArquivos(prev => [...prev.filter(a => a.id !== id), { id, nome, tipo, ext, status: 'lendo' }])

    try {
      // TXT / CSV / TSV — leitura direta
      if (tipo.includes('text') || ext === 'txt' || ext === 'csv' || ext === 'tsv') {
        const conteudo = await file.text()
        appendTexto(conteudo, nome)
        atualizarArquivo(id, { status: 'concluido' })
        return
      }

      // XLSX / XLS / ODS — SheetJS no navegador
      if (ext === 'xlsx' || ext === 'xls' || ext === 'ods' ||
          tipo.includes('spreadsheet') || tipo.includes('excel')) {
        const xlsx = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = xlsx.read(buffer, { type: 'array' })
        const linhas: string[] = []
        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName]
          const csv = xlsx.utils.sheet_to_csv(ws)
          if (csv.trim()) {
            linhas.push(`[Planilha: ${sheetName}]`)
            linhas.push(csv.trim())
          }
        })
        appendTexto(linhas.join('\n\n'), nome)
        atualizarArquivo(id, { status: 'concluido' })
        return
      }

      // Imagens — extração via IA
      const ehImagem = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(tipo)
        || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
      if (ehImagem) {
        atualizarArquivo(id, { status: 'extraindo' })
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/ia/extrair-arquivo', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao extrair imagem')
        appendTexto(data.conteudo, nome)
        atualizarArquivo(id, { status: 'concluido' })
        return
      }

      // PDF
      if (tipo === 'application/pdf' || ext === 'pdf') {
        atualizarArquivo(id, {
          status: 'erro',
          erro: 'PDF não pode ser lido automaticamente. Abra o PDF, selecione os dados e cole na caixa de texto.',
        })
        return
      }

      atualizarArquivo(id, { status: 'erro', erro: 'Formato não suportado. Use TXT, CSV, XLSX, XLS, PNG ou JPG.' })
    } catch (err) {
      atualizarArquivo(id, { status: 'erro', erro: err instanceof Error ? err.message : 'Erro ao processar.' })
    }
  }

  function handleFiles(list: FileList | File[]) {
    Array.from(list).forEach(f => processarArquivo(f))
  }

  function iconeArquivo(ext: string) {
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon className="h-3.5 w-3.5 text-purple-500" />
    if (['xlsx', 'xls', 'ods', 'csv', 'tsv'].includes(ext)) return <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
    return <FileText className="h-3.5 w-3.5 text-blue-500" />
  }

  return (
    <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      {/* Cabeçalho */}
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
      >
        <Table2 className="h-5 w-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Dados da Pesquisa (planilha)</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">
              Importante
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cole sua planilha ou faça upload — a IA usa estes números reais para escrever os Resultados
          </p>
        </div>
        {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {salvo && !salvando && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          {/* Textarea */}
          <textarea
            value={texto}
            onChange={e => handleTextoChange(e.target.value)}
            placeholder={
              'Cole os dados direto do Excel (selecione tudo → Ctrl+C → cole aqui) ou estatísticas já calculadas:\n\n' +
              'Ex (tabela):\nID  Grupo  Idade  Desfecho\n1   A      45     12,3\n2   B      52     8,7\n\n' +
              'Ex (estatísticas):\nN=200 | Grupo A: média=34,2 (DP=4,1) | Grupo B: média=26,7 (DP=5,3) | p<0,001'
            }
            className="w-full resize-none rounded-lg border bg-background/70 p-3 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            style={{ minHeight: 160 }}
          />

          {/* Zona de upload */}
          <div
            onDrop={e => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
            onDragOver={e => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors',
              arrastando ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-primary/5'
            )}
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Arraste ou clique para enviar <strong>Excel (.xlsx), CSV, TXT ou foto da tabela</strong>
            </span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".txt,.csv,.tsv,.xlsx,.xls,.ods,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {/* Lista de arquivos processados */}
          {arquivos.length > 0 && (
            <div className="space-y-1.5">
              {arquivos.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs rounded-lg border bg-background/60 px-3 py-2">
                  {iconeArquivo(a.ext)}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate block">{a.nome}</span>
                    {a.status === 'lendo' && <span className="text-muted-foreground">Lendo arquivo…</span>}
                    {a.status === 'extraindo' && <span className="text-muted-foreground">Extraindo dados com IA…</span>}
                    {a.status === 'concluido' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Dados adicionados</span>}
                    {a.status === 'erro' && <span className="text-amber-700 flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {a.erro}</span>}
                  </div>
                  {(a.status === 'lendo' || a.status === 'extraindo') && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  {(a.status === 'concluido' || a.status === 'erro') && (
                    <button onClick={() => setArquivos(prev => prev.filter(x => x.id !== a.id))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Botão analisar + nota */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              onClick={analisarComIA}
              disabled={analisando || texto.trim().length < 10}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                'bg-primary text-primary-foreground hover:opacity-90',
                (analisando || texto.trim().length < 10) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {analisando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando dados…</>
                : <><Brain className="h-4 w-4" /> Analisar dados com IA</>
              }
            </button>
            <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
              A IA interpreta sua planilha, calcula estatísticas e orienta você nesta seção.
            </p>
          </div>

          {/* Resultado da análise */}
          {analise && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Análise da IA
                </span>
                {analisando && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </div>
              <MarkdownText
                content={analise}
                className="text-sm text-foreground leading-relaxed space-y-1 [&_p]:my-0.5"
              />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            💡 A IA usa <strong>exatamente</strong> estes números ao gerar Resultados, Discussão e Conclusão — nunca inventa valores. Quanto mais dados reais, melhor o texto.
          </p>
        </div>
      )}
    </div>
  )
}
