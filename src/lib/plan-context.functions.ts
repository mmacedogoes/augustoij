import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { resolvePlanId, isTrialExpired } from "@/lib/plan-gates";
import type { PlanId, PlanRecursos } from "@/config/plans";

export type PlanContext = {
  planoId: PlanId;
  planoNome: string;
  recursos: PlanRecursos;
  condominiosMax: number | null;
  documentosMax: number | null;
  usuariosMax: number | null;
  historicosDias: number | null;
  condominiosCount: number;
  trialEndIso: string | null;
  trialExpirado: boolean;
};

/**
 * Contexto de plano do usuário logado — usado por hooks/gates no cliente
 * e como espelho leve do que o servidor reforça em cada action.
 */
export const getPlanContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanContext> => {
    const { supabase, userId } = context;
    const [subRes, condosRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plano_config_id, trial_end")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("condominios")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId),
    ]);

    const planoId = resolvePlanId(subRes.data?.plano_config_id ?? null);
    const plano = PLANS[planoId];
    const trialEndIso = subRes.data?.trial_end ?? null;

    return {
      planoId,
      planoNome: plano.nome,
      recursos: plano.recursos,
      condominiosMax: plano.condomíniosMax,
      documentosMax: plano.documentosMax,
      usuariosMax: plano.usuariosMax,
      historicosDias: plano.historicosDias,
      condominiosCount: condosRes.count ?? 0,
      trialEndIso,
      trialExpirado: isTrialExpired(planoId, trialEndIso),
    };
  });