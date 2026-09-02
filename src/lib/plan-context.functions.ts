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
    const { getSubscriptionEfetiva, condominiosDoAmbiente } = await import(
      "@/lib/conta-master.server"
    );
    const ambiente = await condominiosDoAmbiente(userId);
    const ambienteIds = ambiente.map((c) => c.id);
    const [sub, contratosRes, analisesRes, admin] = await Promise.all([
      getSubscriptionEfetiva(userId),
      ambienteIds.length
        ? supabase
            .from("contratos_servico")
            .select("id", { count: "exact", head: true })
            .in("condominio_id", ambienteIds)
            .eq("situacao", "ativo")
        : Promise.resolve({ count: 0 }),
      ambienteIds.length
        ? supabase
            .from("contratos_servico")
            .select("id", { count: "exact", head: true })
            .in("condominio_id", ambienteIds)
            .not("analise_em", "is", null)
        : Promise.resolve({ count: 0 }),
      isAdminInternoServer(supabase, userId),
    ]);


    const planoId = resolvePlanId(sub?.plano_config_id ?? null);
    const cortesia = sub?.cortesia === true || admin;
    const planoEfetivo = PLANS[efetivoPlanoId(planoId, cortesia)];
    const plano = PLANS[planoId];
    const planoV2Id = (planoId as string) in PLANOS ? (planoId as PlanoIdV2) : "gratuito";
    const planoV2Efetivo = cortesia ? PLANOS.personalizado : PLANOS[planoV2Id];
    const trialEndIso = sub?.trial_end ?? null;

    const custom = (planoId === "personalizado" && sub?.custom_limits) ? sub.custom_limits : null;

    const condominiosMax = custom?.condominiosMax !== undefined ? custom.condominiosMax : planoEfetivo.condomíniosMax;
    const usuariosMax = custom?.usuariosMax !== undefined ? custom.usuariosMax : planoEfetivo.usuariosMax;
    const contratosGestaoAtivaMax = custom?.contratosGestaoAtiva !== undefined ? custom.contratosGestaoAtiva : planoV2Efetivo.limites.contratosGestaoAtiva;
    const documentosMax = custom?.documentosMax !== undefined ? custom.documentosMax : planoEfetivo.documentosMax;

    const recursos: PlanRecursos = {
      ...planoEfetivo.recursos,
      ...(custom?.minutasAtaConvencao !== undefined ? { minutasAtaConvencao: custom.minutasAtaConvencao } : {}),
      ...(custom?.relatoriosPorCondominio !== undefined ? { relatoriosPorCondominio: custom.relatoriosPorCondominio } : {}),
      ...(custom?.suportePrioritario !== undefined ? { suportePrioritario: custom.suportePrioritario } : {}),
    };

    return {
      planoId,
      planoNome: plano.nome,
      cortesia,
      status: sub?.status ?? "active",
      recursos,
      condominiosMax,
      documentosMax,
      usuariosMax,
      historicosDias: planoEfetivo.historicosDias,
      condominiosCount: ambiente.length,
      trialEndIso,
      trialExpirado: cortesia ? false : isTrialExpired(planoId, trialEndIso),
      contratosGestaoAtivaMax,
      contratosGestaoAtivaCount: contratosRes.count ?? 0,
      documentosIlimitados: documentosMax === null || planoV2Efetivo.limites.documentosIlimitados === true,
      painelConsolidado: custom?.painelConsolidado !== undefined ? custom.painelConsolidado : (planoV2Efetivo.recursos.painelConsolidado === true),
      analisesContratoMax: planoV2Efetivo.limites.analisesContrato,
      analisesContratoUsadas: analisesRes.count ?? 0,
    };
  });