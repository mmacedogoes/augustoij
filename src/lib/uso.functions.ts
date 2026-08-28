import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanId } from "@/config/plans";
import type { UsoAtual } from "@/lib/uso-limits";

/**
 * Retorna o uso atual do usuário (mensagens do mês, do dia, plano, trial).
 * Usado pelo ChatPanel para exibir o rodapé e para o modal de upgrade.
 * O `/api/chat` faz a MESMA checagem no servidor via SQL direto.
 */
export const getUsoAtual = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsoAtual> => {
    const { supabase, userId } = context;

    // Data/mês corrente no fuso America/Sao_Paulo (mesmo do trigger)
    const nowSp = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
    );
    const mesAno = `${nowSp.getFullYear()}-${String(nowSp.getMonth() + 1).padStart(2, "0")}`;
    const dia = `${mesAno}-${String(nowSp.getDate()).padStart(2, "0")}`;
    // Primeiro dia do próximo mês, 00:00 SP → devolvemos como ISO absoluto
    const proximoMes = new Date(Date.UTC(nowSp.getFullYear(), nowSp.getMonth() + 1, 1, 3, 0, 0));
    const resetMesIso = proximoMes.toISOString();

    const { getSubscriptionEfetiva } = await import("@/lib/conta-master.server");
    const [sub, mensalRes, diarioRes] = await Promise.all([
      getSubscriptionEfetiva(userId),
      supabase
        .from("uso_mensal")
        .select("total_mensagens")
        .eq("user_id", userId)
        .eq("mes_ano", mesAno)
        .maybeSingle(),
      supabase
        .from("uso_diario")
        .select("total_mensagens")
        .eq("user_id", userId)
        .eq("dia", dia)
        .maybeSingle(),
    ]);

    const rawPlano = (sub?.plano_config_id ?? "gratuito") as string;
    const planoId = (rawPlano in PLANS ? rawPlano : "gratuito") as PlanId;
    const cortesia = sub?.cortesia === true;
    // Cortesia usa limites do plano Personalizado (ilimitado em tudo)
    const planoEfetivo = cortesia ? PLANS.personalizado : PLANS[planoId];
    const plano = PLANS[planoId];

    const trialFimIso = sub?.trial_end ?? null;
    let diasRestantesTrial: number | null = null;
    let trialExpirado = false;
    if (planoId === "gratuito" && trialFimIso) {
      const diffMs = new Date(trialFimIso).getTime() - Date.now();
      diasRestantesTrial = Math.max(0, Math.floor(diffMs / 86_400_000));
      trialExpirado = diffMs <= 0;
    }

    return {
      planoId,
      planoNome: plano.nome,
      cortesia,
      mensagensMes: mensalRes.data?.total_mensagens ?? 0,
      mensagensDia: diarioRes.data?.total_mensagens ?? 0,
      limiteMes: planoEfetivo.mensagensPorMes,
      limiteDia: planoEfetivo.mensagensPorDia,
      resetMesIso,
      trialFimIso,
      diasRestantesTrial,
      trialExpirado: cortesia ? false : trialExpirado,
    };
  });