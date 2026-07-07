import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoUnidade = z.enum([
  "apartamento",
  "casa",
  "sala_comercial",
  "loja",
  "vaga_avulsa",
  "outro",
]);

const TipoCondomino = z.enum([
  "proprietario",
  "inquilino",
  "morador",
  "responsavel_legal",
]);

const UnidadeInput = z.object({
  condominioId: z.string().uuid(),
  bloco: z.string().trim().max(20).optional().nullable(),
  numero: z.string().trim().min(1).max(20),
  tipo: TipoUnidade.default("apartamento"),
  fracao_ideal: z.number().nullable().optional(),
  area_m2: z.number().nullable().optional(),
  vagas_garagem: z.number().int().min(0).max(50).default(0),
  observacoes: z.string().max(2000).optional().nullable(),
});

export const listUnidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string }) =>
    z.object({ condominioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("unidades")
      .select("*, condominos(*)")
      .eq("condominio_id", data.condominioId)
      .order("bloco", { ascending: true, nullsFirst: true })
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCondominioMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string }) =>
    z.object({ condominioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("condominios")
      .select("categoria, qtd_unidades")
      .eq("id", data.condominioId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { normalizeCategoria } = await import("./categorias-condominio");
    return {
      categoria: normalizeCategoria(row?.categoria as string | null),
      qtdUnidades: (row?.qtd_unidades as number | null) ?? null,
    };
  });

export const createUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof UnidadeInput>) => UnidadeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("unidades")
      .insert({
        condominio_id: data.condominioId,
        bloco: data.bloco ?? null,
        numero: data.numero,
        tipo: data.tipo,
        fracao_ideal: data.fracao_ideal ?? null,
        area_m2: data.area_m2 ?? null,
        vagas_garagem: data.vagas_garagem,
        observacoes: data.observacoes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof UnidadeInput> & { id: string }) =>
    UnidadeInput.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("unidades")
      .update({
        bloco: data.bloco ?? null,
        numero: data.numero,
        tipo: data.tipo,
        fracao_ideal: data.fracao_ideal ?? null,
        area_m2: data.area_m2 ?? null,
        vagas_garagem: data.vagas_garagem,
        observacoes: data.observacoes ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("unidades").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Condôminos
const CondominoInput = z.object({
  unidadeId: z.string().uuid(),
  condominioId: z.string().uuid(),
  nome: z.string().trim().min(2).max(200),
  cpf: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().nullable(),
  tipo: TipoCondomino.default("proprietario"),
  principal: z.boolean().default(false),
  observacoes: z.string().max(2000).optional().nullable(),
});

export const createCondomino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof CondominoInput>) => CondominoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("condominos")
      .insert({
        unidade_id: data.unidadeId,
        condominio_id: data.condominioId,
        nome: data.nome,
        cpf: data.cpf || null,
        email: data.email || null,
        telefone: data.telefone || null,
        tipo: data.tipo,
        principal: data.principal,
        observacoes: data.observacoes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCondomino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof CondominoInput> & { id: string }) =>
    CondominoInput.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("condominos")
      .update({
        nome: data.nome,
        cpf: data.cpf || null,
        email: data.email || null,
        telefone: data.telefone || null,
        tipo: data.tipo,
        principal: data.principal,
        observacoes: data.observacoes ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCondomino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("condominos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Importação em lote (CSV / planilha já normalizada)
const ImportLinha = z.object({
  bloco: z.string().trim().max(20).optional().nullable(),
  numero: z.string().trim().min(1).max(20),
  tipo_unidade: TipoUnidade.optional(),
  fracao_ideal: z.number().nullable().optional(),
  area_m2: z.number().nullable().optional(),
  vagas_garagem: z.number().int().min(0).max(50).optional(),
  // condômino
  nome: z.string().trim().min(2).max(200).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().max(120).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  tipo_condomino: TipoCondomino.optional(),
});

export const importUnidadesLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      condominioId: string;
      linhas: z.infer<typeof ImportLinha>[];
      estrategiaConflito?: "manter" | "substituir";
    }) =>
      z
        .object({
          condominioId: z.string().uuid(),
          linhas: z.array(ImportLinha).min(1).max(2000),
          estrategiaConflito: z.enum(["manter", "substituir"]).optional().default("manter"),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Limite pelo total previsto na convenção (qtd_unidades)
    const { data: cond } = await sb
      .from("condominios")
      .select("qtd_unidades")
      .eq("id", data.condominioId)
      .maybeSingle();
    const { count: atuais } = await sb
      .from("unidades")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", data.condominioId);
    const maxPrevisto = (cond?.qtd_unidades as number | null) ?? null;

    let unidadesCriadas = 0;
    let unidadesAtualizadas = 0;
    let condominosCriados = 0;
    const erros: { linha: number; mensagem: string }[] = [];
    let jaExistentes = atuais ?? 0;

    for (let i = 0; i < data.linhas.length; i++) {
      const l = data.linhas[i];
      try {
        // Match por (bloco, numero) — trata null/'' como equivalentes
        const q = sb
          .from("unidades")
          .select("id")
          .eq("condominio_id", data.condominioId)
          .eq("numero", l.numero);
        const { data: existing } = l.bloco
          ? await q.eq("bloco", l.bloco).maybeSingle()
          : await q.or("bloco.is.null,bloco.eq.").maybeSingle();

        let unidadeId = existing?.id ?? null;
        if (!unidadeId) {
          if (maxPrevisto != null && jaExistentes >= maxPrevisto) {
            throw new Error(
              `Limite da convenção atingido (${maxPrevisto} unidades). Ajuste "qtd_unidades" no cadastro do condomínio ou remova unidades antes de importar mais.`,
            );
          }
          const { data: nova, error } = await sb
            .from("unidades")
            .insert({
              condominio_id: data.condominioId,
              bloco: l.bloco ?? null,
              numero: l.numero,
              tipo: l.tipo_unidade ?? "apartamento",
              fracao_ideal: l.fracao_ideal ?? null,
              area_m2: l.area_m2 ?? null,
              vagas_garagem: l.vagas_garagem ?? 0,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          unidadeId = nova!.id;
          unidadesCriadas++;
          jaExistentes++;
        } else {
          if (data.estrategiaConflito === "substituir") {
            const { error } = await sb
              .from("unidades")
              .update({
                tipo: l.tipo_unidade ?? "apartamento",
                fracao_ideal: l.fracao_ideal ?? null,
                area_m2: l.area_m2 ?? null,
                vagas_garagem: l.vagas_garagem ?? 0,
              })
              .eq("id", unidadeId);
            if (error) throw new Error(error.message);
          }
          unidadesAtualizadas++;
        }

        if (l.nome && unidadeId) {
          const { error } = await sb.from("condominos").insert({
            unidade_id: unidadeId,
            condominio_id: data.condominioId,
            nome: l.nome,
            cpf: l.cpf || null,
            email: l.email || null,
            telefone: l.telefone || null,
            tipo: l.tipo_condomino ?? "proprietario",
            principal: true,
          });
          if (error) throw new Error(error.message);
          condominosCriados++;
        }
      } catch (e) {
        erros.push({
          linha: i + 2,
          mensagem: e instanceof Error ? e.message : "Erro desconhecido",
        });
      }
    }

    return { unidadesCriadas, unidadesAtualizadas, condominosCriados, erros };
  });