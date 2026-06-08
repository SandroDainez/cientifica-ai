import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Limite de 'gerar-secao' por minuto (espelha LIMITES em lib/auth/rate-limit.ts —
// não importável pois LIMITES não é exportado; mantido em sincronia manualmente).
const LIMITE_GERAR_SECAO = 8

/**
 * Consulta o uso atual SEM consumir o limite. Diferente de checkRateLimit (que
 * INCREMENTA via RPC), aqui apenas LEMOS o contador da janela atual — assim o
 * indicador nunca gasta gerações do usuário.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const windowStart = new Date()
  windowStart.setSeconds(0, 0)
  const resetAt = new Date(windowStart.getTime() + 60_000)

  const { data } = await supabase
    .from('rate_limits')
    .select('request_count')
    .eq('user_id', user.id)
    .eq('endpoint', 'gerar-secao')
    .eq('window_start', windowStart.toISOString())
    .maybeSingle()

  const count = (data?.request_count as number | undefined) ?? 0

  return NextResponse.json({
    allowed: count < LIMITE_GERAR_SECAO,
    resetAt: resetAt.toISOString(),
  })
}
