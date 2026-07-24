/**
 * Encerramento, reabertura, suspensão e retomada de contratos (Fase 6, Parte E).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { cancelarEventosAutomaticosFuturos, gerarEventosInterno } from "./eventos.functions";
import { registrarAuditoriaContrato } from "./auditoria.server";
import { sincronizarContratoNoAcervo } from "./ai-context.server";

const MOTIVOS_ENCERRAMENTO = [
  "termo_final",
  "rescisao_amigavel",
  "rescisao_inadimplemento",
  "substituicao_prestador",
  "outro",
] as const;

function rotuloMotivo(m: string): string {
  switch (m) {
    case "termo_final": return "Termo final da vigência";
    case "rescisao_amigavel": return "Rescisão amigável";
    case "rescisao_inadimplemento": return "Rescisão por inadimplemento do prestador";
    case "substituicao_prestador": return "Substituição de prestador";
    default: return "Outro";
  }
}

// ---------------------------------------------------------------- Encerrar

export const encerrarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        contratoId: z.string().uuid(),
        dataEncerramento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Data inválida"),
        motivo: z.enum(MOTIVOS_ENCERRAMENTO),
        motivoDetalhe: z.string().trim().max(500).optional().nullable(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: prev, error: pErr } = await context.supabase
      .from("contratos_servico")
      .select("id, situacao, condominio_id")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prev) throw new Error("Contrato não encontrado.");

    const motivoTxt =
      data.motivo === "outro" && data.motivoDetalhe
        ? `Outro — ${data.motivoDetalhe}`
        : rotuloMotivo(data.motivo);

    const { error } = await context.supabase
      .from("contratos_servico")
      .update({
        situacao: "encerrado",
        encerrado_em: data.dataEncerramento,
        motivo_encerramento: motivoTxt,
      } as never)
      .eq("id", data.contratoId);
    if (error) throw new Error(error.message);

    try { await cancelarEventosAutomaticosFuturos(context.supabase, data.contratoId); }
    catch (e) { console.warn("[situacao] cancelar eventos:", (e as Error).message); }

    // Atualiza contexto da IA para refletir o encerramento.
    void sincronizarContratoNoAcervo(context.supabase, { contratoId: data.contratoId });

    await registrarAuditoriaContrato({
      contratoId: data.contratoId,
      condominioId: prev.condominio_id as string,
      acao: "contrato.encerrar",
      descricao: `Contrato encerrado em ${data.dataEncerramento} — ${motivoTxt}.`,
      dadosAnteriores: { situacao: prev.situacao },
      dadosNovos: { situacao: "encerrado", encerrado_em: data.dataEncerramento, motivo: motivoTxt },
      userId: context.userId,
    });
    return { ok: true as const };
  });

// ---------------------------------------------------------------- Reabrir

export const reabrirContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: prev, error: pErr } = await context.supabase
      .from("contratos_servico")
      .select("id, situacao, condominio_id")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prev) throw new Error("Contrato não encontrado.");

    const { error } = await context.supabase
      .from("contratos_servico")
      .update({
        situacao: "ativo",
        encerrado_em: null,
        motivo_encerramento: null,
      } as never)
      .eq("id", data.contratoId);
    if (error) throw new Error(error.message);

    try { await gerarEventosInterno(context.supabase, data.contratoId); }
    catch (e) { console.warn("[situacao] regerar eventos:", (e as Error).message); }

    void sincronizarContratoNoAcervo(context.supabase, { contratoId: data.contratoId });

    await registrarAuditoriaContrato({
      contratoId: data.contratoId,
      condominioId: prev.condominio_id as string,
      acao: "contrato.reabrir",
      descricao: "Contrato reaberto e agenda regenerada.",
      dadosAnteriores: { situacao: prev.situacao },
      userId: context.userId,
    });
    return { ok: true as const };
  });

// ---------------------------------------------------------------- Suspender

export const suspenderContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        contratoId: z.string().uuid(),
        motivo: z.string().trim().min(3, "Explique o motivo").max(500),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: prev, error: pErr } = await context.supabase
      .from("contratos_servico")
      .select("id, situacao, condominio_id")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prev) throw new Error("Contrato não encontrado.");

    const { error } = await context.supabase
      .from("contratos_servico")
      .update({
        situacao: "suspenso",
        motivo_encerramento: `Suspenso — ${data.motivo}`,
      } as never)
      .eq("id", data.contratoId);
    if (error) throw new Error(error.message);

    try { await cancelarEventosAutomaticosFuturos(context.supabase, data.contratoId); }
    catch (e) { console.warn("[situacao] cancelar eventos:", (e as Error).message); }

    void sincronizarContratoNoAcervo(context.supabase, { contratoId: data.contratoId });

    await registrarAuditoriaContrato({
      contratoId: data.contratoId,
      condominioId: prev.condominio_id as string,
      acao: "contrato.suspender",
      descricao: `Contrato suspenso — ${data.motivo}`,
      dadosAnteriores: { situacao: prev.situacao },
      userId: context.userId,
    });
    return { ok: true as const };
  });

// ---------------------------------------------------------------- Retomar

export const retomarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: prev, error: pErr } = await context.supabase
      .from("contratos_servico")
      .select("id, situacao, condominio_id")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prev) throw new Error("Contrato não encontrado.");

    const { error } = await context.supabase
      .from("contratos_servico")
      .update({ situacao: "ativo", motivo_encerramento: null } as never)
      .eq("id", data.contratoId);
    if (error) throw new Error(error.message);

    try { await gerarEventosInterno(context.supabase, data.contratoId); }
    catch (e) { console.warn("[situacao] regerar eventos:", (e as Error).message); }

    void sincronizarContratoNoAcervo(context.supabase, { contratoId: data.contratoId });

    await registrarAuditoriaContrato({
      contratoId: data.contratoId,
      condominioId: prev.condominio_id as string,
      acao: "contrato.retomar",
      descricao: "Contrato retomado e agenda regenerada.",
      dadosAnteriores: { situacao: prev.situacao },
      userId: context.userId,
    });
    return { ok: true as const };
  });