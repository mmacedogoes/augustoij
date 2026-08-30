import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sugestões estruturadas de unidades e condôminos extraídas por IA.
 * Nenhuma dessas funções grava em `unidades` / `condominos` — apenas devolve
 * o payload para o usuário revisar e depois confirmar via importUnidadesLote.
 */

const UnidadeSugestao = z.object({
  bloco: z.string().nullable().optional(),
  numero: z.string(),
  tipo: z
    .enum([
      "apartamento",
      "casa",
      "lote",
      "terreno",
      "sala_comercial",
      "loja",
      "galpao",
      "vaga_avulsa",
      "outro",
    ])
    .optional(),
  fracao_ideal: z.number().nullable().optional(),
  area_m2: z.number().nullable().optional(),
  vagas_garagem: z.number().int().min(0).max(50).optional(),
  fracao_origem: z.enum(["documento", "ausente"]).nullable().optional(),
  area_origem: z.enum(["documento", "ausente"]).nullable().optional(),
});

const CondominoSugestao = z.object({
  bloco: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  unidade_id: z.string().uuid().nullable().optional(),
  nome: z.string(),
  cpf: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  tipo_condomino: z
    .enum(["proprietario", "inquilino", "morador", "responsavel_legal"])
    .optional(),
  match_status: z.enum(["ok", "ambiguo", "sem_match"]).optional(),
});

type UnidadeSugerida = z.infer<typeof UnidadeSugestao>;

export const extrairUnidadesDaConvencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentoId: string; persistir?: boolean }) =>
    z
      .object({
        documentoId: z.string().uuid(),
        persistir: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { data: doc, error } = await context.supabase
      .from("documentos")
      .select("id, condominio_id, tipo, status_processamento, nome_arquivo")
      .eq("id", data.documentoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado.");
    await assertOwnerCondominio(context.supabase, context.userId, doc.condominio_id);
    if (doc.status_processamento !== "pronto") {
      throw new Error("Documento ainda não foi processado.");
    }

    const { extrairESalvarSugestaoUnidades } = await import("./unidades-extracao.server");
    const unidades = await extrairESalvarSugestaoUnidades(
      context.supabase,
      doc.id,
      apiKey,
    );
    return { unidades, documentoId: doc.id, condominioId: doc.condominio_id };
  });

export const listSugestoesUnidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string }) =>
    z.object({ condominioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sugestoes_unidades")
      .select("id, documento_id, payload, status, created_at")
      .eq("condominio_id", data.condominioId)
      .in("status", ["pendente", "falhou"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const atualizarStatusSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "aplicada" | "descartada" }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aplicada", "descartada"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sugestoes_unidades")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extrairCondominosDeArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string; fileName: string; base64: string }) =>
    z
      .object({
        condominioId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        base64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const { assertAcessoCondominio } = await import("./unidades-acesso.server");
    await assertAcessoCondominio(context.supabase, context.userId, data.condominioId);

    const { extractText, extractTextWithVision } = await import("./documentos.server");
    const { humanizeIngestError, IngestError } = await import("./ingest-errors");

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

    const bin = atob(data.base64);
    const buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);

    let texto = "";
    try {
      texto = await extractText(buffer, data.fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "__NEEDS_VISION__") {
        try {
          texto = await extractTextWithVision(apiKey, buffer, data.fileName);
        } catch (vErr) {
          throw new Error(humanizeIngestError(vErr, "ocr").toHuman());
        }
      } else {
        throw new Error(humanizeIngestError(err, "leitura").toHuman());
      }
    }
    texto = texto.trim();
    if (!texto) throw new Error("Não foi possível ler o conteúdo do arquivo.");
    if (texto.length > 40000) texto = texto.slice(0, 40000);

    const { data: unidades, error: uErr } = await context.supabase
      .from("unidades")
      .select("id, bloco, numero")
      .eq("condominio_id", data.condominioId);
    if (uErr) throw new Error(uErr.message);
    const unidadesResumo = (unidades ?? []).map((u) => ({
      id: u.id as string,
      bloco: (u.bloco as string) ?? null,
      numero: u.numero as string,
    }));

    const system =
      "Você é um assistente que extrai listas de condôminos de arquivos (CSV, planilhas, DOCX, PDF) " +
      "para um sistema de gestão condominial brasileiro. Retorne TODOS os condôminos identificados. " +
      'Formato JSON EXCLUSIVO: {"condominos":[{"bloco":string|null,"numero":string|null,' +
      '"nome":string,"cpf":string|null,"email":string|null,"telefone":string|null,' +
      '"tipo_condomino":"proprietario|inquilino|morador|responsavel_legal","match_status":"ok|ambiguo|sem_match"}]}. ' +
      "Use match_status=ok quando o par (bloco,numero) casa exatamente com uma unidade existente; " +
      "ambiguo quando há mais de uma opção plausível; sem_match quando não casou com nenhuma. " +
      "Não invente dados que não estejam no arquivo.";
    const user =
      `Unidades já cadastradas neste condomínio (JSON):\n${JSON.stringify(unidadesResumo).slice(0, 8000)}\n\n` +
      `Arquivo: ${data.fileName}\n\nConteúdo extraído:\n\n${texto}`;

    const { chamarIaJson } = await import("./unidades-extracao.server");
    const chamada = await chamarIaJson(apiKey, system, user);
    try {
      const { registrarEventoIa } = await import("./uso-ia.server");
      await registrarEventoIa({
        userId: context.userId,
        condominioId: data.condominioId,
        origem: "importacao_convencao",
        model: chamada.model,
        tokensInput: chamada.usage.prompt_tokens,
        tokensOutput: chamada.usage.completion_tokens,
        aigLogId: chamada.aigLogId,
        aigRunId: chamada.aigRunId,
        meta: { contexto: "extrair_condominos", arquivo: data.fileName },
      });
    } catch (err) {
      console.error("[uso-ia] extrair_condominos:", err);
    }
    const parsed = chamada.data as { condominos?: unknown[] };
    const linhas = z.array(CondominoSugestao).safeParse(parsed?.condominos ?? []);
    const condominos = linhas.success ? linhas.data : [];

    return { condominos, unidades: unidadesResumo };
  });

export const detectarUnidadesConvencaoExistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string; force?: boolean }) =>
    z
      .object({
        condominioId: z.string().uuid(),
        force: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const { assertAcessoCondominio } = await import("./unidades-acesso.server");
    await assertAcessoCondominio(context.supabase, context.userId, data.condominioId);

    const { data: doc } = await context.supabase
      .from("documentos")
      .select("id")
      .eq("condominio_id", data.condominioId)
      .eq("tipo", "convencao")
      .eq("status_processamento", "pronto")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc) return { status: "sem_convencao" as const };

    if (!data.force) {
      const { data: existente } = await context.supabase
        .from("sugestoes_unidades")
        .select("id, status")
        .eq("documento_id", doc.id)
        .limit(1)
        .maybeSingle();
      if (existente) return { status: "ja_processada" as const };
    }

    const { extrairESalvarSugestaoUnidades } = await import("./unidades-extracao.server");
    const unidades = await extrairESalvarSugestaoUnidades(
      context.supabase,
      doc.id,
      apiKey,
      { force: data.force },
    );
    if (unidades.length === 0) {
      return { status: "vazio" as const, documentoId: doc.id };
    }
    return { status: "gerada" as const, unidades, documentoId: doc.id };
  });

/**
 * Reprocessamento REAL da convenção:
 *  1. baixa o PDF original do storage;
 *  2. extrai texto — se o resultado for pobre (poucas keywords de unidade),
 *     força fallback de visão/OCR mesmo que exista camada de texto;
 *  3. reindexa (apaga chunks antigos, recria com novos embeddings);
 *  4. executa a extração de unidades com force=true.
 * Retorna status descritivo para a UI mostrar mensagem específica.
 */
