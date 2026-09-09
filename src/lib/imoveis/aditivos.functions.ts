import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";

// Carrega todos os dados necessários para pré-preencher o termo de renovação.
export const getDadosAditivo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoLocacaoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: contrato, error } = await context.supabase
      .from("contratos_locacao")
      .select(
        "*, caucoes(*), imoveis(*, proprietarios(*))",
      )
      .eq("id", data.contratoLocacaoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contrato) throw new Error("Contrato não encontrado");
    return contrato;
  });

// Recebe o PDF em base64, faz upload no bucket "contratos" e registra o aditivo.
export const salvarAditivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      contratoLocacaoId: z.string().uuid(),
      dados: z.record(z.string(), z.unknown()),
      pdfBase64: z.string().min(20),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    // Insere o registro primeiro para termos um id.
    const { data: inserted, error: eIns } = await context.supabase
      .from("aditivos")
      .insert({
        contrato_locacao_id: data.contratoLocacaoId,
        tipo: "renovacao",
        dados: data.dados as never,
        owner_admin_id: context.userId,
      })
      .select("id")
      .single();
    if (eIns) throw new Error(eIns.message);
    const aditivoId = inserted.id as string;

    // Decodifica base64 robustamente e faz upload no storage
    const cleanB64 = data.pdfBase64.includes("base64,")
      ? data.pdfBase64.split("base64,")[1]
      : data.pdfBase64;
    const sanitizedB64 = cleanB64.trim().replace(/\s+/g, "");
    const bytes = Buffer.from(sanitizedB64, "base64");
    const path = `${context.userId}/aditivos/${data.contratoLocacaoId}/${aditivoId}.pdf`;
    const { error: eUp } = await context.supabase
      .storage
      .from("contratos")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (eUp) throw new Error(eUp.message);

    const { error: eUpd } = await context.supabase
      .from("aditivos")
      .update({ pdf_url: path })
      .eq("id", aditivoId);
    if (eUpd) throw new Error(eUpd.message);

    return { id: aditivoId, path };
  });

export const listAditivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoLocacaoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("aditivos")
      .select("id, tipo, pdf_url, gerado_em, dados")
      .eq("contrato_locacao_id", data.contratoLocacaoId)
      .order("gerado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getAditivoSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ path: z.string().min(3) }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: signed, error } = await context.supabase
      .storage
      .from("contratos")
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });