import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { resolvePlanId, isTrialExpired, gateMessages, efetivoPlanoId } from "@/lib/plan-gates";
import { isAdminInternoServer } from "@/lib/admin-bypass";

export const listCondominios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("condominios")
      .select("id, nome, cnpj, uf, qtd_unidades, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const createSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  cnpj: z.string().trim().max(20).optional().nullable(),
  endereco: z.string().trim().max(255).optional().nullable(),
  uf: z.string().trim().length(2).optional().nullable(),
  qtd_unidades: z.number().int().min(0).max(100000).optional().nullable(),
  categoria: z
    .enum(["predio", "casas", "salas_comerciais", "shopping", "galpoes"])
    .optional(),
});

export const createCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    // ---- Gate por plano (bloqueio no servidor) ----
    const [subRes, countRes, admin] = await Promise.all([
      context.supabase
        .from("subscriptions")
        .select("plano_config_id, trial_end, cortesia")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("condominios")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", context.userId),
      isAdminInternoServer(context.supabase, context.userId),
    ]);
    const planoBruto = resolvePlanId(subRes.data?.plano_config_id ?? null);
    const cortesia = subRes.data?.cortesia === true || admin;
    const planoId = efetivoPlanoId(planoBruto, cortesia);
    const plano = PLANS[planoId];
    if (!cortesia && isTrialExpired(planoBruto, subRes.data?.trial_end ?? null)) {
      throw new Error(gateMessages.trialExpirado());
    }
    const atual = countRes.count ?? 0;
    if (plano.condomíniosMax !== null && atual >= plano.condomíniosMax) {
      throw new Error(gateMessages.condominiosMax(plano.nome, plano.condomíniosMax));
    }

    const { data: row, error } = await context.supabase
      .from("condominios")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getCondominio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("condominios")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  cnpj: z.string().trim().max(20).optional().nullable(),
  endereco: z.string().trim().max(255).optional().nullable(),
  uf: z.string().trim().length(2).optional().nullable(),
  qtd_unidades: z.number().int().min(0).max(100000).optional().nullable(),
  categoria: z
    .enum(["predio", "casas", "salas_comerciais", "shopping", "galpoes"])
    .optional(),
});

export const updateCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Apenas o dono pode editar — verificação explícita
    // (a RLS de UPDATE deve cobrir, mas a checagem dá mensagem clara).
    const { data: condo } = await context.supabase
      .from("condominios")
      .select("owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!condo) throw new Error("Condomínio não encontrado.");
    if (condo.owner_id !== context.userId) {
      throw new Error("Apenas o dono do condomínio pode editar estes dados.");
    }
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("condominios")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email, telefone, oab, tipo_pessoa, cpf_cnpj, razao_social, papel_sistema, perfil_atuacao, onboarding_completo, onboarding_tour_completo, dicas_ativas, lgpd_aceite_em, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const getUsoMensal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mes = new Date().toISOString().slice(0, 7);
    const { data, error } = await context.supabase
      .from("uso_mensal")
      .select("total_mensagens, total_tokens")
      .eq("user_id", context.userId)
      .eq("mes_ano", mes)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { total_mensagens: 0, total_tokens: 0 };
  });

export const setTourCompleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ completo: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ onboarding_tour_completo: data.completo })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDicasAtivas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ativas: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ dicas_ativas: data.ativas })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDicas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dicas_sistema")
      .select("id, texto, categoria, ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });