/**
 * Bypass total de limites para usuários com papel interno de admin
 * (super_admin, admin_operacional, admin_suporte).
 *
 * O papel é consultado em `profiles.papel_sistema` e, quando bate com
 * a lista de admins internos, o usuário é tratado como se tivesse
 * `subscriptions.cortesia = true` — ou seja, plano Personalizado sem
 * qualquer teto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_INTERNO } from "@/lib/auth-roles";

export async function isAdminInternoServer(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("papel_sistema")
    .eq("id", userId)
    .maybeSingle();
  const papel = data?.papel_sistema as (typeof ADMIN_INTERNO)[number] | null | undefined;
  return !!papel && (ADMIN_INTERNO as string[]).includes(papel);
}