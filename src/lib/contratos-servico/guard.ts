/**
 * Guard do módulo de Gestão de Contratos.
 *
 * Acesso: qualquer usuário autenticado. A restrição por dono do condomínio
 * é garantida pelas policies de RLS (owner do condomínio ou super admin
 * leitura). Também expõe helper para saber se o usuário é super admin,
 * usado para modo somente-leitura na UI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureAcessoContratos(context: { supabase: any; userId: string }): Promise<void> {
  if (!context?.userId) throw new Error("Não autenticado");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isSuperAdmin(context: { supabase: any; userId: string }): Promise<boolean> {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("papel_sistema")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) return false;
  return data?.papel_sistema === "super_admin";
}