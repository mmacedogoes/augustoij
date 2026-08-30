import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "@/lib/admin-guard";

export type PendenciaAuditoria = {
  unidade: string;
  campo: "fracao_ideal" | "area_m2" | "existencia";
  cadastro: string;
  convencao: string;
};

export type ResultadoAuditoria = {
  condominioId: string;
  nome: string;
  status:
    | "ok"
    | "sem_convencao"
    | "leitura_incompleta"
    | "corrigido"
    | "pendencias"
    | "erro";
  mensagem?: string;
  declarado: number | null;
  cadastradas: number;
  naConvencao: number | null;
  criadas: number;
  fracoesPreenchidas: number;
  areasPreenchidas: number;
  somaFracoes: number | null;
  pendencias: PendenciaAuditoria[];
};

const TOLERANCIA = 0.01; // 1% de diferença relativa

function divergente(a: number, b: number) {
  if (a === b) return false;
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return false;
  return Math.abs(a - b) / base > TOLERANCIA;
}

/** Visão rápida (sem IA) de todos os condomínios cadastrados. */
export const visaoGeralUnidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: condominios, error } = await supabaseAdmin
      .from("condominios")
      .select("id, nome, qtd_unidades, categoria, owner_id")
      .order("nome");
    if (error) throw new Error(error.message);

    const linhas = [];
    for (const c of condominios ?? []) {
      const [{ data: unidades }, { count: convencoes }] = await Promise.all([
        supabaseAdmin
          .from("unidades")
          .select("id, fracao_ideal, area_m2")
          .eq("condominio_id", c.id),
        supabaseAdmin
          .from("documentos")
          .select("id", { count: "exact", head: true })
          .eq("condominio_id", c.id)
          .eq("tipo", "convencao")
          .eq("status_processamento", "pronto"),
      ]);
      const list = unidades ?? [];
      const soma = list.reduce((acc, u) => acc + (Number(u.fracao_ideal) || 0), 0);
      linhas.push({
        id: c.id,
        nome: c.nome as string,
        declarado: (c.qtd_unidades as number | null) ?? null,
        cadastradas: list.length,
        semFracao: list.filter((u) => u.fracao_ideal == null).length,
        semArea: list.filter((u) => u.area_m2 == null).length,
        somaFracoes: list.length > 0 ? Number(soma.toFixed(6)) : null,
        temConvencao: (convencoes ?? 0) > 0,
      });
    }
    return linhas;
  });

/**
 * Confere o cadastro de unidades de um condomínio contra a convenção.
 * Só preenche campos vazios e cria unidades ausentes — nunca sobrescreve
 * valor já informado pelo usuário nem apaga registros.
 */
