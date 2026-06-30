import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listConversas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        condominioId: z.string().uuid(),
        /** Quando true e o solicitante é admin, lista as conversas de TODOS
         * os membros do condomínio (modo visualizador admin — Bloco 7). */
        adminView: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("conversas")
      .select("id, titulo, created_at, user_id")
      .eq("condominio_id", data.condominioId)
      .order("created_at", { ascending: false });

    let isAdmin = false;
    if (data.adminView) {
      const { data: hr } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      isAdmin = !!hr;
    }
    if (!isAdmin) {
      query = query.eq("user_id", context.userId);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    // Em modo admin, anexa nome/email do autor a cada conversa.
    if (isAdmin) {
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      if (userIds.length === 0) return rows;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        autor: byId[r.user_id] ?? null,
      }));
    }
    return rows;
  });

export const createConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ condominioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("conversas")
      .insert({ condominio_id: data.condominioId, user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMensagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("mensagens")
      .select("id, papel, conteudo, created_at")
      .eq("conversa_id", data.conversaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("conversas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lê e (quando necessário) interpreta visualmente um documento anexado
 * diretamente no chat (uso temporário, NÃO persiste em storage). Retorna
 * o texto extraído (truncado) e uma classificação automática.
 */
export const extractAttachmentForChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fileName: z.string().min(1).max(255),
        base64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { extractText, extractTextWithVision } = await import("./documentos.server");
    const { humanizeIngestError, IngestError } = await import("./ingest-errors");

    // Validação de tamanho ANTES de qualquer alocação pesada.
    // base64 cresce ~33% sobre o binário → 14 MB de base64 ≈ 10 MB de arquivo.
    const MAX_B64 = 14 * 1024 * 1024;
    if (data.base64.length > MAX_B64) {
      throw new Error(
        new IngestError(
          "tamanho",
          "Anexo maior que o limite de 10 MB",
          "Comprima ou divida o arquivo antes de enviar.",
        ).toHuman(),
      );
    }

    // base64 -> Uint8Array
    const binStr = atob(data.base64);
    const buffer = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) buffer[i] = binStr.charCodeAt(i);

    let text = "";
    try {
      text = await extractText(buffer, data.fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "__NEEDS_VISION__") {
        try {
          text = await extractTextWithVision(apiKey, buffer, data.fileName);
        } catch (visErr) {
          throw new Error(humanizeIngestError(visErr, "ocr").toHuman());
        }
      } else {
        throw new Error(humanizeIngestError(err, "leitura").toHuman());
      }
    }
    text = text.trim();
    if (!text) {
      throw new Error(
        new IngestError(
          "ocr",
          "Não foi possível ler o conteúdo do documento",
          "Verifique se o arquivo está legível e tente novamente.",
        ).toHuman(),
      );
    }

    // Trunca para contexto da conversa (mantém os primeiros ~14k chars)
    const MAX = 14000;
    const excerpt = text.length > MAX ? text.slice(0, MAX) + "\n\n…[conteúdo truncado]…" : text;

    // Classificação automática via Gemini
    let classificacao: "ata" | "convencao" | "regimento" | "outro" = "outro";
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você classifica documentos de condomínio. Responda APENAS uma das palavras: ata, convencao, regimento, outro. Sem aspas, sem pontuação, sem explicações.",
            },
            {
              role: "user",
              content: `Nome do arquivo: ${data.fileName}\n\nTrecho inicial do documento:\n${text.slice(0, 4000)}`,
            },
          ],
          temperature: 0,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = (json.choices?.[0]?.message?.content ?? "").toLowerCase().trim();
        if (raw.includes("ata")) classificacao = "ata";
        else if (raw.includes("conven")) classificacao = "convencao";
        else if (raw.includes("regim")) classificacao = "regimento";
      }
    } catch {
      /* classificação é best-effort */
    }

    return { excerpt, classificacao, fileName: data.fileName, chars: text.length };
  });