/**
 * Guard exclusivo para o módulo "Administração de Imóveis".
 * Só usuários com papel_sistema = 'super_admin' podem acessar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureSuperAdmin(context: { supabase: any; userId: string }): Promise<void> {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("papel_sistema")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.papel_sistema !== "super_admin") {
    throw new Error("Acesso restrito ao super admin");
  }
}