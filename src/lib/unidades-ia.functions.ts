import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sugestões estruturadas de unidades e condôminos extraídas por IA.
 * Nenhuma dessas funções grava em `unidades` / `condominos` — apenas devolve
 * o payload para o usuário revisar e depois confirmar via importUnidadesLote.
 */

const MedidaSugestao = z.object({
  campo: z.string(),
  valor_bruto: z.string(),
  escala: z.string(),
  trecho: z.string(),
  pagina: z.number().nullable().optional(),
  bloco: z.number().nullable().optional(),
  fonte: z.string().nullable().optional(),
});

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
  confianca: z.enum(["alta", "media", "conflito"]).optional(),
  medidas: z.array(MedidaSugestao).optional(),
  candidatos: z.record(z.string(), z.array(MedidaSugestao)).optional(),
  regras_aplicadas: z.array(z.string()).optional(),
});

const CondominoSugestao = z.object({
  bloco: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  unidade_id: z.string().uuid().nullable().optional(),
  nome: z.string(),
  cpf: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  tipo_condomino: z.enum(["proprietario", "inquilino", "morador", "responsavel_legal"]).optional(),
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin
      .from("documentos")
      .select("id, condominio_id, tipo, status_processamento, nome_arquivo")
      .eq("id", data.documentoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado.");
    const { assertAcessoCondominio } = await import("./unidades-acesso.server");
    await assertAcessoCondominio(context.supabase, context.userId, doc.condominio_id);
    if (doc.status_processamento !== "pronto") {
      throw new Error("Documento ainda não foi processado.");
    }

    try {
      const { extrairESalvarSugestaoUnidades } = await import("./unidades-extracao.server");
      const unidades = await extrairESalvarSugestaoUnidades(supabaseAdmin, doc.id, apiKey);
      return {
        status: "gerada" as const,
        unidades,
        documentoId: doc.id,
        condominioId: doc.condominio_id,
      };
    } catch (err: unknown) {
      const controlado =
        typeof err === "object" &&
        err !== null &&
        "codigo" in err &&
        (err as { codigo?: unknown }).codigo === "extracao_incompleta";
      if (controlado) {
        return {
          status: "incompleta" as const,
          unidades: [] as UnidadeSugerida[],
          documentoId: doc.id,
          condominioId: doc.condominio_id,
          mensagem: err instanceof Error ? err.message : "A extração requer revisão.",
        };
      }
      throw err;
    }
  });

export const listSugestoesUnidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string }) =>
    z.object({ condominioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAcessoCondominio } = await import("./unidades-acesso.server");
    await assertAcessoCondominio(context.supabase, context.userId, data.condominioId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("sugestoes_unidades")
      .select("id, documento_id, payload, status, created_at")
      .eq("condominio_id", data.condominioId)
      .in("status", ["pendente", "pendente_revisao", "falhou"])
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
    const { data: sugestao, error: readError } = await context.supabase
      .from("sugestoes_unidades")
      .select("condominio_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!sugestao) throw new Error("Sugestão não encontrada.");
    const { assertAcessoCondominio } = await import("./unidades-acesso.server");
    await assertAcessoCondominio(context.supabase, context.userId, sugestao.condominio_id);
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

    // Limite alinhado à memória do runtime: 20 MB de base64 ≈ 15 MB de arquivo.
    const MAX_B64 = 20 * 1024 * 1024;
    if (data.base64.length > MAX_B64) {
      throw new Error(
        new IngestError(
          "tamanho",
          "Anexo maior que o limite de 15 MB",
          "Comprima ou divida o arquivo antes de enviar.",
        ).toHuman(),
      );
    }

    const buffer =
      typeof Buffer !== "undefined"
        ? new Uint8Array(Buffer.from(data.base64, "base64"))
        : (() => {
            const bin = atob(data.base64);
            const out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out;
          })();


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
    if (texto.length > 40000) {
      throw new Error(
        "A lista de condôminos excede o limite de uma análise única. Divida o arquivo em partes para garantir que nenhuma pessoa seja omitida.",
      );
    }

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
  .inputValidator((input: { condominioId: string; force?: boolean; documentoId?: string }) =>
    z
      .object({
        condominioId: z.string().uuid(),
        force: z.boolean().optional().default(false),
        documentoId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const { assertAcessoCondominio } = await import("./unidades-acesso.server");
    await assertAcessoCondominio(context.supabase, context.userId, data.condominioId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("documentos")
      .select("id, status_processamento")
      .eq("condominio_id", data.condominioId)
      .eq("tipo", "convencao")
      .eq("status_processamento", "pronto")
      .order("created_at", { ascending: false });

    if (data.documentoId) {
      query = query.eq("id", data.documentoId);
    }

    const { data: docs } = await query;
    if (!docs || docs.length === 0) return { status: "sem_convencao" as const };

    let ultimoErroControlado: string | null = null;
    let ultimoDocId = docs[0].id;

    for (const doc of docs) {
      ultimoDocId = doc.id;
      if (!data.force) {
        const { data: existente } = await context.supabase
          .from("sugestoes_unidades")
          .select("id, status")
          .eq("documento_id", doc.id)
          .limit(1)
          .maybeSingle();
        if (existente) return { status: "ja_processada" as const };
      }

      try {
        const { extrairESalvarSugestaoUnidades } = await import("./unidades-extracao.server");
        const unidades = await extrairESalvarSugestaoUnidades(supabaseAdmin, doc.id, apiKey);
        if (unidades.length > 0) {
          return { status: "gerada" as const, unidades, documentoId: doc.id };
        }
      } catch (err: unknown) {
        const controlado =
          typeof err === "object" &&
          err !== null &&
          "codigo" in err &&
          (err as { codigo?: unknown }).codigo === "extracao_incompleta";
        if (controlado) {
          ultimoErroControlado = err instanceof Error ? err.message : "A extração requer revisão.";
          continue;
        }
        throw err;
      }
    }

    if (ultimoErroControlado) {
      return {
        status: "incompleta" as const,
        documentoId: ultimoDocId,
        mensagem: ultimoErroControlado,
      };
    }

    return { status: "vazio" as const, documentoId: ultimoDocId };
  });

export const reprocessarConvencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      condominioId: string;
      documentoId?: string;
      paginaInicio?: number;
      paginaFim?: number;
      reiniciar?: boolean;
      somenteLotesPendentes?: boolean;
    }) =>
      z
        .object({
          condominioId: z.string().uuid(),
          documentoId: z.string().uuid().optional(),
          paginaInicio: z.number().int().positive().optional(),
          paginaFim: z.number().int().positive().optional(),
          reiniciar: z.boolean().optional(),
          somenteLotesPendentes: z.boolean().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const { assertAcessoCondominio } = await import("./unidades-acesso.server");
    await assertAcessoCondominio(context.supabase, context.userId, data.condominioId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("documentos")
      .select("id, status_processamento, nome_arquivo")
      .eq("condominio_id", data.condominioId)
      .eq("tipo", "convencao")
      .order("created_at", { ascending: false });

    if (data.documentoId) {
      query = query.eq("id", data.documentoId);
    }

    const { data: docs } = await query;
    if (!docs || docs.length === 0) return { status: "sem_convencao" as const, concluido: true };

    const prontos = docs.filter((d) => d.status_processamento === "pronto");
    if (prontos.length === 0) {
      return {
        status: "erro_leitura" as const,
        concluido: true,
        mensagem: "A leitura técnica ainda não terminou. Continue em Documentos > Reler documento.",
      };
    }

    let ultimoErroControlado: string | null = null;
    let ultimoDocId = prontos[0].id;

    for (const doc of prontos) {
      ultimoDocId = doc.id;
      try {
        const { processarExtracaoRodada } = await import("./unidades-extracao.server");
        const rodada = await processarExtracaoRodada(supabaseAdmin, doc.id, apiKey, {
          reiniciar: data.reiniciar,
          paginaInicio: data.paginaInicio,
          paginaFim: data.paginaFim,
          somenteLotesPendentes: data.somenteLotesPendentes,
        });

        if (!rodada.concluido) {
          return {
            status: "processando" as const,
            concluido: false,
            documentoId: doc.id,
            etapa: rodada.etapa,
            total: rodada.total,
            concluidos: rodada.concluidos,
            unidades: rodada.unidades ?? [],
            modo: "indice_completo",
            chunks: rodada.total,
            mensagem: rodada.mensagem,
          };
        }

        if ((rodada.unidades?.length ?? 0) > 0) {
          return {
            status: rodada.estado === "pronto_com_pendencias" ? ("pronto_com_pendencias" as const) : ("gerada" as const),
            concluido: true,
            documentoId: doc.id,
            unidades: rodada.unidades!,
            modo: "indice_completo",
            chunks: rodada.total,
            etapa: rodada.etapa,
            total: rodada.total,
            concluidos: rodada.concluidos,
            mensagem: rodada.mensagem,
            lotes_pendentes: rodada.lotes_pendentes,
          };
        }
      } catch (err: unknown) {
        const erroControlado =
          typeof err === "object" &&
          err !== null &&
          "codigo" in err &&
          (err as { codigo?: unknown }).codigo === "extracao_incompleta";
        if (erroControlado) {
          ultimoErroControlado = err instanceof Error ? err.message : "A extração ficou incompleta.";
          continue;
        }
        throw err;
      }
    }

    if (ultimoErroControlado) {
      return {
        status: "incompleta" as const,
        concluido: true,
        documentoId: ultimoDocId,
        mensagem: ultimoErroControlado,
        modo: "indice_completo",
        chunks: 0,
      };
    }

    return {
      status: "sem_unidades" as const,
      concluido: true,
      documentoId: ultimoDocId,
      modo: "indice_completo",
      chunks: 0,
    };
  });
