import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { resolvePlanId, isTrialExpired, gateMessages, efetivoPlanoId } from "@/lib/plan-gates";
import { isAdminInternoServer } from "@/lib/admin-bypass";
import { slugCidade, isCidadeWhitelist } from "@/lib/cidades-cobertas";

export const listCondominios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Sincroniza a carteira caso seja o Marcelo ou membro da equipe
    const { sincronizarCarteiraMarceloSeNecessario } = await import("@/lib/seed-versari.server");
    await sincronizarCarteiraMarceloSeNecessario(context.userId);

    // Ambiente de trabalho: o usuário vê os condomínios que cadastrou e os
    // que a conta dona compartilhou com ele (vínculo em condominio_members).
    const { condominiosAcessiveisIds } = await import("@/lib/conta-master.server");
    const ids = await condominiosAcessiveisIds(context.userId);
    if (ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("condominios")
      .select("id, nome, cnpj, uf, cidade, qtd_unidades, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });


const createSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  cnpj: z.string().trim().max(20).optional().nullable(),
  endereco: z.string().trim().max(255).optional().nullable(),
  uf: z.string().trim().length(2).optional().nullable(),
  cidade: z.string().trim().min(2).max(120).optional().nullable(),
  qtd_unidades: z.number().int().min(0).max(100000).optional().nullable(),
  categoria: z
    .enum(["predio", "casas", "salas_comerciais", "shopping", "galpoes"])
    .optional(),
});

export const createCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    // ---- Gate por plano (bloqueio no servidor, contado por ambiente) ----
    const { getSubscriptionEfetiva, condominiosDoAmbiente } = await import(
      "@/lib/conta-master.server"
    );
    const [sub, doAmbiente, admin] = await Promise.all([
      getSubscriptionEfetiva(context.userId),
      condominiosDoAmbiente(context.userId),
      isAdminInternoServer(context.supabase, context.userId),
    ]);
    const planoBruto = resolvePlanId(sub?.plano_config_id ?? null);
    const cortesia = sub?.cortesia === true || admin;
    const planoId = efetivoPlanoId(planoBruto, cortesia);
    const plano = PLANS[planoId];
    if (!cortesia && isTrialExpired(planoBruto, sub?.trial_end ?? null)) {
      throw new Error(gateMessages.trialExpirado());
    }
    const atual = doAmbiente.length;
    if (plano.condomíniosMax !== null && atual >= plano.condomíniosMax) {
      throw new Error(gateMessages.condominiosMax(plano.nome, plano.condomíniosMax));
    }


    const { data: row, error } = await context.supabase
      .from("condominios")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const cidadeNova = await verificarCidadeNova(context, row, data.cidade, data.uf);
    return { ...row, cidadeNova };
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
  cidade: z.string().trim().min(2).max(120).optional().nullable(),
  qtd_unidades: z.number().int().min(0).max(100000).optional().nullable(),
  categoria: z
    .enum(["predio", "casas", "salas_comerciais", "shopping", "galpoes"])
    .optional(),
});

export const updateCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Quem cadastrou o condomínio ou a conta dona do ambiente pode editar.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isDonoDoAmbienteDoCondominio } = await import("@/lib/conta-master.server");
    const { data: condo } = await supabaseAdmin
      .from("condominios")
      .select("owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!condo) throw new Error("Condomínio não encontrado.");
    const donoAmbiente = await isDonoDoAmbienteDoCondominio(context.userId, data.id);
    if (condo.owner_id !== context.userId && !donoAmbiente) {
      throw new Error("Apenas o dono do condomínio pode editar estes dados.");
    }
    const { id, ...patch } = data;
    const { data: row, error } = await supabaseAdmin
      .from("condominios")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const cidadeNova = await verificarCidadeNova(context, row, data.cidade, data.uf);
    return { ...row, cidadeNova };
  });

