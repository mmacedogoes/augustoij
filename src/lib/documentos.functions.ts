import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { PLANOS, type PlanoId as PlanoIdV2 } from "@/config/planos";
import { resolvePlanId, isTrialExpired, gateMessages, efetivoPlanoId } from "@/lib/plan-gates";
import { isAdminInternoServer } from "@/lib/admin-bypass";

/**
 * Verifica se o usuário logado pode enviar mais um documento no condomínio
 * (aplicado tanto em getUploadUrl quanto em createDocumento).
 */
async function assertUploadPermitido(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  condominioId: string,
  tipo?: string,
) {
  const { getSubscriptionEfetiva } = await import("@/lib/conta-master.server");
  const [sub, docsRes, admin] = await Promise.all([
    getSubscriptionEfetiva(userId),
    supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", condominioId),
    isAdminInternoServer(supabase, userId),
  ]);
  const planoBruto = resolvePlanId(sub?.plano_config_id ?? null);
  const cortesia = sub?.cortesia === true || admin;
  const planoId = efetivoPlanoId(planoBruto, cortesia);
  const plano = PLANS[planoId];
  if (!cortesia && isTrialExpired(planoBruto, sub?.trial_end ?? null)) {
    throw new Error(gateMessages.trialExpirado());
  }


  // Regras específicas do plano Gratuito: 1 Convenção + 1 Contrato,
  // contadas entre todos os condomínios do usuário (owner_id).
  const planoV2Id: PlanoIdV2 = (planoId as string) in PLANOS ? (planoId as PlanoIdV2) : "gratuito";
  const planoV2 = PLANOS[planoV2Id];
  if (!cortesia && planoV2Id === "gratuito") {
    const tipoNormalizado = tipo ?? null;
    if (tipoNormalizado && !["convencao", "contrato"].includes(tipoNormalizado)) {
      throw new Error(gateMessages.uploadGratuitoBloqueado());
    }
    const countOwnerTipo = async (t: "convencao" | "contrato") => {
      const { count } = await supabase
        .from("documentos")
        .select("id, condominios!inner(owner_id)", { count: "exact", head: true })
        .eq("condominios.owner_id", userId)
        .eq("tipo", t);
      return count ?? 0;
    };
    if (tipoNormalizado === "convencao") {
      if ((await countOwnerTipo("convencao")) >= 1) {
        throw new Error(gateMessages.uploadGratuitoConvencao());
      }
    } else if (tipoNormalizado === "contrato") {
      if ((await countOwnerTipo("contrato")) >= 1) {
        throw new Error(gateMessages.uploadGratuitoContrato());
      }
    } else {
      // sem tipo (fluxo de getUploadUrl): permite se houver ao menos um dos slots livres
      const [cCv, cCt] = await Promise.all([countOwnerTipo("convencao"), countOwnerTipo("contrato")]);
      if (cCv >= 1 && cCt >= 1) {
        throw new Error(gateMessages.uploadGratuitoBloqueado());
      }
    }
    return;
  }

  // Planos pagos: se "documentosIlimitados" for true, nada a impor.
  if (planoV2.limites.documentosIlimitados) return;

  // Compat: fallback à regra antiga (não deveria ser alcançada com planos atuais).
  if (!plano.recursos.uploadDocumentos) {
    throw new Error(gateMessages.uploadDesabilitado(plano.nome));
  }
  const atual = docsRes.count ?? 0;
  if (plano.documentosMax !== null && atual >= plano.documentosMax) {
    throw new Error(gateMessages.documentosMax(plano.nome, plano.documentosMax));
  }
}

const BUCKET = "documentos";

export const listDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ condominioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("documentos")
      .select("id, nome_arquivo, titulo, tipo, status_processamento, processamento_meta, storage_path, created_at")
      .eq("condominio_id", data.condominioId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const tipoEnum = z.enum([
  "convencao",
  "regimento",
  "ata",
  "contrato",
  "laudo_tecnico",
  "previsao_orcamentaria",
  "prestacao_contas",
  "comunicado",
  "outro",
]);

export const createDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        condominioId: z.string().uuid(),
        nomeArquivo: z.string().min(1).max(255),
        titulo: z.string().trim().min(1).max(120).optional().nullable(),
        tipo: tipoEnum,
        storagePath: z.string().min(1),
        /** Documentos gerados pelo próprio Augusto não precisam de indexação. */
        indexar: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertUploadPermitido(context.supabase, context.userId, data.condominioId, data.tipo);
    const { data: row, error } = await context.supabase
      .from("documentos")
      .insert({
        condominio_id: data.condominioId,
        nome_arquivo: data.nomeArquivo,
        titulo: data.titulo ?? null,
        tipo: data.tipo,
        storage_path: data.storagePath,
        status_processamento: data.indexar === false ? "pronto" : "processando",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc, error: errGet } = await context.supabase
      .from("documentos")
      .select("id, storage_path, condominio_id")
      .eq("id", data.id)
      .maybeSingle();
    if (errGet) throw new Error(errGet.message);
    if (!doc) throw new Error("Documento não encontrado");

    await context.supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error: errDel } = await context.supabase.from("documentos").delete().eq("id", doc.id);
    if (errDel) throw new Error(errDel.message);
    return { ok: true };
  });

export const processDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const { processarDocumentoCore } = await import("./documentos-processar.server");
    return await processarDocumentoCore(context.supabase, context.userId, data.id, apiKey);
  });

/**
 * Relê um documento já enviado com o motor atual (OCR por blocos de páginas).
 * A leitura é retomável: por padrão continua de onde parou; `reiniciar: true`
 * apaga os trechos e recomeça do zero.
 */
export const reprocessarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reiniciar: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    // RLS garante que o usuário só enxerga documentos dos seus condomínios.
    const { data: doc, error } = await context.supabase
      .from("documentos")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado");

    const { processarDocumentoCore, limparChunks } = await import(
      "./documentos-processar.server"
    );
    if (data.reiniciar) await limparChunks(data.id);
    return await processarDocumentoCore(context.supabase, context.userId, data.id, apiKey);
  });



export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        condominioId: z.string().uuid(),
        nomeArquivo: z.string().min(1).max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertUploadPermitido(context.supabase, context.userId, data.condominioId);
    const safeName = data.nomeArquivo.replace(/[^\w.\-]+/g, "_");
    const path = `${data.condominioId}/${Date.now()}_${safeName}`;
    const { data: signed, error } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const getDocumentoViewUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documentos")
      .select("id, storage_path, nome_arquivo")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirma que o arquivo existe no storage antes de assinar a URL.
    const barra = doc.storage_path.lastIndexOf("/");
    const pasta = barra >= 0 ? doc.storage_path.slice(0, barra) : "";
    const arquivo = barra >= 0 ? doc.storage_path.slice(barra + 1) : doc.storage_path;
    const { data: encontrados } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(pasta, { search: arquivo, limit: 100 });
    if (!encontrados?.some((f) => f.name === arquivo)) {
      throw new Error(
        "O arquivo não está mais disponível no armazenamento. O upload pode ter falhado — exclua este registro e envie o documento novamente.",
      );
    }
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 3600);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Falha ao gerar link do documento");
    return { url: signed.signedUrl, nome: doc.nome_arquivo };
  });
