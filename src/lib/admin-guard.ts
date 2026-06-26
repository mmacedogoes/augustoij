/**
 * Helper exclusivo de servidor para validar se o usuário corrente é admin.
 * Lança erro caso não seja.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureAdmin(context: { supabase: any; userId: string }): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}