export const reprocessarConvencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string }) =>
    z.object({ condominioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    await assertOwnerCondominio(context.supabase, context.userId, data.condominioId);

    const { data: doc } = await context.supabase
      .from("documentos")
      .select("id, storage_path, nome_arquivo")
      .eq("condominio_id", data.condominioId)
      .eq("tipo", "convencao")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc) return { status: "sem_convencao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractText, extractTextWithVision, chunkText } = await import(
      "./documentos.server"
    );
    const { embedChunksParallel } = await import("./ai-gateway.server");

    // 1) baixa arquivo original
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("documentos")
      .download(doc.storage_path);
    if (dlErr || !file) {
      return { status: "erro_download" as const, mensagem: dlErr?.message ?? "" };
    }
    const buffer = new Uint8Array(await file.arrayBuffer());

    // 2) extrai texto (com fallback e detecção de texto "ruim")
    const RE_UNIDADE =
      /(unidade|apart|apto|fra[cç][aã]o|lote|quadra|bloco|garag|vaga|área privativa|coeficiente|sala|loja|piso|pavimento|galp[aã]o|setor|m[oó]dulo|torre)/gi;
    let texto = "";
    let modo: "texto" | "visao_forcada" | "visao_fallback" = "texto";
    try {
      texto = await extractText(buffer, doc.nome_arquivo);
    } catch (err) {
      if (err instanceof Error && err.message === "__NEEDS_VISION__") {
        modo = "visao_fallback";
        // preserva buffer: extractText do PDF detach o array — precisamos recopiar
        const copy = new Uint8Array(buffer.byteLength);
        copy.set(buffer);
        texto = await extractTextWithVision(apiKey, copy, doc.nome_arquivo);
      } else {
        return {
          status: "erro_leitura" as const,
          mensagem: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const hits = (texto.match(RE_UNIDADE) ?? []).length;
    const densidade = texto.length > 0 ? hits / (texto.length / 1000) : 0;
    // Texto suspeito: mais de 1500 chars mas menos de 1 keyword de unidade a
    // cada 1000 chars → provável ruído (headers PJe/carimbos). Força OCR/visão.
    if (modo === "texto" && texto.length > 1500 && densidade < 1 && buffer.byteLength > 0) {
      try {
        const copy = new Uint8Array(buffer.byteLength);
        copy.set(buffer);
        texto = await extractTextWithVision(apiKey, copy, doc.nome_arquivo);
        modo = "visao_forcada";
      } catch {
        // mantém o texto original — tenta indexar assim mesmo
      }
    }

    if (!texto.trim()) {
      return { status: "vazio_extracao" as const };
    }

    // 3) reindexa chunks
    await supabaseAdmin.from("document_chunks").delete().eq("documento_id", doc.id);
    const chunks = chunkText(texto);
    const { embeddings, totalTokens: embTokens } = await embedChunksParallel(
      apiKey,
      chunks,
      5,
    );
    try {
      const { registrarEventoIa } = await import("./uso-ia.server");
      const { EMBEDDING_MODEL } = await import("./ai-gateway.server");
      await registrarEventoIa({
        userId: context.userId,
        condominioId: data.condominioId,
        origem: "embedding_documento",
        model: EMBEDDING_MODEL,
        tokensInput: embTokens,
        meta: { documento_id: doc.id, chunks: chunks.length, contexto: "reprocessarConvencao" },
      });
    } catch (err) {
      console.error("[uso-ia] reprocessarConvencao embed:", err);
    }
    const rows = chunks.map((c, i) => ({
      condominio_id: data.condominioId,
      documento_id: doc.id,
      conteudo: c,
      embedding: `[${embeddings[i].join(",")}]`,
    }));

    // Se caiu no fallback de visão, também registra o custo do OCR
    if (modo === "visao_forcada" || modo === "visao_fallback") {
      try {
        const { registrarEventoIa } = await import("./uso-ia.server");
        await registrarEventoIa({
          userId: context.userId,
          condominioId: data.condominioId,
          origem: "ocr_visao_documento",
          model: "google/gemini-3-flash-preview",
          // Sem usage do gateway aqui (chamada em documentos.server.ts não
          // retorna). Estimamos por tamanho do texto retornado (~4 chars/token).
          tokensOutput: Math.ceil(texto.length / 4),
          meta: { documento_id: doc.id, contexto: "reprocessarConvencao", modo },
        });
      } catch (err) {
        console.error("[uso-ia] reprocessarConvencao ocr:", err);
      }
    }
    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      const { error: insErr } = await supabaseAdmin
        .from("document_chunks")
        .insert(slice);
      if (insErr) {
        return { status: "erro_indexacao" as const, mensagem: insErr.message };
      }
    }
    await supabaseAdmin
      .from("documentos")
      .update({ status_processamento: "pronto" })
      .eq("id", doc.id);

    // 4) roda extração de unidades já com o texto novo
    let unidades: UnidadeSugerida[] = [];
    try {
      unidades = await _extrairESalvarSugestaoUnidades(
        context.supabase,
        doc.id,
        apiKey,
        { force: true },
      );
    } catch (err) {
      if (err instanceof ExtracaoIncompletaError) {
        return {
          status: "incompleta" as const,
          documentoId: doc.id,
          mensagem: err.message,
          modo,
          chunks: chunks.length,
        };
      }
      throw err;
    }
    if (unidades.length === 0) {
      return {
        status: "sem_unidades" as const,
        documentoId: doc.id,
        modo,
        chunks: chunks.length,
      };
    }
    return {
      status: "gerada" as const,
      documentoId: doc.id,
      unidades,
      modo,
      chunks: chunks.length,
    };
  });
