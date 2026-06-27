import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPlanosByTipo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tipo_pessoa: z.enum(["pf", "pj"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("planos")
      .select("id, nome, preco_mensal, limite_condominios, limite_usuarios, limite_mensagens_mes, limite_storage_mb, descricao, features, ordem")
      .eq("tipo_pessoa", data.tipo_pessoa)
      .eq("ativo", true)
      .order("ordem");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().trim().min(2).max(120).optional(),
      telefone: z.string().trim().max(40).optional().nullable(),
      tipo_pessoa: z.enum(["pf", "pj"]).optional(),
      cpf_cnpj: z.string().trim().max(40).optional().nullable(),
      razao_social: z.string().trim().max(200).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const papel_sistema = data.tipo_pessoa
      ? data.tipo_pessoa === "pj" ? ("cliente_pj_dono" as const) : ("cliente_pf" as const)
      : undefined;
    const { error } = await context.supabase
      .from("profiles")
      .update({
        nome: data.nome,
        telefone: data.telefone ?? undefined,
        tipo_pessoa: data.tipo_pessoa,
        cpf_cnpj: data.cpf_cnpj ?? undefined,
        razao_social: data.razao_social ?? undefined,
        ...(papel_sistema ? { papel_sistema } : {}),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assinarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ plano_id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    // upsert sem usar a coluna legada `plano`
    const { error } = await context.supabase.from("subscriptions").upsert(
      {
        user_id: context.userId,
        plano_id: data.plano_id,
        status: "trialing",
        trial_end: trialEnd,
        tipo_assinatura: "mensal",
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completarOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ onboarding_completo: true })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const solicitarContatoIlimitado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().trim().min(2).max(120),
      telefone: z.string().trim().min(8).max(40),
      email: z.string().trim().email().max(255),
      mensagem: z.string().trim().max(2000).optional().default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Por ora apenas registra na auditoria — integração de e-mail entra no Bloco 7
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "contato.plano_ilimitado",
      metadata: data,
    });
    return { ok: true };
  });