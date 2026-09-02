/**
 * Gestão de usuários da conta (multiusuário).
 *
 * Disponível nos planos Gestão e Administradora (ou contas em cortesia /
 * admin interno). O dono cria usuários, atribui condomínios e define
 * permissões. Padrão restritivo: o usuário criado apenas visualiza e
 * adiciona documentos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANOS, type PlanoId } from "@/config/planos";
import { isAdminInternoServer } from "@/lib/admin-bypass";

export const PLANOS_MULTIUSUARIO: PlanoId[] = ["gestao", "administradora", "personalizado"];

export type PermissoesEquipe = {
  pode_gerenciar_contratos: boolean;
  pode_gerenciar_documentos: boolean;
  pode_gerenciar_assembleias: boolean;
  pode_gerenciar_unidades: boolean;
  pode_gerenciar_usuarios: boolean;
};

export type UsuarioEquipe = {
  user_id: string;
  nome: string | null;
  email: string | null;
  condominios: Array<{ membro_id: string; condominio_id: string; nome: string } & PermissoesEquipe>;
};

const permissoesSchema = z.object({
  pode_gerenciar_contratos: z.boolean().default(false),
  pode_gerenciar_documentos: z.boolean().default(false),
  pode_gerenciar_assembleias: z.boolean().default(false),
  pode_gerenciar_unidades: z.boolean().default(false),
  pode_gerenciar_usuarios: z.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

async function contextoPlano(context: Ctx) {
  const { getSubscriptionEfetiva } = await import("@/lib/conta-master.server");
  const [sub, admin] = await Promise.all([
    getSubscriptionEfetiva(context.userId),
    isAdminInternoServer(context.supabase, context.userId),
  ]);
  const bruto = (sub?.plano_config_id ?? "gratuito") as string;
  const planoId = (bruto in PLANOS ? bruto : "gratuito") as PlanoId;
  const cortesia = sub?.cortesia === true;
  const liberado = admin || cortesia || PLANOS_MULTIUSUARIO.includes(planoId);
  const limite = PLANOS[planoId].limites.usuarios; // null = ilimitado
  return { planoId, liberado, limite: admin || cortesia ? null : limite };
}

async function ensureMultiusuario(context: Ctx) {
  const info = await contextoPlano(context);
  if (!info.liberado) {
    throw new Error("A criação de usuários adicionais está disponível a partir do plano Gestão.");
  }
  return info;
}

/**
 * Condomínios do ambiente de trabalho da conta dona — inclui os cadastrados
 * por usuários vinculados, que também pertencem ao mesmo ambiente.
 */
async function condominiosDoDono(context: Ctx): Promise<Array<{ id: string; nome: string }>> {
  const { condominiosDoAmbiente } = await import("@/lib/conta-master.server");
  return condominiosDoAmbiente(context.userId);
}

export const getContextoEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const info = await contextoPlano(context);
    const condominios = await condominiosDoDono(context);
    return { liberado: info.liberado, planoId: info.planoId, limiteUsuarios: info.limite, condominios };
  });

export const listUsuariosEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: UsuarioEquipe[] }> => {
    const condos = await condominiosDoDono(context);
    if (condos.length === 0) return { rows: [] };
    const nomePorId = new Map(condos.map((c) => [c.id, c.nome]));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: membros, error } = await supabaseAdmin
      .from("condominio_members")
      .select(
        "id, condominio_id, user_id, pode_gerenciar_contratos, pode_gerenciar_documentos, pode_gerenciar_assembleias, pode_gerenciar_unidades, pode_gerenciar_usuarios",
      )
      .in("condominio_id", condos.map((c) => c.id));
    if (error) throw new Error(error.message);
    const rows = (membros ?? []) as Array<
      { id: string; condominio_id: string; user_id: string } & PermissoesEquipe
    >;
    const outros = rows.filter((m) => m.user_id !== context.userId);
    if (outros.length === 0) return { rows: [] };
    // O RLS de profiles não permite ao dono ler perfis de terceiros; a lista
    // acima já garante que só buscamos usuários vinculados a condomínios do
    // próprio dono autenticado, então usamos o client privilegiado.
    // (usa o client privilegiado já importado acima)

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .in("id", Array.from(new Set(outros.map((m) => m.user_id))));
    const perfil = new Map(
      ((profiles ?? []) as Array<{ id: string; nome: string | null; email: string | null }>).map((p) => [p.id, p]),
    );
    const agrupado = new Map<string, UsuarioEquipe>();
    for (const m of outros) {
      const atual = agrupado.get(m.user_id) ?? {
        user_id: m.user_id,
        nome: perfil.get(m.user_id)?.nome ?? null,
        email: perfil.get(m.user_id)?.email ?? null,
        condominios: [],
      };
      atual.condominios.push({
        membro_id: m.id,
        condominio_id: m.condominio_id,
        nome: nomePorId.get(m.condominio_id) ?? "—",
        pode_gerenciar_contratos: m.pode_gerenciar_contratos,
        pode_gerenciar_documentos: m.pode_gerenciar_documentos,
        pode_gerenciar_assembleias: m.pode_gerenciar_assembleias,
        pode_gerenciar_unidades: m.pode_gerenciar_unidades,
        pode_gerenciar_usuarios: m.pode_gerenciar_usuarios,
      });
      agrupado.set(m.user_id, atual);
    }
    return { rows: Array.from(agrupado.values()) };
  });

export const criarUsuarioEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        email: z.string().email().max(255),
        password: z
          .string()
          .min(8, "Senha deve ter no mínimo 8 caracteres")
          .max(72)
          .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
          .regex(/[0-9]/, "Inclua ao menos um número"),
        todosCondominios: z.boolean().default(false),
        condominioIds: z.array(z.string().uuid()).default([]),
        permissoes: permissoesSchema.default({
          pode_gerenciar_contratos: false,
          pode_gerenciar_documentos: false,
          pode_gerenciar_assembleias: false,
          pode_gerenciar_unidades: false,
          pode_gerenciar_usuarios: false,
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const info = await ensureMultiusuario(context);
    const meus = await condominiosDoDono(context);
    const alvo = data.todosCondominios
      ? meus.map((c) => c.id)
      : data.condominioIds.filter((id) => meus.some((c) => c.id === id));
    if (alvo.length === 0) throw new Error("Selecione ao menos um condomínio seu.");

    // Limite de usuários do plano (conta o dono + usuários distintos já vinculados)
    if (typeof info.limite === "number") {
      const { data: existentes } = await context.supabase
        .from("condominio_members")
        .select("user_id")
        .in("condominio_id", meus.map((c) => c.id));
      const distintos = new Set(
        ((existentes ?? []) as Array<{ user_id: string }>)
          .map((m) => m.user_id)
          .filter((u) => u !== context.userId),
      );
      if (distintos.size + 1 > info.limite - 1) {
        throw new Error(
          `Seu plano permite ${info.limite} usuário(s) no total. Faça upgrade para adicionar mais.`,
        );
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailNorm = data.email.toLowerCase().trim();
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", emailNorm)
      .maybeSingle();

    const { data: ownerSub } = await supabaseAdmin
      .from("subscriptions")
      .select("plano_config_id, cortesia, cortesia_observacao, custom_limits, custom_preco, custom_ciclo, custom_billing_type, custom_vencimento_dias")
      .eq("user_id", context.userId)
      .maybeSingle();

    let userId = (existing?.id as string | undefined) ?? null;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: emailNorm,
        password: data.password,
        email_confirm: true,
        user_metadata: { nome: data.nome },
      });
      if (error) throw new Error(error.message);
      userId = created?.user?.id ?? null;
      if (!userId) throw new Error("Falha ao criar usuário.");
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: emailNorm,
        nome: data.nome,
        papel_sistema: "cliente_pj_operador",
        onboarding_completo: true,
        criado_por: context.userId,
      },
      { onConflict: "id" },
    );

    // Replica a assinatura e plano do titular na conta do usuário vinculado
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        plano_config_id: ownerSub?.plano_config_id ?? "gestao",
        status: "active",
        cortesia: ownerSub?.cortesia ?? false,
        cortesia_observacao: ownerSub?.cortesia_observacao ?? "Usuário vinculado",
        custom_limits: ownerSub?.custom_limits ?? null,
        custom_preco: ownerSub?.custom_preco ?? null,
        custom_ciclo: ownerSub?.custom_ciclo ?? null,
        custom_billing_type: ownerSub?.custom_billing_type ?? null,
        custom_vencimento_dias: ownerSub?.custom_vencimento_dias ?? null,
        vinculado_a_user_id: context.userId,
      },
      { onConflict: "user_id" },
    );

    const linhas = alvo.map((condominio_id) => ({
      condominio_id,
      user_id: userId as string,
      papel: "operador_condominio" as const,
      criado_por: context.userId,
      ...data.permissoes,
    }));
    const { error: linkErr } = await supabaseAdmin
      .from("condominio_members")
      .upsert(linhas as never, { onConflict: "condominio_id,user_id" });
    if (linkErr) throw new Error(linkErr.message);

    return { ok: true, userId, reaproveitado: !!existing };
  });

export const atualizarUsuarioEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        condominioIds: z.array(z.string().uuid()).default([]),
        permissoes: permissoesSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureMultiusuario(context);
    const meus = await condominiosDoDono(context);
    const meusIds = meus.map((c) => c.id);
    const alvo = data.condominioIds.filter((id) => meusIds.includes(id));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove vínculos que saíram da seleção
    const { data: atuais } = await supabaseAdmin
      .from("condominio_members")
      .select("id, condominio_id")
      .eq("user_id", data.userId)
      .in("condominio_id", meusIds);
    const remover = ((atuais ?? []) as Array<{ id: string; condominio_id: string }>)
      .filter((m) => !alvo.includes(m.condominio_id))
      .map((m) => m.id);
    if (remover.length > 0) {
      await supabaseAdmin.from("condominio_members").delete().in("id", remover);
    }
    if (alvo.length > 0) {
      const linhas = alvo.map((condominio_id) => ({
        condominio_id,
        user_id: data.userId,
        papel: "operador_condominio" as const,
        criado_por: context.userId,
        ...data.permissoes,
      }));
      const { error } = await supabaseAdmin
        .from("condominio_members")
        .upsert(linhas as never, { onConflict: "condominio_id,user_id" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removerUsuarioEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureMultiusuario(context);
    const meus = await condominiosDoDono(context);
    if (meus.length === 0) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("condominio_members")
      .delete()
      .eq("user_id", data.userId)
      .in("condominio_id", meus.map((c) => c.id));
    if (error) throw new Error(error.message);
    return { ok: true };
  });
