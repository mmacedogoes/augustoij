import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { PLANOS, type PlanoId as PlanoIdV2 } from "@/config/planos";
import { resolvePlanId, isTrialExpired, efetivoPlanoId } from "@/lib/plan-gates";
import { isAdminInternoServer } from "@/lib/admin-bypass";
import type { PlanId, PlanRecursos } from "@/config/plans";

export type PlanContext = {
  planoId: PlanId;
  planoNome: string;
  cortesia: boolean;
  status: string;
  recursos: PlanRecursos;
  condominiosMax: number | null;
  documentosMax: number | null;
  usuariosMax: number | null;
  historicosDias: number | null;
  condominiosCount: number;
  trialEndIso: string | null;
  trialExpirado: boolean;
  /** Limites derivados de src/config/planos.ts (fonte única de verdade). */
  contratosGestaoAtivaMax: number | null;
  contratosGestaoAtivaCount: number;
  documentosIlimitados: boolean;
  painelConsolidado: boolean;
  analisesContratoMax: number | null;
  analisesContratoUsadas: number;
};

/**
 * Contexto de plano do usuário logado — usado por hooks/gates no cliente
 * e como espelho leve do que o servidor reforça em cada action.
 */
export const getPlanContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanContext> => {
    const { supabase, userId } = context;
    const [subRes, condosRes, contratosRes, analisesRes, admin] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plano_config_id, trial_end, cortesia, status")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("condominios")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId),
      supabase
        .from("contratos_servico")
        .select("id, condominios!inner(owner_id)", { count: "exact", head: true })
        .eq("condominios.owner_id", userId)
        .eq("situacao", "ativo"),
      supabase
        .from("contratos_servico")
        .select("id, condominios!inner(owner_id)", { count: "exact", head: true })
        .eq("condominios.owner_id", userId)
        .not("analise_em", "is", null),
      isAdminInternoServer(supabase, userId),
    ]);

    const planoId = resolvePlanId(subRes.data?.plano_config_id ?? null);
    const cortesia = subRes.data?.cortesia === true || admin;
    const planoEfetivo = PLANS[efetivoPlanoId(planoId, cortesia)];
    const plano = PLANS[planoId];
    const planoV2Id = (planoId as string) in PLANOS ? (planoId as PlanoIdV2) : "gratuito";
    const planoV2Efetivo = cortesia ? PLANOS.personalizado : PLANOS[planoV2Id];
    const trialEndIso = subRes.data?.trial_end ?? null;

    return {
      planoId,
      planoNome: plano.nome,
      cortesia,
      status: subRes.data?.status ?? "active",
      recursos: planoEfetivo.recursos,
      condominiosMax: planoEfetivo.condomíniosMax,
      documentosMax: planoEfetivo.documentosMax,
      usuariosMax: planoEfetivo.usuariosMax,
      historicosDias: planoEfetivo.historicosDias,
      condominiosCount: condosRes.count ?? 0,
      trialEndIso,
      trialExpirado: cortesia ? false : isTrialExpired(planoId, trialEndIso),
      contratosGestaoAtivaMax: planoV2Efetivo.limites.contratosGestaoAtiva,
      contratosGestaoAtivaCount: contratosRes.count ?? 0,
      documentosIlimitados: planoV2Efetivo.limites.documentosIlimitados === true,
      painelConsolidado: planoV2Efetivo.recursos.painelConsolidado === true,
      analisesContratoMax: planoV2Efetivo.limites.analisesContrato,
      analisesContratoUsadas: analisesRes.count ?? 0,
    };
  });