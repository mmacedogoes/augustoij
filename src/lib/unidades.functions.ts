import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoUnidade = z.enum([
  "apartamento",
  "casa",
  "lote",
  "terreno",
  "sala_comercial",
  "loja",
  "galpao",
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
        tipo: data.tipo as never,
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
        tipo: data.tipo as never,
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
    // Limite pelo total previsto na convenção (qtd_unidades).
    // 0 ou null = "não informado" → sem limite.
    const { data: cond } = await sb
      .from("condominios")
      .select("qtd_unidades")
      .eq("id", data.condominioId)
      .maybeSingle();
    const maxPrevisto =
      cond?.qtd_unidades && (cond.qtd_unidades as number) > 0
        ? (cond.qtd_unidades as number)
        : null;

    // Snapshot das unidades existentes para saber o que é update vs insert
    const { data: existentesRows, error: exErr } = await sb
      .from("unidades")
      .select("id, bloco, numero")
      .eq("condominio_id", data.condominioId);
    if (exErr) throw new Error(`Falha ao ler unidades existentes: ${exErr.message}`);
    const chave = (b: string | null, n: string) =>
      `${(b ?? "").trim().toLowerCase()}::${n.trim()}`;
    const existentesMap = new Map<string, string>();
    for (const r of existentesRows ?? []) {
      existentesMap.set(
        chave((r.bloco as string) ?? null, r.numero as string),
        r.id as string,
      );
    }

    // Deduplica linhas de entrada por (bloco, numero) preservando a última ocorrência
    const dedupMap = new Map<string, (typeof data.linhas)[number]>();
    for (const l of data.linhas) dedupMap.set(chave(l.bloco ?? null, l.numero), l);
    const linhas = Array.from(dedupMap.values());

    const novas = linhas.filter((l) => !existentesMap.has(chave(l.bloco ?? null, l.numero)));
    const jaExistem = linhas.length - novas.length;

    if (maxPrevisto != null && (existentesRows?.length ?? 0) + novas.length > maxPrevisto) {
      throw new Error(
        `Limite da convenção atingido (${maxPrevisto} unidades). Ajuste "qtd_unidades" no cadastro do condomínio ou remova unidades antes de importar mais.`,
      );
    }

    let unidadesCriadas = 0;
    let unidadesAtualizadas = 0;
    let condominosCriados = 0;
    const erros: { linha: number; mensagem: string }[] = [];

    // 1) INSERT em lotes das novas unidades
    const CHUNK = 200;
    const inseridasIdPorChave = new Map<string, string>();
    for (let i = 0; i < novas.length; i += CHUNK) {
      const slice = novas.slice(i, i + CHUNK);
      const payload = slice.map((l) => ({
        condominio_id: data.condominioId,
        bloco: l.bloco ?? null,
        numero: l.numero,
        tipo: (l.tipo_unidade ?? "apartamento") as never,
        fracao_ideal: l.fracao_ideal ?? null,
        area_m2: l.area_m2 ?? null,
        vagas_garagem: l.vagas_garagem ?? 0,
      }));
      const { data: inseridas, error } = await sb
        .from("unidades")
        .insert(payload)
        .select("id, bloco, numero");
      if (error) {
        erros.push({
          linha: i + 2,
          mensagem: `Falha ao inserir lote (${slice.length} unidades): ${error.message}`,
        });
        continue;
      }
      unidadesCriadas += inseridas?.length ?? 0;
      for (const r of inseridas ?? []) {
        inseridasIdPorChave.set(
          chave((r.bloco as string) ?? null, r.numero as string),
          r.id as string,
        );
      }
    }

    // 2) UPDATE das existentes (apenas em modo "substituir")
    if (data.estrategiaConflito === "substituir") {
      const existentesParaAtualizar = linhas.filter((l) =>
        existentesMap.has(chave(l.bloco ?? null, l.numero)),
      );
      for (const l of existentesParaAtualizar) {
        const id = existentesMap.get(chave(l.bloco ?? null, l.numero))!;
        const { error } = await sb
          .from("unidades")
          .update({
            tipo: (l.tipo_unidade ?? "apartamento") as never,
            fracao_ideal: l.fracao_ideal ?? null,
            area_m2: l.area_m2 ?? null,
            vagas_garagem: l.vagas_garagem ?? 0,
          })
          .eq("id", id);
        if (error) {
          erros.push({ linha: 0, mensagem: `Falha ao atualizar ${l.numero}: ${error.message}` });
          continue;
        }
        unidadesAtualizadas++;
      }
    } else {
      unidadesAtualizadas = jaExistem;
    }

    // 3) Condôminos vinculados (quando a linha trouxer nome)
    type CondominoInsertRow = {
      unidade_id: string;
      condominio_id: string;
      nome: string;
      cpf: string | null;
      email: string | null;
      telefone: string | null;
      tipo: z.infer<typeof TipoCondomino>;
      principal: boolean;
    };
    const condominosPayload: CondominoInsertRow[] = [];
    for (const l of linhas) {
      if (!l.nome) continue;
      const k = chave(l.bloco ?? null, l.numero);
      const unidadeId = inseridasIdPorChave.get(k) ?? existentesMap.get(k);
      if (!unidadeId) continue;
      condominosPayload.push({
        unidade_id: unidadeId,
        condominio_id: data.condominioId,
        nome: l.nome,
        cpf: l.cpf || null,
        email: l.email || null,
        telefone: l.telefone || null,
        tipo: l.tipo_condomino ?? "proprietario",
        principal: true,
      });
    }
    for (let i = 0; i < condominosPayload.length; i += CHUNK) {
      const slice = condominosPayload.slice(i, i + CHUNK);
      const { data: inseridos, error } = await sb
        .from("condominos")
        .insert(slice)
        .select("id");
      if (error) {
        erros.push({
          linha: 0,
          mensagem: `Falha ao inserir condôminos: ${error.message}`,
        });
        continue;
      }
      condominosCriados += inseridos?.length ?? 0;
    }

    // 4) Se o cadastro estava com qtd_unidades = 0/null, atualiza com o total agora existente
    if (!maxPrevisto && unidadesCriadas > 0) {
      const totalAtual = (existentesRows?.length ?? 0) + unidadesCriadas;
      await sb
        .from("condominios")
        .update({ qtd_unidades: totalAtual })
        .eq("id", data.condominioId);
    }

    // 5) Se nada foi criado nem atualizado E há erros, lança para o cliente ver
    if (unidadesCriadas === 0 && unidadesAtualizadas === 0 && erros.length > 0) {
      throw new Error(
        `Nenhuma unidade importada. Primeiro erro: ${erros[0].mensagem}`,
      );
    }

    return { unidadesCriadas, unidadesAtualizadas, condominosCriados, erros };
  });