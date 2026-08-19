/**
 * Guard do módulo de Gestão de Contratos.
 *
 * Acesso: qualquer usuário autenticado. A restrição por dono do condomínio
 * é garantida pelas policies de RLS (owner do condomínio ou super admin
 * leitura). Também expõe helper para saber se o usuário é super admin,
 * usado para modo somente-leitura na UI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureAcessoContratos(context: { supabase: any; userId: string }, condominioId?: string | null): Promise<void> {
  if (!context?.userId) throw new Error("Não autenticado");
  if (!condominioId) return;

  const { data: condo } = await context.supabase
    .from("condominios")
    .select("owner_id")
    .eq("id", condominioId)
    .maybeSingle();

  if (condo && condo.owner_id !== context.userId) {
    const isSuper = await isSuperAdmin(context);
    if (!isSuper) throw new Error("Acesso negado: condomínio não pertence ao usuário.");
  }
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

/**
 * Painel consolidado da carteira: disponível a partir do plano Gestão
 * (ou para contas em cortesia / admin interno).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensurePainelConsolidado(context: { supabase: any; userId: string }): Promise<void> {
  await ensureAcessoContratos(context);
  const { PLANOS } = await import("@/config/planos");
  const { isAdminInternoServer } = await import("@/lib/admin-bypass");
  const [{ data }, admin] = await Promise.all([
    context.supabase
      .from("subscriptions")
      .select("plano_config_id, cortesia")
      .eq("user_id", context.userId)
      .maybeSingle(),
    isAdminInternoServer(context.supabase, context.userId),
  ]);
  if (admin || data?.cortesia === true) return;
  const planoId = (data?.plano_config_id ?? "gratuito") as keyof typeof PLANOS;
  const plano = PLANOS[planoId] ?? PLANOS.gratuito;
  if (plano.recursos.painelConsolidado !== true) {
    throw new Error("O painel consolidado da carteira está disponível a partir do plano Gestão.");
  }
}