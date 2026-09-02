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
  custom_limits?: {
    condominiosMax?: number | null;
    usuariosMax?: number | null;
    mensagensPorMes?: number | null;
    contratosGestaoAtiva?: number | null;
    documentosMax?: number | null;
    minutasAtaConvencao?: boolean;
    painelConsolidado?: boolean;
    relatoriosPorCondominio?: boolean;
    suportePrioritario?: boolean;
  } | null;
  custom_preco?: number | null;
  custom_ciclo?: string | null;
  custom_billing_type?: string | null;
  asaas_subscription_id?: string | null;
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
    .select("plano_config_id, trial_end, cortesia, cortesia_observacao, status, asaas_subscription_id, asaas_ciclo, asaas_billing_type")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;

  let custom_limits = undefined;
  let custom_preco = undefined;
  let custom_ciclo = data.asaas_ciclo === "YEARLY" ? "anual" : "mensal";
  let custom_billing_type = data.asaas_billing_type;

  if (data.cortesia_observacao && data.cortesia_observacao.startsWith("{")) {
    try {
      const parsed = JSON.parse(data.cortesia_observacao);
      if (parsed.custom_limits) custom_limits = parsed.custom_limits;
      if (parsed.custom_preco !== undefined) custom_preco = parsed.custom_preco;
      if (parsed.custom_ciclo) custom_ciclo = parsed.custom_ciclo;
      if (parsed.custom_billing_type) custom_billing_type = parsed.custom_billing_type;
    } catch {}
  }

  return {
    ...data,
    custom_limits,
    custom_preco,
    custom_ciclo,
    custom_billing_type,
  };
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
