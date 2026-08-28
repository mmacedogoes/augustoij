/**
 * Guard do módulo de Gestão de Contratos.
 *
 * Acesso: o usuário precisa ser dono do condomínio OU membro atribuído
 * (tabela `condominio_members`). Super admin tem leitura para suporte.
 * As policies de RLS já usam `is_condominio_member`, este guard apenas
 * antecipa a mensagem de erro e alimenta a UI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

/** Ids de condomínios que o usuário pode acessar (dono + membro). */
export async function condominiosAcessiveis(context: Ctx): Promise<string[]> {
  const [own, mem] = await Promise.all([
    context.supabase.from("condominios").select("id").eq("owner_id", context.userId),
    context.supabase.from("condominio_members").select("condominio_id").eq("user_id", context.userId),
  ]);
  const ids = new Set<string>();
  for (const r of (own.data ?? []) as { id: string }[]) ids.add(r.id);
  for (const r of (mem.data ?? []) as { condominio_id: string }[]) ids.add(r.condominio_id);
  return Array.from(ids);
}

export async function temAcessoCondominio(context: Ctx, condominioId: string): Promise<boolean> {
  const { data: condo } = await context.supabase
    .from("condominios")
    .select("owner_id")
    .eq("id", condominioId)
    .maybeSingle();
  if (condo?.owner_id === context.userId) return true;
  const { data: membro } = await context.supabase
    .from("condominio_members")
    .select("id")
    .eq("condominio_id", condominioId)
    .eq("user_id", context.userId)
    .maybeSingle();
  return !!membro;
}

/** Pode escrever (criar/editar/excluir) contratos deste condomínio? */
export async function podeEscreverContratos(context: Ctx, condominioId: string): Promise<boolean> {
  const { data: condo } = await context.supabase
    .from("condominios")
    .select("owner_id")
    .eq("id", condominioId)
    .maybeSingle();
  if (condo?.owner_id === context.userId) return true;
  const { data: membro } = await context.supabase
    .from("condominio_members")
    .select("papel, pode_gerenciar_contratos")
    .eq("condominio_id", condominioId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!membro) return false;
  return membro.papel === "dono_condominio" || membro.pode_gerenciar_contratos === true;
}

export async function ensureAcessoContratos(context: Ctx, condominioId?: string | null): Promise<void> {
  if (!context?.userId) throw new Error("Não autenticado");
  if (!condominioId) return;

  if (await temAcessoCondominio(context, condominioId)) return;
  const isSuper = await isSuperAdmin(context);
  if (!isSuper) throw new Error("Acesso negado: você não tem acesso a este condomínio.");
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
 * Painel consolidado da carteira: liberado para todos os usuários.
 * Os limites comerciais permanecem apenas na criação de contratos.
 */
export async function ensurePainelConsolidado(context: Ctx): Promise<void> {
  await ensureAcessoContratos(context);
}
