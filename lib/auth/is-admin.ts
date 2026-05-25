/**
 * lib/auth/is-admin.ts
 *
 * Verifica se o usuário logado é administrador pela lista de e-mails
 * definida na variável de ambiente ADMIN_EMAILS (separados por vírgula).
 *
 * Usar e-mail como critério é mais seguro do que coluna no banco —
 * nenhuma manipulação de dados concede acesso admin por engano.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// E-mails autorizados — defina ADMIN_EMAILS no .env.local / Vercel para adicionar mais
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? 'sandrodainez1@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
)

/**
 * Retorna true se o usuário autenticado (user.id) tiver e-mail na lista de admins.
 * Lê o e-mail diretamente da sessão Supabase Auth — nunca de uma coluna editável.
 */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return false
  return ADMIN_EMAILS.has((user.email ?? '').toLowerCase())
}
