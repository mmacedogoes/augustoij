/**
 * Conta master (empresa) de um usuário.
 *
 * Usuários vinculados (criados pelo dono da conta) não possuem assinatura
 * própria: eles herdam o plano da conta master. Este helper resolve isso
 * de forma centralizada, sempre no servidor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SubscriptionEfetiva = {
  plano_config_id: string | null;
  trial_end: string | null;
  cortesia: boolean | null;
  status: string | null;
  /** Usuário cuja assinatura foi utilizada (o próprio ou a conta master). */
  origem_user_id: string;
};

export async function getContaMasterId(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("condominio_members")
    .select("criado_por, created_at")
    .eq("user_id", userId)
    .not("criado_por", "is", null)
    .neq("criado_por", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.criado_por as string | undefined) ?? userId;
}

async function lerSub(userId: string) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("plano_config_id, trial_end, cortesia, status")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Assinatura efetiva: a do próprio usuário quando existe; caso contrário,
 * a da conta master à qual ele está vinculado.
 */
export async function getSubscriptionEfetiva(
  userId: string,
): Promise<SubscriptionEfetiva | null> {
  const propria = await lerSub(userId);
  if (propria?.plano_config_id) return { ...propria, origem_user_id: userId };
  const masterId = await getContaMasterId(userId);
  if (masterId === userId) return propria ? { ...propria, origem_user_id: userId } : null;
  const doMaster = await lerSub(masterId);
  if (!doMaster) return propria ? { ...propria, origem_user_id: userId } : null;
  return { ...doMaster, origem_user_id: masterId };
}

/** Ids dos usuários que compõem o ambiente de trabalho da conta master. */
export async function usuariosDoAmbiente(userId: string): Promise<string[]> {
  const masterId = await getContaMasterId(userId);
  const { data } = await supabaseAdmin
    .from("condominio_members")
    .select("user_id")
    .eq("criado_por", masterId);
  const ids = new Set<string>([masterId]);
  for (const r of (data ?? []) as Array<{ user_id: string }>) ids.add(r.user_id);
  return Array.from(ids);
}

/** Todos os condomínios do ambiente (independentemente de quem cadastrou). */
export async function condominiosDoAmbiente(
  userId: string,
): Promise<Array<{ id: string; nome: string }>> {
  const users = await usuariosDoAmbiente(userId);
  const { data } = await supabaseAdmin
    .from("condominios")
    .select("id, nome")
    .in("owner_id", users)
    .order("nome", { ascending: true });
  return (data ?? []) as Array<{ id: string; nome: string }>;
}

/**
 * Condomínios que o usuário efetivamente acessa: os que ele cadastrou mais
 * aqueles em que possui vínculo (o dono pode restringir removendo o vínculo).
 */
export async function condominiosAcessiveisIds(userId: string): Promise<string[]> {
  const [proprios, vinculos] = await Promise.all([
    supabaseAdmin.from("condominios").select("id").eq("owner_id", userId),
    supabaseAdmin.from("condominio_members").select("condominio_id").eq("user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const r of (proprios.data ?? []) as Array<{ id: string }>) ids.add(r.id);
  for (const r of (vinculos.data ?? []) as Array<{ condominio_id: string }>) ids.add(r.condominio_id);
  return Array.from(ids);
}

/** True quando o usuário é a conta dona do ambiente ao qual o condomínio pertence. */
export async function isDonoDoAmbienteDoCondominio(
  userId: string,
  condominioId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("condominios")
    .select("owner_id")
    .eq("id", condominioId)
    .maybeSingle();
  if (!data) return false;
  const master = await getContaMasterId((data as { owner_id: string }).owner_id);
  return master === userId;
}
