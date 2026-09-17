import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";

export type DocumentoOpcaoFixture = {
  documentoId: string;
  condominioId: string;
  condominioNome: string;
  nomeArquivo: string;
  tipoDocumento: string | null;
  statusProcessamento: string | null;
  criadoEm: string;
};

export type ExtracaoEsperadoFormatada = {
  total: number;
  unidades: Array<{
    escopo: string | null;
    numero: string;
    area_privativa: number | null;
    fracao_ideal: number | null;
  }>;
};

/**
 * Lista todos os documentos de condomínios já processados ou cadastrados.
 */
export const listarDocumentosParaFixtures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentoOpcaoFixture[]> => {
    await ensureAdmin(context);

    const { data, error } = await context.supabase
      .from("documentos")
      .select(
        id,
        condominio_id,
        nome_arquivo,
        tipo_documento,
        status_processamento,
        created_at,
        condominios (
          id,
          nome
        )
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((d: any) => ({
      documentoId: d.id,
      condominioId: d.condominio_id,
      condominioNome: d.condominios?.nome ?? "Sem Condomínio",
      nomeArquivo: d.nome_arquivo,
      tipoDocumento: d.tipo_documento,
      statusProcessamento: d.status_processamento,
      criadoEm: d.created_at,
    }));
  });

/**
 * Obtém o texto consolidado do documento (tentando primeiro do Storage .md, e depois chunks do DB).
 */
export const obterTextoDocumento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      condominioId: z.string().uuid(),
      documentoId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { condominioId, documentoId } = data;

    // 1) Tentar carregar a transcrição consolidada do bucket "documentos"
    const storagePath = ${condominioId}/transcricoes/.md;
    const { data: fileData, error: storageErr } = await context.supabase.storage
      .from("documentos")
      .download(storagePath);

    if (!storageErr && fileData) {
      const texto = await fileData.text();
      if (texto && texto.trim().length > 0) {
        return { texto, origem: "storage" as const, storagePath };
      }
    }

    // 2) Fallback: buscar chunks ordenados de document_chunks
    const { data: chunks, error: chunksErr } = await context.supabase
      .from("document_chunks")
      .select("conteudo, metadata")
      .eq("documento_id", documentoId);

    if (chunksErr) {
      throw new Error(Falha ao ler chunks do documento: );
    }

    if (!chunks || chunks.length === 0) {
      throw new Error("Nenhum texto encontrado no Storage ou nos chunks deste documento.");
    }

    // Ordenar chunks por ordem_global
    chunks.sort((a, b) => {
      const oA = (a.metadata as any)?.ordem_global ?? 0;
      const oB = (b.metadata as any)?.ordem_global ?? 0;
      return oA - oB;
    });

    const texto = chunks.map((c) => c.conteudo).join("\n");
    return { texto, origem: "chunks" as const, storagePath: null };
  });

/**
 * Obtém a extração atual salva em sugestoes_unidades e formata no schema esperado.
 */
export const obterExtracaoAtualFormatada = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentoId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ExtracaoEsperadoFormatada> => {
    await ensureAdmin(context);
    const { documentoId } = data;

    const { data: sugestao, error } = await context.supabase
      .from("sugestoes_unidades")
      .select("payload")
      .eq("documento_id", documentoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!sugestao || !sugestao.payload) {
      return { total: 0, unidades: [] };
    }

    const payload = sugestao.payload as any;
    const unidadesBrutas = Array.isArray(payload.unidades) ? payload.unidades : [];

    const formatadas = unidadesBrutas.map((u: any) => ({
      escopo: u.bloco ?? null,
      numero: String(u.numero),
      area_privativa: typeof u.area_m2 === "number" ? u.area_m2 : null,
      fracao_ideal: typeof u.fracao_ideal === "number" ? u.fracao_ideal : null,
    }));

    // Ordenar canonicamente por bloco e número
    formatadas.sort((a: any, b: any) => {
      const cmpBloco = (a.escopo || "").localeCompare(b.escopo || "");
      if (cmpBloco !== 0) return cmpBloco;
      return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
    });

    return {
      total: formatadas.length,
      unidades: formatadas,
    };
  });
