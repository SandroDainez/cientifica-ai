// ============================================================
// CIENTÍFICA AI — Serviço de Revisão Iterativa por IA
// ============================================================
// SERVER-SIDE ONLY. Usa um provider/modelo DEDICADO à revisão (separado da
// geração), configurado por variáveis de ambiente. Nunca expõe chaves: lê
// process.env apenas no servidor, dentro da criação do cliente.

import OpenAI from 'openai'
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from './reviewPrompt'
import { callAI } from './stream'
import { HUMANIZADOR_SYSTEM, buildHumanizadorPrompt } from './humanizar'
import { corrigirCodigoR, corrigirCodigoPython } from './utils'
import { removerTravessoes } from './validar-citacoes'
import { converterMathLatexParaTexto } from '@/lib/formatacao/latex'

// ── Configuração (env) ───────────────────────────────────────────────────────
const REVIEW_AI_PROVIDER = (process.env.REVIEW_AI_PROVIDER || 'claude') as 'claude' | 'openai'
const REVIEW_AI_MODEL = process.env.REVIEW_AI_MODEL || 'claude-sonnet-4-20250514'
const REVIEW_MAX_ITERATIONS = Number.parseInt(process.env.REVIEW_MAX_ITERATIONS || '3', 10)
const REVIEW_MIN_SCORE = Number.parseInt(process.env.REVIEW_MIN_SCORE || '80', 10)
const REVIEW_MAX_TOKENS_INPUT = Number.parseInt(process.env.REVIEW_MAX_TOKENS_INPUT || '12000', 10)

// ── Tipos do resultado de revisão (espelham o JSON do prompt) ────────────────
export interface ReviewChecklist {
  coerencia_objetivos: boolean
  linguagem_adequada: boolean
  estrutura_completa: boolean
  citacoes_com_suporte: boolean
  referencias_verificadas: boolean
  sem_contradicoes: boolean
}
export interface ReviewProblema {
  categoria: 'linguagem' | 'estrutura' | 'citacao' | 'referencia' | 'coerencia' | 'formatacao'
  gravidade: 'baixa' | 'media' | 'alta' | 'critica'
  trecho: string
  problema: string
  sugestao: string
  impacto_estimado: number
}
export interface ReviewReferenciaSuspeita {
  referencia: string
  problema: string
  acao_recomendada: 'verificar' | 'remover' | 'corrigir_contexto'
}
export interface ReviewResult {
  nota_estimada: number
  status: 'aprovado' | 'precisa_corrigir' | 'critico'
  resumo_geral: string
  checklist: ReviewChecklist
  problemas_encontrados: ReviewProblema[]
  referencias_suspeitas: ReviewReferenciaSuspeita[]
  precisa_nova_iteracao: boolean
  motivo_nova_iteracao: string
  versao_corrigida: string
}

export interface ReviewParams {
  trabalho: string
  tipo: string
  tema: string
  area: string
  normas: string
  idioma: string
}

export interface IterativeReviewData {
  historico: ReviewResult[]
  versaoFinal: string
  iteracoes: number
}

// ── Erro tipado (nunca quebra silenciosamente) ───────────────────────────────
export type ReviewErrorCode =
  | 'CONFIG_ERROR'      // provider/key ausente
  | 'INPUT_TOO_LARGE'   // texto excede o limite
  | 'API_ERROR'         // falha na chamada da IA
  | 'PARSE_ERROR'       // resposta não é JSON válido

export type ReviewOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; codigo: ReviewErrorCode; error: string }

