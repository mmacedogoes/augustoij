import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCondominios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("condominios")
      .select("id, nome, cnpj, uf, qtd_unidades, created_at")
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
});

export const createCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
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

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email, telefone, oab, tipo_pessoa, cpf_cnpj, razao_social, papel_sistema, onboarding_completo, lgpd_aceite_em, created_at")
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