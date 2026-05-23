/**
 * lib/auth/is-admin.ts
 *
 * Verifica se um usuário autenticado tem permissão de administrador
 * consultando a coluna `is_admin` da tabela `profiles`.
 *
 * Substitui a abordagem anterior de comparar email hardcoded.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Retorna true se o usuário (pelo user.id) tiver is_admin = true no banco.
 * Usa o client passado para herdar o contexto de auth (RLS etc.).
 */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  return data?.is_admin === true
}
