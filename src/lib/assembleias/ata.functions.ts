import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoAssembleias } from "./guard.server";
import { getSupabaseAdmin } from "./habilitacao.functions";
import { logAdminAction } from "../audit.server";
import { registrarEventoIa, extractAigIds } from "../uso-ia.server";
import { descreverResultado } from "./resultado-texto";

const MODELO_ATA = "google/gemini-2.5-flash";

export const TIPOS_LACUNA = [
  "dado_cadastral",
  "nome_nao_identificado",
  "valor_sem_clareza",
  "deliberacao_sem_votacao",
  "fala_inaudivel",
  "documento_nao_anexado",
  "item_sem_conclusao",
  "resultado_pendente",
] as const;

const SYSTEM_ATA = `Você redige atas de assembleia de condomínio no Brasil.
REGRAS DURAS:
- Escreva em linguagem de ata, jamais em transcrição literal.
- Condense o debate em síntese, preservando as posições relevantes e quem as sustentou.
- Descarte conversa paralela, saudação, piada e assunto alheio à pauta.
- JAMAIS afirme resultado de votação diferente do que foi entregue nos dados. Reproduza a frase de
  resultado EXATAMENTE como recebida.
- JAMAIS invente nome, valor, data ou número.
- Marque como lacuna tudo o que não puder ser afirmado com segurança a partir do que foi recebido, usando
  no texto o marcador [[LACUNA:1]], [[LACUNA:2]] ... numerado dentro do bloco.
Responda APENAS em JSON, sem cercas, no formato:
{"texto":"...","origem_audio_inicio":0,"origem_audio_fim":0,"confianca":0.9,
 "lacunas":[{"numero":1,"tipo":"nome_nao_identificado","descricao":"...","sugestao":"...","rotulo":"nome do condômino"}]}`;

function dataPorExtenso(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "long" });
}
function horario(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function carregarContexto(supabaseAdmin: any, assembleiaId: string) {
  const { data: assembleia } = await supabaseAdmin
    .from("assembleias")
    .select("*, condominio:condominios(*), itens:assembleia_itens(*)")
    .eq("id", assembleiaId)
    .single();
  if (!assembleia) throw new Error("Assembleia não encontrada.");

  const { data: gravacoes } = await supabaseAdmin
    .from("assembleia_gravacoes")
    .select("id, offset_inicio_seg, transcricao:assembleia_transcricoes(segmentos)")
    .eq("assembleia_id", assembleiaId);

  const segmentos: any[] = [];
  for (const g of gravacoes ?? []) {
    for (const t of (g as any).transcricao ?? []) {
      for (const s of (t.segmentos as any[]) ?? []) segmentos.push(s);
    }
  }
  segmentos.sort((a, b) => a.inicio - b.inicio);

  const { data: falantes } = await supabaseAdmin
    .from("assembleia_falantes")
    .select("rotulo_ia, nome")
    .eq("assembleia_id", assembleiaId);

  const mapaNomes = new Map<string, string>();
  for (const f of falantes ?? []) if (f.nome) mapaNomes.set(f.rotulo_ia, f.nome);

  const { data: sessao } = await supabaseAdmin
    .from("assembleia_sessoes")
    .select("*")
    .eq("assembleia_id", assembleiaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: totalAptos } = await supabaseAdmin
    .from("assembleia_habilitacoes")
    .select("*", { count: "exact", head: true })
    .eq("assembleia_id", assembleiaId)
    .eq("apta", true);

  const { count: totalPresentes } = await supabaseAdmin
    .from("assembleia_presencas")
    .select("*", { count: "exact", head: true })
    .eq("assembleia_id", assembleiaId);

  return { assembleia, segmentos, mapaNomes, sessao, totalAptos: totalAptos ?? 0, totalPresentes: totalPresentes ?? 0 };
}

/** Segmentação determinística por item: 2 min antes do aberto_em até o encerrado_em. */
function recortar(segmentos: any[], inicioSeg: number | null, fimSeg: number | null) {
  return segmentos.filter(
    (s) => (inicioSeg === null || s.fim >= inicioSeg) && (fimSeg === null || s.inicio <= fimSeg),
  );
}

function textoSegmentos(segmentos: any[], mapaNomes: Map<string, string>): string {
  return segmentos.map((s) => `${mapaNomes.get(s.falante) ?? s.falante}: ${s.texto}`).join("\n");
}

export const gerarAtaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const userId = (context as any).userId as string;
    const apiKey = process.env["LOVABLE_API_KEY"];

    const ctx = await carregarContexto(supabaseAdmin, input.assembleiaId);
    const { assembleia, segmentos, mapaNomes, sessao } = ctx;

    const { data: ultima } = await supabaseAdmin
      .from("ata_versoes")
      .select("numero, texto_completo, situacao")
      .eq("assembleia_id", input.assembleiaId)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultima?.situacao === "rascunho") {
      throw new Error("Já existe um rascunho em aberto. Edite-o ou crie uma nova versão.");
    }

    const { data: versao, error: errVersao } = await supabaseAdmin
      .from("ata_versoes")
      .insert({
        assembleia_id: input.assembleiaId,
        numero: (ultima?.numero ?? 0) + 1,
        situacao: "rascunho",
        gerada_por: "ia",
        modelo: MODELO_ATA,
        criada_por: userId,
      })
      .select("*")
      .single();
    if (errVersao) throw new Error(errVersao.message);

    // Referência de estilo: ata anterior publicada.
    const { data: anterior } = await supabaseAdmin
      .from("ata_versoes")
      .select("texto_completo")
      .eq("assembleia_id", input.assembleiaId)
      .eq("situacao", "publicada")
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();

    const itens = [...(assembleia.itens ?? [])].sort((a: any, b: any) => a.ordem - b.ordem);
    const inicioSessaoMs = sessao?.data_hora_inicio ? new Date(sessao.data_hora_inicio).getTime() : null;
    const relSeg = (iso: string | null) =>
      iso && inicioSessaoMs ? (new Date(iso).getTime() - inicioSessaoMs) / 1000 : null;

    const percQuorum = ctx.totalAptos > 0 ? ((ctx.totalPresentes / ctx.totalAptos) * 100).toFixed(1) : "0,0";

    const blocos: Array<{
      tipo: string;
      item_id: string | null;
      texto: string;
      origem_audio_inicio: number | null;
      origem_audio_fim: number | null;
      confianca: number | null;
      lacunas: any[];
    }> = [];

    // --- Abertura determinística ---
    const cond = assembleia.condominio;
    const aberturaTexto =
      `Aos ${dataPorExtenso(assembleia.data_hora)}, às ${horario(assembleia.data_hora)}, em ${assembleia.modalidade}, ` +
      `no local ${assembleia.local || "[[LACUNA:1]]"}, reuniram-se os condôminos do ${cond?.nome ?? "condomínio"}, ` +
      `situado em ${cond?.endereco || "[[LACUNA:2]]"}, em ${assembleia.convocacao_numero}ª convocação, para a ` +
      `${assembleia.tipo === "extraordinaria" ? "Assembleia Geral Extraordinária" : "Assembleia Geral Ordinária"}. ` +
      `Verificou-se a presença de ${ctx.totalPresentes} unidades, correspondente a ${percQuorum}% das unidades aptas, ` +
      `quórum suficiente para instalação. Assumiu a presidência ${assembleia.presidente_nome || "[[LACUNA:3]]"}, ` +
      `que convidou para secretariar os trabalhos ${assembleia.secretario_nome || "[[LACUNA:4]]"}.`;

    const lacunasAbertura: any[] = [];
    if (!assembleia.local)
      lacunasAbertura.push({ numero: 1, tipo: "dado_cadastral", descricao: "Local da assembleia não informado.", sugestao: null, rotulo: "local da assembleia" });
    if (!cond?.endereco)
      lacunasAbertura.push({ numero: 2, tipo: "dado_cadastral", descricao: "Endereço do condomínio ausente no cadastro.", sugestao: null, rotulo: "endereço do condomínio" });
    if (!assembleia.presidente_nome)
      lacunasAbertura.push({ numero: 3, tipo: "nome_nao_identificado", descricao: "Presidente da mesa não registrado na instalação.", sugestao: null, rotulo: "presidente da mesa" });
    if (!assembleia.secretario_nome)
      lacunasAbertura.push({ numero: 4, tipo: "nome_nao_identificado", descricao: "Secretário não registrado na instalação.", sugestao: null, rotulo: "secretário" });

    blocos.push({
      tipo: "abertura",
      item_id: null,
      texto: aberturaTexto,
      origem_audio_inicio: 0,
      origem_audio_fim: relSeg(itens[0]?.aberto_em ?? null),
      confianca: 1,
      lacunas: lacunasAbertura,
    });

    // --- Itens ---
    let tokensIn = 0;
    let tokensOut = 0;
    let ultimoLogId: string | null = null;
    let ultimoRunId: string | null = null;

    for (const item of itens) {
      const abertoSeg = relSeg(item.aberto_em);
      const encerradoSeg = relSeg(item.encerrado_em);
      const inicioTrecho = abertoSeg !== null ? Math.max(0, abertoSeg - 120) : null;
      const trecho = recortar(segmentos, inicioTrecho, encerradoSeg);

      const { data: resultado } = await supabaseAdmin
        .from("assembleia_resultados")
        .select("*")
        .eq("item_id", item.id)
        .order("apurado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      const fraseResultado = resultado ? descreverResultado(item, resultado) : null;

      let texto = "";
      let lacunas: any[] = [];
      let confianca: number | null = 0.7;

      if (apiKey && trecho.length > 0) {
        try {
          const userPrompt = [
            `ITEM ${item.ordem}: ${item.titulo}`,
            item.descricao ? `DESCRIÇÃO: ${item.descricao}` : "",
            fraseResultado
              ? `RESULTADO APURADO (reproduza esta frase exatamente): ${fraseResultado}`
              : "RESULTADO: ainda não apurado — não afirme resultado algum.",
            anterior?.texto_completo
              ? `REFERÊNCIA DE ESTILO (ata anterior, apenas estilo):\n${String(anterior.texto_completo).slice(0, 3000)}`
              : "",
            `TRECHO DA TRANSCRIÇÃO:\n${textoSegmentos(trecho, mapaNomes).slice(0, 20000)}`,
          ]
            .filter(Boolean)
            .join("\n\n");

          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
            body: JSON.stringify({
              model: MODELO_ATA,
              temperature: 0.2,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_ATA },
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (res.ok) {
            const ids = extractAigIds(res);
            ultimoLogId = ids.logId;
            ultimoRunId = ids.runId;
            const json: any = await res.json();
            tokensIn += json?.usage?.prompt_tokens ?? 0;
            tokensOut += json?.usage?.completion_tokens ?? 0;
            const parsed = JSON.parse(
              String(json?.choices?.[0]?.message?.content ?? "{}").replace(/^```(json)?|```$/g, "").trim(),
            );
            texto = String(parsed.texto ?? "").trim();
            lacunas = Array.isArray(parsed.lacunas) ? parsed.lacunas : [];
            confianca = typeof parsed.confianca === "number" ? parsed.confianca : 0.7;
          }
        } catch {
          texto = "";
        }
      }

      if (!texto) {
        texto =
          `Passou-se à deliberação do item ${item.ordem} — ${item.titulo}. ` +
          (fraseResultado ? fraseResultado : "A matéria foi submetida à assembleia.");
        confianca = 0.4;
      } else if (fraseResultado && !texto.includes(fraseResultado)) {
        // O banco decide: a frase apurada é sempre acrescentada íntegra.
        texto = `${texto}\n\n${fraseResultado}`;
      }

      const proximoNumero = () => lacunas.reduce((m: number, l: any) => Math.max(m, Number(l.numero) || 0), 0) + 1;

      if (!resultado) {
        const numero = proximoNumero();
        texto = `${texto} [[LACUNA:${numero}]]`;
        lacunas.push({
          numero,
          tipo: "resultado_pendente",
          descricao: "O item ainda não foi apurado. A lacuna se resolve sozinha quando a apuração for registrada.",
          sugestao: null,
          rotulo: "resultado pendente",
        });
      }

      blocos.push({
        tipo: "item",
        item_id: item.id,
        texto,
        origem_audio_inicio: inicioTrecho,
        origem_audio_fim: encerradoSeg,
        confianca,
        lacunas,
      });
    }

    // --- Encerramento determinístico ---
    const fimSessao = sessao?.data_hora_fim ?? assembleia.encerrada_em;
    const encerramentoTexto = fimSessao
      ? `Nada mais havendo a tratar, os trabalhos foram encerrados às ${horario(fimSessao)}, lavrando-se a presente ata, que segue assinada pelo presidente e pelo secretário da mesa.`
      : `Os trabalhos foram encerrados [[LACUNA:1]], lavrando-se a presente ata, que segue assinada pelo presidente e pelo secretário da mesa.`;

    blocos.push({
      tipo: "encerramento",
      item_id: null,
      texto: encerramentoTexto,
      origem_audio_inicio: relSeg(itens[itens.length - 1]?.encerrado_em ?? null),
      origem_audio_fim: null,
      confianca: 1,
      lacunas: fimSessao
        ? []
        : [
            {
              numero: 1,
              tipo: "dado_cadastral",
              descricao: "Horário de encerramento da sessão não registrado.",
              sugestao: null,
              rotulo: "horário de encerramento",
            },
          ],
    });

    // --- Persistência: blocos + lacunas com âncora por uuid ---
    let ordem = 1;
    for (const b of blocos) {
      const { data: blocoRow, error: errBloco } = await supabaseAdmin
        .from("ata_blocos")
        .insert({
          versao_id: versao.id,
          tipo: b.tipo,
          item_id: b.item_id,
          ordem: ordem++,
          texto: b.texto,
          origem_audio_inicio: b.origem_audio_inicio,
          origem_audio_fim: b.origem_audio_fim,
          confianca: b.confianca,
        })
        .select("id")
        .single();
      if (errBloco) throw new Error(errBloco.message);

      let textoFinal = b.texto;
      for (const lac of b.lacunas) {
        const tipo = (TIPOS_LACUNA as readonly string[]).includes(lac.tipo) ? lac.tipo : "dado_cadastral";
        const { data: lacRow } = await supabaseAdmin
          .from("ata_lacunas")
          .insert({
            versao_id: versao.id,
            bloco_id: blocoRow.id,
            tipo,
            descricao: String(lac.descricao ?? "Informação a confirmar."),
            sugestao: lac.sugestao ?? null,
            ancora_texto: String(lac.rotulo ?? "informação"),
            referencia_audio_seg: b.origem_audio_inicio,
            situacao: "aberta",
          })
          .select("id")
          .single();

        if (lacRow) {
          textoFinal = textoFinal.replaceAll(`[[LACUNA:${lac.numero}]]`, `[[LACUNA:${lacRow.id}]]`);
        }
      }
      if (textoFinal !== b.texto) {
        await supabaseAdmin.from("ata_blocos").update({ texto: textoFinal }).eq("id", blocoRow.id);
      }
    }

    if (tokensIn > 0 || tokensOut > 0) {
      await registrarEventoIa({
        userId,
        condominioId: assembleia.condominio_id,
        origem: "assembleia_ata",
        model: MODELO_ATA,
        tokensInput: tokensIn,
        tokensOutput: tokensOut,
        aigLogId: ultimoLogId,
        aigRunId: ultimoRunId,
        meta: { assembleia_id: input.assembleiaId, versao_id: versao.id, itens: itens.length },
      });
    }

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.ata.gerar",
      targetCondominioId: assembleia.condominio_id,
      metadata: { assembleia_id: input.assembleiaId, versao_id: versao.id, numero: versao.numero },
    });

    return { versaoId: versao.id as string, numero: versao.numero as number };
  });

export const getAta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ assembleiaId: z.string().uuid(), versaoId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: versoes } = await supabaseAdmin
      .from("ata_versoes")
      .select("*")
      .eq("assembleia_id", input.assembleiaId)
      .order("numero", { ascending: false });

    const versao = input.versaoId
      ? (versoes ?? []).find((v: any) => v.id === input.versaoId)
      : (versoes ?? [])[0];

    if (!versao) return { versao: null, versoes: versoes ?? [], blocos: [], lacunas: [], assembleia: null };

    const { data: blocosRaw } = await supabaseAdmin
      .from("ata_blocos")
      .select("*")
      .eq("versao_id", versao.id)
      .order("ordem", { ascending: true });

    const { data: itens } = await supabaseAdmin
      .from("assembleia_itens")
      .select("id, ordem, titulo, fundamento_legal")
      .eq("assembleia_id", input.assembleiaId);

    const blocos = (blocosRaw ?? []).map((b: any) => ({
      ...b,
      item: (itens ?? []).find((it: any) => it.id === b.item_id) ?? null,
    }));

    const { data: lacunas } = await supabaseAdmin
      .from("ata_lacunas")
      .select("*")
      .eq("versao_id", versao.id);

    const { data: assembleia } = await supabaseAdmin
      .from("assembleias")
      .select("id, titulo, tipo, data_hora, situacao, presidente_nome, secretario_nome, condominio_id, condominio:condominios(nome, endereco)")
      .eq("id", input.assembleiaId)
      .single();

    return { versao, versoes: versoes ?? [], blocos, lacunas: lacunas ?? [], assembleia };
  });

export const preencherLacuna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        lacunaId: z.string().uuid(),
        valor: z.string().min(1),
        salvarNoCadastro: z.boolean().optional(),
        campoCadastro: z.enum(["endereco", "nome"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const userId = (context as any).userId as string;

    const { data: lacuna } = await supabaseAdmin
      .from("ata_lacunas")
      .select("*, versao:ata_versoes(assembleia_id, situacao)")
      .eq("id", input.lacunaId)
      .single();
    if (!lacuna) throw new Error("Lacuna não encontrada.");
    if ((lacuna.versao as any)?.situacao === "publicada") throw new Error("Versão já publicada.");

    await supabaseAdmin
      .from("ata_lacunas")
      .update({
        valor_preenchido: input.valor,
        preenchida_em: new Date().toISOString(),
        preenchida_por: userId,
        situacao: "preenchida",
      })
      .eq("id", input.lacunaId);

    if (input.salvarNoCadastro && input.campoCadastro && lacuna.tipo === "dado_cadastral") {
      const { data: assembleia } = await supabaseAdmin
        .from("assembleias")
        .select("condominio_id")
        .eq("id", (lacuna.versao as any).assembleia_id)
        .single();
      if (assembleia) {
        await supabaseAdmin
          .from("condominios")
          .update({ [input.campoCadastro]: input.valor } as never)
          .eq("id", assembleia.condominio_id);
      }
    }

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.lacuna.preencher",
      metadata: { lacuna_id: input.lacunaId },
    });

    return { success: true };
  });

export const dispensarLacuna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        lacunaId: z.string().uuid(),
        justificativa: z
          .string()
          .trim()
          .min(10, "A justificativa precisa ter ao menos 10 caracteres."),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const userId = (context as any).userId as string;

    const { error } = await supabaseAdmin
      .from("ata_lacunas")
      .update({
        situacao: "dispensada",
        valor_preenchido: `[dispensada] ${input.justificativa}`,
        preenchida_em: new Date().toISOString(),
        preenchida_por: userId,
      })
      .eq("id", input.lacunaId);
    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.lacuna.dispensar",
      metadata: { lacuna_id: input.lacunaId, justificativa: input.justificativa },
    });

    return { success: true };
  });

export const editarBloco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ blocoId: z.string().uuid(), texto: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    // Bloco editado à mão perde a confiança da IA (auditoria da fase 9).
    const { error } = await supabaseAdmin
      .from("ata_blocos")
      .update({ texto: input.texto, confianca: null })
      .eq("id", input.blocoId);
    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: (context as any).userId,
      action: "assembleia.ata.editar",
      metadata: { bloco_id: input.blocoId },
    });

    return { success: true };
  });

export const adicionarBlocoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ versaoId: z.string().uuid(), texto: z.string().min(1) }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: ultimo } = await supabaseAdmin
      .from("ata_blocos")
      .select("ordem")
      .eq("versao_id", input.versaoId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("ata_blocos").insert({
      versao_id: input.versaoId,
      tipo: "livre",
      ordem: (ultimo?.ordem ?? 0) + 1,
      texto: input.texto,
      confianca: null,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const reordenarBlocos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        versaoId: z.string().uuid(),
        ordens: z.array(z.object({ id: z.string().uuid(), ordem: z.number().int() })),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    for (const o of input.ordens) {
      await supabaseAdmin.from("ata_blocos").update({ ordem: o.ordem }).eq("id", o.id).eq("versao_id", input.versaoId);
    }
    return { success: true };
  });

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Resolve marcadores de lacuna pelo valor preenchido (ou pelo rótulo, se dispensada). */
export function resolverMarcadores(texto: string, lacunas: any[]): string {
  let out = texto;
  for (const l of lacunas) {
    const substituto =
      l.situacao === "preenchida" && l.valor_preenchido
        ? l.valor_preenchido
        : l.situacao === "dispensada"
          ? ""
          : `[${l.ancora_texto}]`;
    out = out.replaceAll(`[[LACUNA:${l.id}]]`, substituto);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

export const publicarAta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ versaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const userId = (context as any).userId as string;

    const { data: versao } = await supabaseAdmin
      .from("ata_versoes")
      .select("*")
      .eq("id", input.versaoId)
      .single();
    if (!versao) throw new Error("Versão não encontrada.");
    if (versao.situacao === "publicada") throw new Error("Esta versão já foi publicada.");

    const { data: lacunas } = await supabaseAdmin
      .from("ata_lacunas")
      .select("*")
      .eq("versao_id", input.versaoId);

    const abertas = (lacunas ?? []).filter((l: any) => l.situacao === "aberta");
    if (abertas.length > 0) {
      throw new Error(`Existem ${abertas.length} lacuna(s) em aberto. A publicação está bloqueada.`);
    }

    const { data: blocos } = await supabaseAdmin
      .from("ata_blocos")
      .select("*")
      .eq("versao_id", input.versaoId)
      .order("ordem", { ascending: true });

    const textoCompleto = (blocos ?? [])
      .map((b: any) => resolverMarcadores(b.texto, lacunas ?? []))
      .join("\n\n");

    const hash = await sha256Hex(textoCompleto);

    await supabaseAdmin
      .from("ata_versoes")
      .update({
        texto_completo: textoCompleto,
        hash_publicacao: hash,
        publicada_em: new Date().toISOString(),
        publicada_por: userId,
        situacao: "publicada",
      })
      .eq("id", input.versaoId);

    await supabaseAdmin
      .from("assembleias")
      .update({ situacao: "ata_publicada" })
      .eq("id", versao.assembleia_id);

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.ata.publicar",
      metadata: { versao_id: input.versaoId, hash },
    });

    return { hash, textoCompleto };
  });

export const criarNovaVersaoAta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const userId = (context as any).userId as string;

    const { data: publicada } = await supabaseAdmin
      .from("ata_versoes")
      .select("*")
      .eq("assembleia_id", input.assembleiaId)
      .eq("situacao", "publicada")
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!publicada) throw new Error("Não há versão publicada para copiar.");

    const { data: nova, error } = await supabaseAdmin
      .from("ata_versoes")
      .insert({
        assembleia_id: input.assembleiaId,
        numero: publicada.numero + 1,
        situacao: "rascunho",
        gerada_por: "copia",
        modelo: publicada.modelo,
        criada_por: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: blocos } = await supabaseAdmin
      .from("ata_blocos")
      .select("*")
      .eq("versao_id", publicada.id)
      .order("ordem", { ascending: true });

    for (const b of blocos ?? []) {
      await supabaseAdmin.from("ata_blocos").insert({
        versao_id: nova.id,
        tipo: b.tipo,
        item_id: b.item_id,
        ordem: b.ordem,
        texto: b.texto,
        origem_audio_inicio: b.origem_audio_inicio,
        origem_audio_fim: b.origem_audio_fim,
        confianca: b.confianca,
      });
    }

    return { versaoId: nova.id as string, numero: publicada.numero + 1 };
  });

export const consumoIaAssembleia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: eventos } = await supabaseAdmin
      .from("eventos_ia")
      .select("origem, tokens_input, tokens_output, meta")
      .in("origem", [
        "assembleia_transcricao",
        "assembleia_ata",
        "assembleia_inadimplencia",
        "assembleia_revisao_pauta",
      ]);

    const doAssembleia = (eventos ?? []).filter(
      (e: any) => (e.meta as any)?.assembleia_id === input.assembleiaId,
    );

    const segundosAudio = doAssembleia.reduce(
      (acc: number, e: any) => acc + (Number((e.meta as any)?.duracao_seg) || 0),
      0,
    );

    return {
      chamadas: doAssembleia.length,
      minutosAudio: Math.round((segundosAudio / 60) * 10) / 10,
      tokensInput: doAssembleia.reduce((a: number, e: any) => a + (e.tokens_input ?? 0), 0),
      tokensOutput: doAssembleia.reduce((a: number, e: any) => a + (e.tokens_output ?? 0), 0),
    };
  });
