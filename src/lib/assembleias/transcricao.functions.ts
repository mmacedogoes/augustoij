import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoAssembleias } from "./guard.server";
import { getSupabaseAdmin } from "./habilitacao.functions";
import { logAdminAction } from "../audit.server";
import { registrarEventoIa, extractAigIds } from "../uso-ia.server";
import { BUCKET_GRAVACOES } from "./gravacao.functions";

const MODELO_TRANSCRICAO = "google/gemini-2.5-flash";

const SYSTEM_TRANSCRICAO = `Você transcreve o áudio de uma assembleia de condomínio em português do Brasil.
Devolva segmentos com início e fim em segundos relativos ao começo do áudio enviado, o rótulo do falante no
formato "Falante 1", "Falante 2" e assim por diante, mantendo o mesmo rótulo para a mesma voz ao longo de todo
o áudio, e o texto do trecho.
Trechos inaudíveis são marcados como "[inaudível]" — nunca adivinhe o que foi dito.
Responda APENAS em JSON, sem texto em volta e sem cercas, no formato:
{"segmentos":[{"inicio":0,"fim":4.2,"falante":"Falante 1","texto":"..."}]}`;

function formatoDoPath(path: string): { mime: string; formato: string } {
  const ext = (path.split(".").pop() || "webm").toLowerCase();
  const map: Record<string, string> = {
    webm: "audio/webm",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };
  return { mime: map[ext] ?? "audio/webm", formato: ext === "m4a" ? "m4a" : ext };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const transcreverBloco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gravacaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const userId = (context as any).userId as string;

    const { data: gravacao } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .select("*, assembleia:assembleias(id, condominio_id)")
      .eq("id", input.gravacaoId)
      .single();

    if (!gravacao) throw new Error("Bloco de gravação não encontrado.");

    await supabaseAdmin
      .from("assembleia_transcricoes")
      .upsert(
        { gravacao_id: gravacao.id, status: "transcrevendo", erro: null, modelo: MODELO_TRANSCRICAO },
        { onConflict: "gravacao_id" },
      );
    await supabaseAdmin.from("assembleia_gravacoes").update({ status: "transcrevendo" }).eq("id", gravacao.id);

    const marcarFalha = async (mensagem: string) => {
      await supabaseAdmin
        .from("assembleia_transcricoes")
        .upsert({ gravacao_id: gravacao.id, status: "falhou", erro: mensagem }, { onConflict: "gravacao_id" });
      await supabaseAdmin
        .from("assembleia_gravacoes")
        .update({ status: "falhou", erro: mensagem })
        .eq("id", gravacao.id);
    };

    try {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("IA indisponível: chave não configurada.");

      const { data: file, error: errFile } = await supabaseAdmin.storage
        .from(BUCKET_GRAVACOES)
        .download(gravacao.arquivo_path);
      if (errFile || !file) throw new Error("Arquivo de áudio indisponível no armazenamento.");

      const { mime, formato } = formatoDoPath(gravacao.arquivo_path);
      const base64 = toBase64(await file.arrayBuffer());

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: MODELO_TRANSCRICAO,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_TRANSCRICAO },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcreva integralmente o áudio abaixo." },
                { type: "input_audio", input_audio: { data: base64, format: formato } },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const corpo = await res.text().catch(() => "");
        if (res.status === 400) {
          throw new Error(
            `O modelo não aceitou a entrada de áudio (${res.status}). Use o envio de transcrição pronta. ${corpo.slice(0, 200)}`,
          );
        }
        throw new Error(`Falha na transcrição (${res.status}). ${corpo.slice(0, 200)}`);
      }

      const { logId, runId } = extractAigIds(res);
      const json: any = await res.json();
      const conteudo = json?.choices?.[0]?.message?.content;
      if (!conteudo) throw new Error("A IA devolveu resposta vazia.");

      const parsed = JSON.parse(String(conteudo).replace(/^```(json)?|```$/g, "").trim());
      const offset = Number(gravacao.offset_inicio_seg) || 0;
      const segmentos = (parsed.segmentos ?? []).map((s: any) => ({
        inicio: Number(s.inicio ?? 0) + offset,
        fim: Number(s.fim ?? s.inicio ?? 0) + offset,
        falante: String(s.falante ?? "Falante 1"),
        texto: String(s.texto ?? ""),
      }));

      const texto = segmentos.map((s: any) => `${s.falante}: ${s.texto}`).join("\n");

      await supabaseAdmin.from("assembleia_transcricoes").upsert(
        {
          gravacao_id: gravacao.id,
          status: "transcrito",
          erro: null,
          modelo: MODELO_TRANSCRICAO,
          segmentos: segmentos as never,
          texto,
        },
        { onConflict: "gravacao_id" },
      );
      await supabaseAdmin.from("assembleia_gravacoes").update({ status: "transcrito", erro: null }).eq("id", gravacao.id);

      await registrarEventoIa({
        userId,
        condominioId: (gravacao.assembleia as any)?.condominio_id ?? null,
        origem: "assembleia_transcricao",
        model: MODELO_TRANSCRICAO,
        tokensInput: json?.usage?.prompt_tokens ?? 0,
        tokensOutput: json?.usage?.completion_tokens ?? 0,
        aigLogId: logId,
        aigRunId: runId,
        meta: {
          assembleia_id: gravacao.assembleia_id,
          gravacao_id: gravacao.id,
          duracao_seg: gravacao.duracao_seg ?? 0,
          mime,
        },
      });

      await logAdminAction({
        actorUserId: userId,
        action: "assembleia.transcricao.processar",
        metadata: { assembleia_id: gravacao.assembleia_id, gravacao_id: gravacao.id },
      });

      return { segmentos: segmentos.length };
    } catch (err: any) {
      await marcarFalha(err?.message ?? "Erro desconhecido.");
      throw new Error(err?.message ?? "Falha ao transcrever bloco.");
    }
  });

