import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoAssembleias } from "./guard.server";
import { getSupabaseAdmin } from "./habilitacao.functions";
import { logAdminAction } from "../audit.server";

export const BUCKET_GRAVACOES = "assembleia-gravacoes";

/** Garante que existe uma sessão aberta para a assembleia e devolve o id. */
async function garantirSessao(supabaseAdmin: any, assembleiaId: string): Promise<string> {
  const { data: sessoes } = await supabaseAdmin
    .from("assembleia_sessoes")
    .select("id, situacao, ordem")
    .eq("assembleia_id", assembleiaId)
    .order("ordem", { ascending: false })
    .limit(1);

  const atual = sessoes?.[0];
  if (atual && atual.situacao !== "encerrada") return atual.id as string;

  const { data: nova, error } = await supabaseAdmin
    .from("assembleia_sessoes")
    .insert({
      assembleia_id: assembleiaId,
      ordem: (atual?.ordem ?? 0) + 1,
      data_hora_inicio: new Date().toISOString(),
      situacao: "em_andamento",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return nova.id as string;
}

export const iniciarGravacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assembleiaId: z.string().uuid(),
        comunicouPresentes: z.literal(true, {
          error: "É obrigatório declarar que os presentes foram comunicados da gravação.",
        }),
        modoGravador: z.enum(["duplo", "unico"]),
        formato: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const sessaoId = await garantirSessao(supabaseAdmin, input.assembleiaId);

    await logAdminAction({
      actorUserId: (context as any).userId,
      action: "assembleia.gravacao.iniciar",
      metadata: {
        assembleia_id: input.assembleiaId,
        sessao_id: sessaoId,
        comunicou_presentes: true,
        declarado_em: new Date().toISOString(),
        modo_gravador: input.modoGravador,
        formato: input.formato,
      },
    });

    return { sessaoId };
  });

export const urlUploadGravacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assembleiaId: z.string().uuid(),
        tipo: z.enum(["bloco", "mestre"]),
        nomeArquivo: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const path = `assembleias/${input.assembleiaId}/${input.tipo}/${Date.now()}-${input.nomeArquivo}`;
    const { data, error } = await (context as any).supabase.storage
      .from(BUCKET_GRAVACOES)
      .createSignedUploadUrl(path);
    if (error) throw new Error(`Falha ao gerar URL de upload: ${error.message}`);
    return { url: data.signedUrl, path: data.path as string };
  });

export const registrarBloco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assembleiaId: z.string().uuid(),
        sessaoId: z.string().uuid(),
        arquivoPath: z.string().min(1),
        blocoOrdem: z.number().int().min(1),
        offsetInicioSeg: z.number().min(0),
        duracaoSeg: z.number().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: row, error } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .insert({
        assembleia_id: input.assembleiaId,
        sessao_id: input.sessaoId,
        arquivo_path: input.arquivoPath,
        bloco_ordem: input.blocoOrdem,
        offset_inicio_seg: Math.round(input.offsetInicioSeg),
        duracao_seg: Math.round(input.duracaoSeg),
        status: "enviado",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: (context as any).userId,
      action: "assembleia.gravacao.enviar",
      metadata: {
        assembleia_id: input.assembleiaId,
        bloco_ordem: input.blocoOrdem,
        duracao_seg: input.duracaoSeg,
      },
    });

    return { gravacaoId: row.id as string };
  });

/** Registra o arquivo contínuo (mestre) com bloco_ordem 0. */
export const registrarMestre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assembleiaId: z.string().uuid(),
        sessaoId: z.string().uuid(),
        arquivoPath: z.string().min(1),
        duracaoSeg: z.number().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: row, error } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .insert({
        assembleia_id: input.assembleiaId,
        sessao_id: input.sessaoId,
        arquivo_path: input.arquivoPath,
        bloco_ordem: 0,
        offset_inicio_seg: 0,
        duracao_seg: Math.round(input.duracaoSeg),
        status: "mestre",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: (context as any).userId,
      action: "assembleia.gravacao.enviar",
      metadata: { assembleia_id: input.assembleiaId, mestre: true, duracao_seg: input.duracaoSeg },
    });

    return { gravacaoId: row.id as string };
  });

