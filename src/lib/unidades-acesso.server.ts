import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAcessoCondominio(
  supabase: SupabaseClient,
  userId: string,
  condominioId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("condominios")
    .select("id, owner_id")
    .eq("id", condominioId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Condomínio não encontrado.");
  if (data.owner_id === userId) return;
  const { data: vinculo } = await supabaseAdmin
    .from("condominio_members")
    .select("id")
    .eq("condominio_id", condominioId)
    .eq("user_id", userId)
    .maybeSingle();
  if (vinculo) return;
  const { isDonoDoAmbienteDoCondominio } = await import("@/lib/conta-master.server");
  if (await isDonoDoAmbienteDoCondominio(userId, condominioId)) return;
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!admin) throw new Error("Sem permissão para este condomínio.");
}