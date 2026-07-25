/**
 * Guard exclusivo do módulo de Contratos de Prestação de Serviços.
 * Fase 1: acesso restrito ao super-admin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureAcessoContratos(context: { supabase: any; userId: string }): Promise<void> {
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