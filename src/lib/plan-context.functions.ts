import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { resolvePlanId, isTrialExpired, efetivoPlanoId } from "@/lib/plan-gates";
import type { PlanId, PlanRecursos } from "@/config/plans";

export type PlanContext = {
  planoId: PlanId;
  planoNome: string;
  cortesia: boolean;
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
        .select("plano_config_id, trial_end, cortesia")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("condominios")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId),
    ]);

    const planoId = resolvePlanId(subRes.data?.plano_config_id ?? null);
    const cortesia = subRes.data?.cortesia === true;
    const planoEfetivo = PLANS[efetivoPlanoId(planoId, cortesia)];
    const plano = PLANS[planoId];
    const trialEndIso = subRes.data?.trial_end ?? null;

    return {
      planoId,
      planoNome: plano.nome,
      cortesia,
      recursos: planoEfetivo.recursos,
      condominiosMax: planoEfetivo.condomíniosMax,
      documentosMax: planoEfetivo.documentosMax,
      usuariosMax: planoEfetivo.usuariosMax,
      historicosDias: planoEfetivo.historicosDias,
      condominiosCount: condosRes.count ?? 0,
      trialEndIso,
      trialExpirado: cortesia ? false : isTrialExpired(planoId, trialEndIso),
    };
  });