/**
 * Guard do módulo de Gestão de Contratos.
 *
 * Acesso: o usuário precisa ser dono do condomínio OU membro atribuído
 * (tabela `condominio_members`). Super admin tem leitura para suporte.
 * As policies de RLS já usam `is_condominio_member`, este guard apenas
 * antecipa a mensagem de erro e alimenta a UI.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { condominiosAcessiveisIds } from "@/lib/conta-master.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

/** Ids de condomínios que o usuário pode acessar (dono + membro + conta master). */
export async function condominiosAcessiveis(context: Ctx): Promise<string[]> {
  if (!context?.userId) return [];
  const { sincronizarCarteiraMarceloSeNecessario } = await import("@/lib/seed-versari.server");
  await sincronizarCarteiraMarceloSeNecessario(context.userId).catch(() => {});
  return condominiosAcessiveisIds(context.userId);
}

export async function temAcessoCondominio(context: Ctx, condominioId: string): Promise<boolean> {
  if (!context?.userId || !condominioId) return false;
  const { data: condo } = await supabaseAdmin
    .from("condominios")
    .select("owner_id")
    .eq("id", condominioId)
    .maybeSingle();
  if (condo?.owner_id === context.userId) return true;
  const { data: membro } = await supabaseAdmin
    .from("condominio_members")
    .select("id")
    .eq("condominio_id", condominioId)
    .eq("user_id", context.userId)
    .maybeSingle();
  return !!membro;
}

/** Pode escrever (criar/editar/excluir) contratos deste condomínio? */
export async function podeEscreverContratos(context: Ctx, condominioId: string): Promise<boolean> {
  if (!context?.userId || !condominioId) return false;
  const { data: condo } = await supabaseAdmin
    .from("condominios")
    .select("owner_id")
    .eq("id", condominioId)
    .maybeSingle();
  if (condo?.owner_id === context.userId) return true;
  const { data: membro } = await supabaseAdmin
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
  if (!context?.userId) return false;
  const { data, error } = await supabaseAdmin
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
