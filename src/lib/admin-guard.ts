/**
 * Helper exclusivo de servidor para validar se o usuário corrente é admin.
 * Lança erro caso não seja.
 *
 * Regra: papel interno em `profiles.papel_sistema` (super_admin,
 * admin_operacional, admin_suporte). Caso não haja papel, cai no
 * fallback da RPC `has_role('admin')`.
 */
import { ADMIN_INTERNO } from "@/lib/auth-roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureAdmin(context: { supabase: any; userId: string }): Promise<void> {
  const { data: perfil } = await context.supabase
    .from("profiles")
    .select("papel_sistema")
    .eq("id", context.userId)
    .maybeSingle();
  const papel = perfil?.papel_sistema as string | null | undefined;
  if (papel && (ADMIN_INTERNO as string[]).includes(papel)) return;

  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}
