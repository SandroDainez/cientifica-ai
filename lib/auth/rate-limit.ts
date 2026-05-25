/**
 * lib/auth/rate-limit.ts
 *
 * Rate limiting por usuário + endpoint usando a tabela `rate_limits` do Supabase.
 * Janela deslizante de 1 minuto — sem serviço externo necessário.
 * O incremento é atômico via RPC `increment_rate_limit` (evita race conditions).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const LIMITES: Record<string, number> = {
  'gerar-secao':            8,
  'chat':                  20,
  'validar-secao':         10,
  'sugerir-melhorias':     10,
  'relatorio-qualidade':    5,
  'gerar-referencias':      5,
  'gerar-resumo':           8,
  'gerar-tcle':             5,
  'gerar-estrategia-busca': 5,
  'gerar-questionario':     8,
  'planejar-projeto':       3,
  'gerar-documento':        5,
}

const LIMITE_PADRAO = 15

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   Date
}

/**
 * Verifica e incrementa o contador de requisições para o endpoint.
 * Retorna { allowed: false } se o limite por minuto foi atingido.
 *
 * Em caso de erro de infra (DB indisponível etc.), libera a requisição
 * para não impactar usuários por problemas internos.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
): Promise<RateLimitResult> {
  const limite = LIMITES[endpoint] ?? LIMITE_PADRAO

  // Janela atual: trunca ao minuto
  const windowStart = new Date()
  windowStart.setSeconds(0, 0)
  const resetAt = new Date(windowStart.getTime() + 60_000)

  try {
    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_user_id:      userId,
      p_endpoint:     endpoint,
      p_window_start: windowStart.toISOString(),
    })

    if (error) throw error

    const count = data as number
    return {
      allowed:   count <= limite,
      remaining: Math.max(0, limite - count),
      resetAt,
    }
  } catch (err) {
    // Falha silenciosa: permite a requisição para não bloquear usuários
    console.error('[rate-limit] Erro ao verificar limite:', err)
    return { allowed: true, remaining: limite, resetAt }
  }
}