// ── Extração robusta do objeto JSON (ignora ```json e texto ao redor) ────────
export function extrairJsonObjeto(texto: string): unknown | null {
  if (!texto) return null
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = limpo.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < limpo.length; i++) {
    const ch = limpo[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(limpo.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

export class ReviewService {
  private _client: OpenAI | null = null

  /** Cria o cliente DEDICADO da revisão (lazy, server-side). */
  private getClient(): ReviewOutcome<OpenAI> {
    if (this._client) return { ok: true, data: this._client }
    if (REVIEW_AI_PROVIDER === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return { ok: false, codigo: 'CONFIG_ERROR', error: 'OPENAI_API_KEY ausente para a revisão.' }
      this._client = new OpenAI({ apiKey })
      return { ok: true, data: this._client }
    }
    // claude (Anthropic via endpoint OpenAI-compatible) com chave DEDICADA
    const apiKey = process.env.REVIEW_ANTHROPIC_API_KEY
    if (!apiKey) return { ok: false, codigo: 'CONFIG_ERROR', error: 'REVIEW_ANTHROPIC_API_KEY ausente para a revisão.' }
    this._client = new OpenAI({ apiKey, baseURL: 'https://api.anthropic.com/v1' })
    return { ok: true, data: this._client }
  }

  /** Chamada única à IA de revisão (analyze ou analyzeAndCorrect). */
  private async callReview(params: ReviewParams, solicitarCorrecao: boolean): Promise<ReviewOutcome<ReviewResult>> {
    // Req. 7: valida o tamanho ANTES de enviar (estimativa grosseira ~4 chars/token).
    const limiteChars = REVIEW_MAX_TOKENS_INPUT * 4
    if ((params.trabalho?.length ?? 0) > limiteChars) {
      return {
        ok: false,
        codigo: 'INPUT_TOO_LARGE',
        error: `Trabalho excede o limite de ~${REVIEW_MAX_TOKENS_INPUT} tokens (${limiteChars} caracteres). Revise por partes.`,
      }
    }

    const clienteOut = this.getClient()
    if (!clienteOut.ok) return clienteOut
    const client = clienteOut.data

    const userPrompt = buildReviewUserPrompt({ ...params, solicitarCorrecao })

    try {
      const completion = await client.chat.completions.create({
        model: REVIEW_AI_MODEL,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        // Correção devolve o texto completo → precisa de mais tokens de saída.
        max_tokens: solicitarCorrecao ? 16000 : 4096,
      })
      const conteudo = completion.choices[0]?.message?.content ?? ''
      const json = extrairJsonObjeto(conteudo)
      if (!json || typeof json !== 'object') {
        return { ok: false, codigo: 'PARSE_ERROR', error: 'A revisão não retornou JSON válido.' }
      }
      return { ok: true, data: json as ReviewResult }
    } catch (err) {
      return {
        ok: false,
        codigo: 'API_ERROR',
        error: err instanceof Error ? err.message : 'Falha na chamada à IA de revisão.',
      }
    }
  }

  /** Apenas analisa (sem versao_corrigida). */
  analyze(params: ReviewParams): Promise<ReviewOutcome<ReviewResult>> {
    return this.callReview(params, false)
  }

  /** Analisa E retorna o texto corrigido em versao_corrigida. */
  analyzeAndCorrect(params: ReviewParams): Promise<ReviewOutcome<ReviewResult>> {
    return this.callReview(params, true)
  }

  /**
   * Re-humaniza a versão final corrigida (MESMO humanizador da geração) + limpeza
   * leve (código R/Python, LaTeX, travessões), para que as correções do revisor
   * não deixem o texto mecânico/detectável por verificadores de IA. NÃO valida
   * citações aqui (não há lista de referências nesta camada) — o humanizador já
   * preserva as citações verbatim. `protected` para permitir teste sem chamar a API.
   */
  protected async humanizarVersaoFinal(texto: string): Promise<string> {
    try {
      const out = await callAI(HUMANIZADOR_SYSTEM, buildHumanizadorPrompt(texto), false, 8000)
      const humanizado = out && out.trim().length >= 100 ? out : texto
      let limpo = corrigirCodigoR(humanizado)
      limpo = corrigirCodigoPython(limpo)
      limpo = converterMathLatexParaTexto(limpo)
      limpo = removerTravessoes(limpo)
      return limpo
    } catch {
      return texto // falha na humanização não quebra o fluxo: mantém a versão corrigida
    }
  }

  /**
   * Loop de revisão iterativa:
   *  analisa → se nota < REVIEW_MIN_SCORE e iterações < REVIEW_MAX_ITERATIONS:
   *  corrige, substitui o trabalho pela versão corrigida, repete.
   * Para qualquer falha de API/parse, retorna o erro tipado (não quebra).
   */
  async runIterativeReview(params: ReviewParams): Promise<ReviewOutcome<IterativeReviewData>> {
    const historico: ReviewResult[] = []
    let trabalhoAtual = params.trabalho
    let iteracoes = 0

    while (true) {
      const analise = await this.analyze({ ...params, trabalho: trabalhoAtual })
      if (!analise.ok) return analise
      historico.push(analise.data)

      const notaOk = analise.data.nota_estimada >= REVIEW_MIN_SCORE
      if (notaOk || iteracoes >= REVIEW_MAX_ITERATIONS) break

      const corrigida = await this.analyzeAndCorrect({ ...params, trabalho: trabalhoAtual })
      if (!corrigida.ok) return corrigida
      historico.push(corrigida.data)
      iteracoes++

      const nova = corrigida.data.versao_corrigida?.trim()
      if (!nova) break // sem correção aplicável → encerra
      trabalhoAtual = nova
    }

    // Passagem final: re-humaniza o texto CORRIGIDO (só quando houve correção),
    // para o trabalho final não ser detectado como gerado por IA.
    let versaoFinal = trabalhoAtual
    if (iteracoes > 0 && versaoFinal !== params.trabalho) {
      versaoFinal = await this.humanizarVersaoFinal(versaoFinal)
    }

    return { ok: true, data: { historico, versaoFinal, iteracoes } }
  }
}

/** Instância pronta para uso nas rotas (server-side). */
export const reviewService = new ReviewService()