export const auditarCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string; aplicar?: boolean }) =>
    z
      .object({
        condominioId: z.string().uuid(),
        aplicar: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ResultadoAuditoria> => {
    await ensureAdmin(context);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cond } = await supabaseAdmin
      .from("condominios")
      .select("id, nome, qtd_unidades")
      .eq("id", data.condominioId)
      .maybeSingle();
    if (!cond) throw new Error("Condomínio não encontrado.");

    const base: ResultadoAuditoria = {
      condominioId: cond.id as string,
      nome: cond.nome as string,
      status: "ok",
      declarado: (cond.qtd_unidades as number | null) ?? null,
      cadastradas: 0,
      naConvencao: null,
      criadas: 0,
      fracoesPreenchidas: 0,
      areasPreenchidas: 0,
      somaFracoes: null,
      pendencias: [],
    };

    const { data: doc } = await supabaseAdmin
      .from("documentos")
      .select("id")
      .eq("condominio_id", cond.id)
      .eq("tipo", "convencao")
      .eq("status_processamento", "pronto")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: atuais } = await supabaseAdmin
      .from("unidades")
      .select("id, bloco, numero, tipo, fracao_ideal, area_m2")
      .eq("condominio_id", cond.id);
    const cadastro = atuais ?? [];
    base.cadastradas = cadastro.length;
    base.somaFracoes =
      cadastro.length > 0
        ? Number(
            cadastro
              .reduce((acc, u) => acc + (Number(u.fracao_ideal) || 0), 0)
              .toFixed(6),
          )
        : null;

    if (!doc) {
      return { ...base, status: "sem_convencao", mensagem: "Sem convenção processada." };
    }

    const { chaveUnidade, ExtracaoIncompletaError, extrairESalvarSugestaoUnidades } = await import(
      "@/lib/unidades-extracao.server"
    );
    let extraidas;
    try {
      extraidas = await extrairESalvarSugestaoUnidades(
        supabaseAdmin as never,
        doc.id as string,
        apiKey,
        { force: true },
      );
      // A auditoria já aplica/relata o resultado — a sugestão pendente criada
      // pelo pipeline seria um caminho duplicado na tela de unidades.
      await supabaseAdmin
        .from("sugestoes_unidades")
        .delete()
        .eq("documento_id", doc.id)
        .eq("status", "pendente");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na leitura da convenção.";
      return {
        ...base,
        status: e instanceof ExtracaoIncompletaError ? "leitura_incompleta" : "erro",
        mensagem: msg,
      };
    }

    base.naConvencao = extraidas.length;

    const porChave = new Map(
      cadastro.map((u) => [chaveUnidade(u.bloco ?? null, String(u.numero ?? "")), u]),
    );
    const chavesConvencao = new Set<string>();

    const novas: Record<string, unknown>[] = [];
    for (const e of extraidas) {
      const key = chaveUnidade(e.bloco ?? null, e.numero);
      chavesConvencao.add(key);
      const atual = porChave.get(key);
      if (!atual) {
        novas.push({
          condominio_id: cond.id,
          bloco: e.bloco ?? null,
          numero: e.numero,
          tipo: e.tipo ?? "apartamento",
          fracao_ideal: e.fracao_ideal ?? null,
          area_m2: e.area_m2 ?? null,
          vagas_garagem: e.vagas_garagem ?? 0,
        });
        continue;
      }
      const patch: { fracao_ideal?: number; area_m2?: number } = {};
      if (atual.fracao_ideal == null && e.fracao_ideal != null) {
        patch.fracao_ideal = e.fracao_ideal;
      } else if (
        atual.fracao_ideal != null &&
        e.fracao_ideal != null &&
        divergente(Number(atual.fracao_ideal), e.fracao_ideal)
      ) {
        base.pendencias.push({
          unidade: key,
          campo: "fracao_ideal",
          cadastro: String(atual.fracao_ideal),
          convencao: String(e.fracao_ideal),
        });
      }
      if (atual.area_m2 == null && e.area_m2 != null) {
        patch.area_m2 = e.area_m2;
      } else if (
        atual.area_m2 != null &&
        e.area_m2 != null &&
        divergente(Number(atual.area_m2), e.area_m2)
      ) {
        base.pendencias.push({
          unidade: key,
          campo: "area_m2",
          cadastro: String(atual.area_m2),
          convencao: String(e.area_m2),
        });
      }
      if (Object.keys(patch).length > 0) {
        if (data.aplicar) {
          const { error: upErr } = await supabaseAdmin
            .from("unidades")
            .update(patch)
            .eq("id", atual.id);
          if (upErr) throw new Error(upErr.message);
        }
        if ("fracao_ideal" in patch) base.fracoesPreenchidas++;
        if ("area_m2" in patch) base.areasPreenchidas++;
      }
    }

    // Unidades no cadastro que não aparecem na convenção: nunca apagamos,
    // apenas reportamos como pendência de revisão.
    for (const u of cadastro) {
      const key = chaveUnidade(u.bloco ?? null, String(u.numero ?? ""));
      if (!chavesConvencao.has(key)) {
        base.pendencias.push({
          unidade: key,
          campo: "existencia",
          cadastro: "cadastrada",
          convencao: "não localizada na convenção",
        });
      }
    }

    if (novas.length > 0 && data.aplicar) {
      const { error: insErr } = await supabaseAdmin.from("unidades").insert(novas as never);
      if (insErr) throw new Error(insErr.message);
    }
    base.criadas = novas.length;

    const { data: finais } = await supabaseAdmin
      .from("unidades")
      .select("id, fracao_ideal")
      .eq("condominio_id", cond.id);
    base.cadastradas = (finais ?? []).length;
    base.somaFracoes =
      base.cadastradas > 0
        ? Number(
            (finais ?? [])
              .reduce((acc, u) => acc + (Number(u.fracao_ideal) || 0), 0)
              .toFixed(6),
          )
        : null;

    const houveCorrecao =
      base.criadas > 0 || base.fracoesPreenchidas > 0 || base.areasPreenchidas > 0;
    base.status = houveCorrecao
      ? "corrigido"
      : base.pendencias.length > 0
        ? "pendencias"
        : "ok";

    try {
      const { logAdminAction } = await import("@/lib/audit.server");
      await logAdminAction({
        actorUserId: context.userId,
        action: houveCorrecao ? "unidades.auditoria.corrigir" : "unidades.auditoria.executar",
        targetCondominioId: cond.id as string,
        metadata: {
          criadas: base.criadas,
          fracoes: base.fracoesPreenchidas,
          areas: base.areasPreenchidas,
          pendencias: base.pendencias.length,
        },
      });
    } catch (err) {
      console.error("[auditoria-unidades] log falhou", err);
    }

    return base;
  });
