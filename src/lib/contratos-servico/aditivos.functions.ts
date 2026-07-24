/**
 * Aditivos contratuais (Fase 6, Parte D).
 *
 * Efeitos ao registrar/editar um aditivo (todos com confirmação na tela):
 * - altera_valor: atualiza `contratos_servico.valor` e registra uma linha em
 *   `contrato_reajustes` com fonte "manual" (mantém histórico financeiro).
 * - altera_vigencia: atualiza `data_fim` e regenera a agenda de eventos.
 * - altera_escopo: apenas o resumo. A extração de novas obrigações a partir
 *   do arquivo do aditivo é feita separadamente e sempre passa por revisão.
 *
 * Remover um aditivo NÃO desfaz efeitos já aplicados — o cliente exibe
 * esse aviso no diálogo de confirmação.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { gerarEventosInterno } from "./eventos.functions";
import { registrarAuditoriaContrato } from "./auditoria.server";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const listInput = z.object({ contratoId: z.string().uuid() });

export const listAditivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => listInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("contrato_aditivos")
      .select(
        "id, numero, data_assinatura, altera_valor, altera_vigencia, altera_escopo, valor_anterior, valor_novo, data_fim_anterior, vigencia_nova_fim, resumo_alteracoes, arquivo_path, created_at",
      )
      .eq("contrato_id", data.contratoId)
      .order("data_assinatura", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const upsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    contratoId: z.string().uuid(),
    numero: z.string().trim().max(60).optional().nullable(),
    dataAssinatura: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Data inválida"),
    alteraValor: z.boolean().default(false),
    alteraVigencia: z.boolean().default(false),
    alteraEscopo: z.boolean().default(false),
    valorNovo: z.number().positive().optional().nullable(),
    vigenciaNovaFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional().nullable(),
    resumoAlteracoes: z.string().trim().min(3, "Descreva o que foi alterado").max(2000),
    arquivoBase64: z.string().optional().nullable(),
    arquivoNome: z.string().optional().nullable(),
    arquivoMime: z.string().optional().nullable(),
  })
  .refine((v) => v.alteraValor || v.alteraVigencia || v.alteraEscopo, {
    message: "Selecione ao menos um tipo de alteração",
  })
  .refine((v) => !v.alteraValor || (v.valorNovo !== null && v.valorNovo !== undefined), {
    message: "Informe o novo valor",
  })
  .refine((v) => !v.alteraVigencia || !!v.vigenciaNovaFim, {
    message: "Informe a nova data de fim",
  });

export const upsertAditivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => upsertSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    // Carrega estado atual do contrato para "antes/depois".
    const { data: contrato, error: cErr } = await context.supabase
      .from("contratos_servico")
      .select("id, condominio_id, valor, data_fim, prazo_indeterminado, situacao")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contrato) throw new Error("Contrato não encontrado.");

    // Upload de arquivo (opcional). Nunca reutiliza um path existente ao editar
    // — geramos um novo path para não sobrescrever versões anteriores.
    let arquivoPath: string | null = null;
    if (data.arquivoBase64 && data.arquivoBase64.length > 20) {
      const mime = data.arquivoMime || "application/octet-stream";
      if (!ALLOWED_MIMES.has(mime)) throw new Error("Formato não suportado. Envie PDF, DOCX ou TXT.");
      const bytes = base64ToBytes(data.arquivoBase64);
      if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
      if (bytes.byteLength > MAX_BYTES) throw new Error("Arquivo maior que 10 MB.");
      const safeName = (data.arquivoNome ?? "aditivo.pdf")
        .replace(/[^\w.\-]+/g, "_").slice(-120);
      arquivoPath = `${context.userId}/aditivos-servico/${data.contratoId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await context.supabase.storage
        .from("contratos")
        .upload(arquivoPath, bytes, { contentType: mime, upsert: false });
      if (upErr) throw new Error(`Falha ao enviar arquivo: ${upErr.message}`);
    }

    const valorAnterior = data.alteraValor ? Number(contrato.valor ?? 0) : null;
    const dataFimAnterior = data.alteraVigencia ? (contrato.data_fim as string | null) : null;

    const payload = {
      contrato_id: data.contratoId,
      numero: data.numero ?? null,
      data_assinatura: data.dataAssinatura,
      altera_valor: data.alteraValor,
      altera_vigencia: data.alteraVigencia,
      altera_escopo: data.alteraEscopo,
      valor_anterior: valorAnterior,
      valor_novo: data.alteraValor ? data.valorNovo ?? null : null,
      data_fim_anterior: dataFimAnterior,
      vigencia_nova_fim: data.alteraVigencia ? data.vigenciaNovaFim ?? null : null,
      resumo_alteracoes: data.resumoAlteracoes,
      arquivo_path: arquivoPath ?? undefined,
    };

    let aditivoId: string;
    if (data.id) {
      const upd: Record<string, unknown> = { ...payload };
      if (arquivoPath === null) delete upd.arquivo_path; // não apaga arquivo existente
      const { error } = await context.supabase
        .from("contrato_aditivos")
        .update(upd as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      aditivoId = data.id;
    } else {
      const { data: ins, error } = await context.supabase
        .from("contrato_aditivos")
        .insert({ ...payload, arquivo_path: arquivoPath, criado_por: context.userId } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      aditivoId = ins.id as string;
    }

    // ------ Efeitos ------
    const contratoUpdates: Record<string, unknown> = {};
    if (data.alteraValor && data.valorNovo && data.valorNovo > 0) {
      contratoUpdates.valor = data.valorNovo;
    }
    if (data.alteraVigencia && data.vigenciaNovaFim) {
      contratoUpdates.data_fim = data.vigenciaNovaFim;
      contratoUpdates.prazo_indeterminado = false;
    }
    if (Object.keys(contratoUpdates).length > 0) {
      const { error: eUp } = await context.supabase
        .from("contratos_servico")
        .update(contratoUpdates as never)
        .eq("id", data.contratoId);
      if (eUp) throw new Error(eUp.message);
    }

    // Espelha alteração de valor no histórico financeiro (fonte manual).
    if (data.alteraValor && data.valorNovo && data.valorNovo > 0 && valorAnterior !== null) {
      const pct = valorAnterior > 0
        ? ((data.valorNovo - valorAnterior) / valorAnterior) * 100
        : 0;
      const { error: eRj } = await context.supabase
        .from("contrato_reajustes")
        .insert({
          contrato_id: data.contratoId,
          competencia: data.dataAssinatura,
          valor_anterior: valorAnterior,
          valor_novo: data.valorNovo,
          indice_utilizado: "Aditivo",
          percentual_indice: null,
          percentual_aplicado: Number(pct.toFixed(4)),
          fonte: "manual",
          observacao: `Reajuste registrado via aditivo${data.numero ? ` nº ${data.numero}` : ""}.`,
        } as never);
      if (eRj && !/23505|duplicate key/i.test(eRj.message)) {
        console.warn("[aditivos] falha ao criar linha em contrato_reajustes:", eRj.message);
      } else if (!eRj) {
        await context.supabase
          .from("contratos_servico")
          .update({ ultimo_reajuste_em: data.dataAssinatura } as never)
          .eq("id", data.contratoId);
      }
    }

    // Regenera agenda quando a vigência muda.
    if (data.alteraVigencia) {
      try { await gerarEventosInterno(context.supabase, data.contratoId); }
      catch (e) { console.warn("[aditivos] regerar eventos:", (e as Error).message); }
    }

    // Auditoria
    const partes: string[] = [];
    if (data.alteraValor) partes.push(`valor: ${valorAnterior ?? "—"} → ${data.valorNovo}`);
    if (data.alteraVigencia) partes.push(`vigência: ${dataFimAnterior ?? "—"} → ${data.vigenciaNovaFim}`);
    if (data.alteraEscopo) partes.push("escopo");
    await registrarAuditoriaContrato({
      contratoId: data.contratoId,
      condominioId: contrato.condominio_id as string,
      acao: data.id ? "aditivo.editar" : "aditivo.registrar",
      descricao: `Aditivo${data.numero ? ` nº ${data.numero}` : ""} registrado (${partes.join(", ")}).`,
      dadosNovos: { aditivoId, ...data, arquivoBase64: undefined },
      userId: context.userId,
    });

    return { id: aditivoId };
  });

export const removeAditivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: row, error } = await context.supabase
      .from("contrato_aditivos")
      .select("id, contrato_id, numero, arquivo_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Aditivo não encontrado.");

    const { error: eDel } = await context.supabase
      .from("contrato_aditivos")
      .delete()
      .eq("id", data.id);
    if (eDel) throw new Error(eDel.message);

    if (row.arquivo_path) {
      await context.supabase.storage.from("contratos").remove([row.arquivo_path]).catch(() => {});
    }

    await registrarAuditoriaContrato({
      contratoId: row.contrato_id as string,
      acao: "aditivo.remover",
      descricao: `Aditivo${row.numero ? ` nº ${row.numero}` : ""} removido. Efeitos já aplicados no contrato foram preservados.`,
      userId: context.userId,
    });
    return { ok: true as const };
  });

export const getAditivoArquivoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: row, error } = await context.supabase
      .from("contrato_aditivos")
      .select("arquivo_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.arquivo_path) return { url: null as string | null };
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("contratos")
      .createSignedUrl(row.arquivo_path, 3600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });