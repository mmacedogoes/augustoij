import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "@/lib/audit.server";
import {
  obterResumo,
  obterRegistroVotos,
  obterTentativas,
  obterPresencas,
  obterAtosMesa,
  obterDispositivos,
  verificarIntegridade,
  csvVotos,
  csvPresencas,
  csvTentativas,
  dadosRelatorio,
} from "./auditoria.server";

export const getResumoAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    return await obterResumo(data.assembleiaId);
  });

export const getRegistroVotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ assembleiaId: z.string().uuid(), itemId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    return await obterRegistroVotos(data.assembleiaId, data.itemId);
  });

export const getTentativasAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    return await obterTentativas(data.assembleiaId);
  });

export const getPresencasAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ assembleiaId: z.string().uuid(), sessaoId: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    return await obterPresencas(data.assembleiaId, data.sessaoId ?? null);
  });

export const getAtosMesa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    return await obterAtosMesa(data.assembleiaId);
  });

export const getDispositivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    return await obterDispositivos(data.assembleiaId);
  });

export const verificarIntegridadeCadeia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    const resultado = await verificarIntegridade(data.assembleiaId);
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.auditoria.verificar",
      metadata: {
        assembleia_id: data.assembleiaId,
        integra: resultado.integra,
        total_votos: resultado.totalVotos,
        sequencia_quebrada: resultado.sequenciaQuebrada,
      },
    });
    return resultado;
  });

export const exportarVotosCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ assembleiaId: z.string().uuid(), itemId: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    const conteudo = await csvVotos(data.assembleiaId, data.itemId ?? null);
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.auditoria.exportar_votos",
      metadata: { assembleia_id: data.assembleiaId, item_id: data.itemId ?? null },
    });
    return { conteudo, nomeArquivo: `registro-de-votos-${data.assembleiaId.slice(0, 8)}.csv` };
  });

export const exportarPresencaCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    const conteudo = await csvPresencas(data.assembleiaId);
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.auditoria.exportar_presenca",
      metadata: { assembleia_id: data.assembleiaId },
    });
    return { conteudo, nomeArquivo: `lista-de-presenca-${data.assembleiaId.slice(0, 8)}.csv` };
  });

export const exportarTentativasCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    const conteudo = await csvTentativas(data.assembleiaId);
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.auditoria.exportar_tentativas",
      metadata: { assembleia_id: data.assembleiaId },
    });
    return { conteudo, nomeArquivo: `tentativas-recusadas-${data.assembleiaId.slice(0, 8)}.csv` };
  });

export const gerarDadosRelatorioAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context);
    const dados = await dadosRelatorio(data.assembleiaId);
    const { data: perfil } = await context.supabase
      .from("profiles")
      .select("nome")
      .eq("id", context.userId)
      .maybeSingle();
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.auditoria.exportar_relatorio",
      metadata: { assembleia_id: data.assembleiaId, integra: dados.integridade.integra },
    });
    return { ...dados, geradoPor: perfil?.nome ?? "Super administrador", geradoEm: new Date().toISOString() };
  });
