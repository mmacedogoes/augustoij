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