/** True quando o usuário logado é a conta dona do ambiente do condomínio. */
export const podeExcluirCondominio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { isDonoDoAmbienteDoCondominio } = await import("@/lib/conta-master.server");
    return { pode: await isDonoDoAmbienteDoCondominio(context.userId, data.id) };
  });

/** Exclusão definitiva — somente a conta dona do ambiente. */
export const deleteCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { isDonoDoAmbienteDoCondominio } = await import("@/lib/conta-master.server");
    const pode = await isDonoDoAmbienteDoCondominio(context.userId, data.id);
    if (!pode) {
      throw new Error("Apenas o dono do ambiente pode excluir um condomínio.");
    }
    const { error } = await context.supabase.from("condominios").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verificarCidadeNova(
  context: { supabase: any; userId: string },
  row: { id: string },
  cidade?: string | null,
  uf?: string | null,
): Promise<boolean> {
  if (!cidade || !uf) return false;
  if (isCidadeWhitelist(cidade, uf)) return false;
  const slug = slugCidade(cidade, uf);
  const { data: coberta } = await context.supabase
    .from("cidades_cobertas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (coberta) return false;
  // Registra alerta via admin (bypass RLS) e notifica super admin por e-mail
  // apenas na primeira vez que a cidade aparece.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: jaAlertada } = await supabaseAdmin
      .from("cidades_novas_alertas")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!jaAlertada) {
      await supabaseAdmin.from("cidades_novas_alertas").insert({
        cidade: cidade.trim(),
        uf: uf.trim().toUpperCase(),
        slug,
        primeiro_condominio_id: row.id,
        owner_id: context.userId,
        status: "pendente",
      });
      // Busca dados do usuário que cadastrou (best effort).
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("nome, email")
        .eq("id", context.userId)
        .maybeSingle();
      await enviarEmailCidadeNova({
        cidade: cidade.trim(),
        uf: uf.trim().toUpperCase(),
        usuarioNome: prof?.nome ?? null,
        usuarioEmail: prof?.email ?? null,
      });
    }
  } catch (e) {
    console.error("[verificarCidadeNova] falhou:", e);
  }
  return true;
}

async function enviarEmailCidadeNova(params: {
  cidade: string;
  uf: string;
  usuarioNome: string | null;
  usuarioEmail: string | null;
}): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[enviarEmailCidadeNova] RESEND_API_KEY ausente");
    return;
  }
  const { cidade, uf, usuarioNome, usuarioEmail } = params;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;color:#1F2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr><td align="center" bgcolor="#00512B" style="background-color:#00512B;padding:20px 8px;color:#FFFFFF;">
    <h1 style="font-size:18px;margin:0;color:#FFFFFF;">Augusto.IJ — Nova cidade cadastrada</h1>
  </td></tr>
  <tr><td style="padding:24px 20px;">
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Um usuário cadastrou um condomínio em uma cidade que ainda não tem legislação municipal indexada.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 6px;"><strong>Cidade:</strong> ${escapeHtml(cidade)} / ${escapeHtml(uf)}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 6px;"><strong>Usuário:</strong> ${escapeHtml(usuarioNome ?? "—")}${usuarioEmail ? ` &lt;${escapeHtml(usuarioEmail)}&gt;` : ""}</p>
    <p style="font-size:15px;line-height:1.6;margin:16px 0 0;">Acesse o painel para marcar como atualizada assim que a legislação local for indexada:</p>
    <p style="margin:12px 0 0;"><a href="https://augustoij.com.br/app/admin/cidades-novas" style="color:#00512B;font-weight:bold;">Abrir painel de cidades novas</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "Augusto.IJ <naoresponda@mail.augustoij.com.br>",
        to: ["mmacedogoes@gmail.com"],
        subject: `[Augusto.IJ] Nova cidade cadastrada: ${cidade}/${uf}`,
        html,
      }),
    });
    if (!resp.ok) {
      console.error("[enviarEmailCidadeNova] Resend falhou", resp.status, await resp.text());
    }
  } catch (e) {
    console.error("[enviarEmailCidadeNova] erro:", e);
  }
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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