export const listarGravacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: gravacoes, error } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .select("*, transcricao:assembleia_transcricoes(id, status, erro, modelo)")
      .eq("assembleia_id", input.assembleiaId)
      .order("bloco_ordem", { ascending: true });

    if (error) throw new Error(error.message);

    const blocos = (gravacoes ?? []).filter((g: any) => g.bloco_ordem > 0);
    const mestre = (gravacoes ?? []).find((g: any) => g.bloco_ordem === 0) ?? null;

    return {
      mestre,
      blocos,
      totalBlocos: blocos.length,
      blocosTranscritos: blocos.filter((b: any) => (b.transcricao ?? []).some((t: any) => t.status === "transcrito"))
        .length,
      possuiArquivoContinuo: !!mestre,
    };
  });

/** URL assinada de curta duração para tocar um trecho. */
export const urlGravacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gravacaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: gravacao } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .select("arquivo_path, status")
      .eq("id", input.gravacaoId)
      .single();

    if (!gravacao || gravacao.status === "excluida") throw new Error("Gravação indisponível.");

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_GRAVACOES)
      .createSignedUrl(gravacao.arquivo_path, 300);

    if (error) throw new Error(error.message);
    return { url: data.signedUrl as string };
  });

/**
 * Depois que o mestre subiu e TODOS os blocos foram transcritos, apaga os
 * arquivos dos blocos do bucket e reaponta as linhas para o arquivo contínuo,
 * preservando os offsets para navegação por trecho.
 */
export const consolidarGravacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: gravacoes } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .select("id, bloco_ordem, arquivo_path, status, transcricao:assembleia_transcricoes(status)")
      .eq("assembleia_id", input.assembleiaId);

    const mestre = (gravacoes ?? []).find((g: any) => g.bloco_ordem === 0);
    const blocos = (gravacoes ?? []).filter((g: any) => g.bloco_ordem > 0 && g.status !== "consolidado");

    if (!mestre) return { consolidado: false, motivo: "arquivo_continuo_ausente" as const };

    const pendentes = blocos.filter(
      (b: any) => !(b.transcricao ?? []).some((t: any) => t.status === "transcrito"),
    );
    if (pendentes.length > 0) return { consolidado: false, motivo: "transcricao_pendente" as const };

    const paths = blocos.map((b: any) => b.arquivo_path).filter(Boolean);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_GRAVACOES).remove(paths);
    }

    for (const b of blocos) {
      await supabaseAdmin
        .from("assembleia_gravacoes")
        .update({ arquivo_path: mestre.arquivo_path, status: "consolidado" })
        .eq("id", b.id);
    }

    return { consolidado: true, blocosDescartados: blocos.length };
  });

export const excluirGravacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: assembleia } = await supabaseAdmin
      .from("assembleias")
      .select("situacao")
      .eq("id", input.assembleiaId)
      .single();

    if (assembleia?.situacao !== "ata_publicada") {
      throw new Error("A gravação só pode ser excluída após a publicação da ata.");
    }

    const { data: gravacoes } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .select("id, arquivo_path")
      .eq("assembleia_id", input.assembleiaId)
      .neq("status", "excluida");

    const paths = Array.from(new Set((gravacoes ?? []).map((g: any) => g.arquivo_path).filter(Boolean)));
    if (paths.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_GRAVACOES).remove(paths as string[]);
    }

    await supabaseAdmin
      .from("assembleia_gravacoes")
      .update({ status: "excluida" })
      .eq("assembleia_id", input.assembleiaId);

    await logAdminAction({
      actorUserId: (context as any).userId,
      action: "assembleia.gravacao.excluir",
      metadata: { assembleia_id: input.assembleiaId, arquivos: paths.length },
    });

    return { excluidos: paths.length };
  });