export const enviarTranscricaoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ assembleiaId: z.string().uuid(), texto: z.string().min(20) }).parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: sessao } = await supabaseAdmin
      .from("assembleia_sessoes")
      .select("id")
      .eq("assembleia_id", input.assembleiaId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sessao) throw new Error("Nenhuma sessão registrada para esta assembleia.");

    const { data: gravacao, error } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .insert({
        assembleia_id: input.assembleiaId,
        sessao_id: sessao.id,
        arquivo_path: "",
        bloco_ordem: 9999,
        offset_inicio_seg: 0,
        duracao_seg: 0,
        status: "transcricao_manual",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const segmentos = input.texto
      .split(/\n+/)
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((linha, i) => {
        const match = linha.match(/^(Falante\s*\d+|[^:]{2,40}):\s*(.*)$/);
        return {
          inicio: i,
          fim: i + 1,
          falante: match ? match[1] : "Falante 1",
          texto: match ? match[2] : linha,
        };
      });

    await supabaseAdmin.from("assembleia_transcricoes").insert({
      gravacao_id: gravacao.id,
      status: "transcrito",
      modelo: "manual",
      segmentos: segmentos as never,
      texto: input.texto,
    });

    return { segmentos: segmentos.length };
  });

export const getTranscricao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: gravacoes } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .select("id, bloco_ordem, offset_inicio_seg, duracao_seg, status, transcricao:assembleia_transcricoes(*)")
      .eq("assembleia_id", input.assembleiaId)
      .order("bloco_ordem", { ascending: true });

    const segmentos: any[] = [];
    for (const g of gravacoes ?? []) {
      for (const t of (g as any).transcricao ?? []) {
        for (const s of (t.segmentos as any[]) ?? []) {
          segmentos.push({ ...s, gravacao_id: g.id });
        }
      }
    }
    segmentos.sort((a, b) => a.inicio - b.inicio);

    const { data: falantes } = await supabaseAdmin
      .from("assembleia_falantes")
      .select("*")
      .eq("assembleia_id", input.assembleiaId);

    return { segmentos, falantes: falantes ?? [] };
  });

export const salvarFalante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assembleiaId: z.string().uuid(),
        rotuloIa: z.string().min(1),
        nome: z.string().min(2),
        unidadeId: z.string().uuid().nullable().optional(),
        papel: z.string().default("participante"),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: existente } = await supabaseAdmin
      .from("assembleia_falantes")
      .select("id")
      .eq("assembleia_id", input.assembleiaId)
      .eq("rotulo_ia", input.rotuloIa)
      .maybeSingle();

    const payload = {
      assembleia_id: input.assembleiaId,
      rotulo_ia: input.rotuloIa,
      nome: input.nome,
      unidade_id: input.unidadeId ?? null,
      papel: input.papel ?? "participante",
    };

    if (existente) {
      const { error } = await supabaseAdmin.from("assembleia_falantes").update(payload).eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("assembleia_falantes").insert(payload);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });

/** Cruza a fila de fala (fase 7) com os segmentos e sugere nomes por sobreposição. */
export const sugerirFalantes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: gravacoes } = await supabaseAdmin
      .from("assembleia_gravacoes")
      .select("id, bloco_ordem, offset_inicio_seg, created_at, transcricao:assembleia_transcricoes(segmentos)")
      .eq("assembleia_id", input.assembleiaId)
      .order("bloco_ordem", { ascending: true });

    const primeiro = (gravacoes ?? []).find((g: any) => g.bloco_ordem > 0);
    const inicioSessaoMs = primeiro?.created_at ? new Date(primeiro.created_at).getTime() : null;

    const segmentos: any[] = [];
    for (const g of gravacoes ?? []) {
      for (const t of (g as any).transcricao ?? []) {
        for (const s of (t.segmentos as any[]) ?? []) segmentos.push(s);
      }
    }

    const { data: falas } = await supabaseAdmin
      .from("assembleia_fila_fala")
      .select("id, iniciou_em, encerrou_em, representante_nome, unidade_id, unidade:unidades(bloco, numero)")
      .eq("assembleia_id", input.assembleiaId)
      .not("iniciou_em", "is", null);

    const sugestoes: Record<string, { nome: string; unidadeId: string | null; sobreposicao: number }> = {};

    if (inicioSessaoMs) {
      for (const fala of falas ?? []) {
        const ini = (new Date(fala.iniciou_em as string).getTime() - inicioSessaoMs) / 1000;
        const fim = fala.encerrou_em
          ? (new Date(fala.encerrou_em as string).getTime() - inicioSessaoMs) / 1000
          : ini + 120;

        const porRotulo: Record<string, number> = {};
        for (const s of segmentos) {
          const overlap = Math.max(0, Math.min(fim, s.fim) - Math.max(ini, s.inicio));
          if (overlap > 0) porRotulo[s.falante] = (porRotulo[s.falante] ?? 0) + overlap;
        }
        const melhor = Object.entries(porRotulo).sort((a, b) => b[1] - a[1])[0];
        if (!melhor) continue;

        const duracaoFala = Math.max(1, fim - ini);
        const grau = Math.min(100, Math.round((melhor[1] / duracaoFala) * 100));
        const uni = (fala as any).unidade;
        const nome =
          fala.representante_nome ||
          (uni ? `Unidade ${[uni.bloco, uni.numero].filter(Boolean).join(" ")}` : "Participante");

        const atual = sugestoes[melhor[0]];
        if (!atual || atual.sobreposicao < grau) {
          sugestoes[melhor[0]] = { nome, unidadeId: fala.unidade_id ?? null, sobreposicao: grau };
        }
      }
    }

    const { data: assembleia } = await supabaseAdmin
      .from("assembleias")
      .select("presidente_nome, secretario_nome")
      .eq("id", input.assembleiaId)
      .single();

    const rotulos = Array.from(new Set(segmentos.map((s) => s.falante))).sort();

    return {
      rotulos,
      sugestoes,
      nomesInstalacao: [assembleia?.presidente_nome, assembleia?.secretario_nome].filter(Boolean) as string[],
    };
  });
