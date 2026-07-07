import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCategoriaMeta, normalizeCategoria } from "@/lib/categorias-condominio";

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

async function assertOwnerCondominio(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  condominioId: string,
) {
  const { data, error } = await supabase
    .from("condominios")
    .select("id, owner_id")
    .eq("id", condominioId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Condomínio não encontrado.");
  if (data.owner_id !== userId) {
    const { data: hr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!hr) throw new Error("Sem permissão para este condomínio.");
  }
}

async function callGeminiJson(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<unknown> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
    throw new Error(`Falha na IA (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Resposta da IA não é JSON válido.");
  }
}

/**
 * Núcleo compartilhado: dado um documento já processado, extrai unidades
 * e persiste uma sugestão pendente. Reutilizado pelo auto-disparo em
 * processDocumento e pela server function pública.
 */
export async function _extrairESalvarSugestaoUnidades(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  documentoId: string,
  apiKey: string,
  opts: { force?: boolean } = {},
): Promise<UnidadeSugerida[]> {
  const { data: doc, error } = await supabase
    .from("documentos")
    .select("id, condominio_id, nome_arquivo, status_processamento")
    .eq("id", documentoId)
    .maybeSingle();
  if (error || !doc) return [];
  if (doc.status_processamento !== "pronto") return [];

  // Categoria do condomínio guia o vocabulário do prompt (predio, casas,
  // salas_comerciais, shopping, galpoes)
  const { data: cond } = await supabase
    .from("condominios")
    .select("categoria, qtd_unidades")
    .eq("id", doc.condominio_id)
    .maybeSingle();
  const categoriaId = normalizeCategoria(cond?.categoria as string | null);
  const catMeta = getCategoriaMeta(categoriaId);
  const qtdEsperada = (cond?.qtd_unidades as number | null) ?? null;

  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("conteudo")
    .eq("documento_id", doc.id)
    .limit(600);
  // Prioriza chunks que mencionam vocabulário de unidades — a tabela costuma
  // aparecer no meio/fim da convenção e ficava de fora do corte de 40k.
  const RE_UNIDADE =
    /(unidade|apart(a|â)mento|apto|fra[cç][aã]o|lote|quadra|bloco|garag(e|em)|vaga|área privativa|coeficiente|sala|loja|piso|pavimento|galp[aã]o|setor|m[oó]dulo|torre)/i;
  const rawChunks = (chunks ?? []).map((c) => c.conteudo as string);
  const prioritarios = rawChunks.filter((c) => RE_UNIDADE.test(c));
  const restantes = rawChunks.filter((c) => !RE_UNIDADE.test(c));
  const texto = [...prioritarios, ...restantes].join("\n\n").slice(0, 150000);
  if (!texto.trim()) return [];

  const hint = qtdEsperada
    ? `O cadastro do condomínio indica aproximadamente ${qtdEsperada} unidades — use esse valor como referência.`
    : "";
  const system =
    "Você é um assistente especialista em convenções de condomínio brasileiras. " +
    "Sua tarefa é EXTRAIR TODAS as unidades autônomas mencionadas — mesmo que o texto esteja " +
    "quebrado por OCR ou dividido em várias tabelas/anexos. Procure quadros de frações ideais, " +
    "listas numeradas, anexos, memoriais descritivos e o corpo da convenção. " +
    catMeta.vocabIA + " " + hint + " " +
    "REGRA IMPORTANTE: se a convenção declarar quantidades globais (por exemplo " +
    '"o condomínio é composto por 662 lotes distribuídos em 36 quadras" ou "40 apartamentos por bloco") ' +
    "e NÃO trouxer a lista individual completa, GERE as unidades numericamente conforme a descrição " +
    "(ex.: 662 lotes em 36 quadras → distribua exatamente 662 lotes entre Q1..Q36; o TOTAL deve bater " +
    "com o número declarado. Se 662/36 não for inteiro, use base=floor(662/36)=18 por quadra e some +1 " +
    "às primeiras (662 mod 36)=14 quadras — resultando em 14 quadras com 19 lotes e 22 com 18 lotes, " +
    "totalizando exatamente 662. Nunca devolva 648 ou 650 quando o texto disser 662). Sempre preencha o " +
    "campo 'bloco' com Q1..QN quando houver quadras/setores/torres declarados. " +
    "REGRA DE CONTAGEM ESTRITA: o TOTAL de unidades retornadas deve ser EXATAMENTE o número que a convenção " +
    "declarar (ex.: 'condomínio composto por 60 apartamentos' → devolva 60, nunca 72). NÃO conte como unidade: " +
    "vagas de garagem, boxes/depósitos, hobby boxes, área comum, salão de festas, guarita, casa do zelador, " +
    "reservatórios — a menos que a convenção diga EXPLICITAMENTE que são unidades autônomas com matrícula própria. " +
    "NÃO duplique unidades: cada par (bloco, número) deve aparecer UMA única vez. Se a mesma unidade aparecer " +
    "em várias tabelas (fração ideal, área privativa, vagas), consolide em UMA linha. " +
    "Prefira sempre a lista real quando existir. NÃO devolva vazio se o próprio texto disser quantas unidades existem. " +
    'Responda EXCLUSIVAMENTE em JSON no formato: {"unidades":[{"bloco":string|null,"numero":string,' +
    '"tipo":"apartamento|casa|lote|terreno|sala_comercial|loja|galpao|vaga_avulsa|outro","fracao_ideal":number|null,' +
    '"area_m2":number|null,"vagas_garagem":number}]}. ' +
    "SEMPRE preencha o campo 'tipo' com o valor que melhor descreve a unidade conforme a categoria informada acima " +
    "(condomínio de casas/lotes → 'lote' ou 'casa'; logístico → 'galpao'; comercial → 'sala_comercial' ou 'loja'). " +
    "Se o documento não trouxer o campo, use null (ou 0 para vagas). Se realmente NÃO encontrar " +
    'nenhuma unidade, devolva {"unidades":[]}, mas releia com atenção antes de desistir — ' +
    "convenções sempre listam unidades em algum ponto. Não invente unidades que não estejam no texto.";
  const user = `Arquivo: ${doc.nome_arquivo}\n\nTexto da convenção (pode estar truncado; releia com cuidado procurando listas/tabelas):\n\n${texto}`;

  const parsed = (await callGeminiJson(apiKey, system, user)) as { unidades?: unknown[] };
  const linhas = z.array(UnidadeSugestao).safeParse(parsed?.unidades ?? []);
  const unidades = linhas.success ? linhas.data : [];
  if (unidades.length === 0) return [];

  // Em modo force, apaga sugestões anteriores em QUALQUER status para essa convenção
  const del = supabase.from("sugestoes_unidades").delete().eq("documento_id", doc.id);
  await (opts.force ? del : del.eq("status", "pendente"));
  await supabase.from("sugestoes_unidades").insert({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    payload: { unidades },
    status: "pendente",
  });
  return unidades;
}

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

    const unidades = await _extrairESalvarSugestaoUnidades(
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
      .select("id, documento_id, payload, created_at")
      .eq("condominio_id", data.condominioId)
      .eq("status", "pendente")
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
    await assertOwnerCondominio(context.supabase, context.userId, data.condominioId);

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

    const parsed = (await callGeminiJson(apiKey, system, user)) as { condominos?: unknown[] };
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
    await assertOwnerCondominio(context.supabase, context.userId, data.condominioId);

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

    const unidades = await _extrairESalvarSugestaoUnidades(
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
    const chunks = chunkText(texto, 1000, 150);
    const embeddings = await embedChunksParallel(apiKey, chunks, 5);
    const rows = chunks.map((c, i) => ({
      condominio_id: data.condominioId,
      documento_id: doc.id,
      conteudo: c,
      embedding: `[${embeddings[i].join(",")}]`,
    }));
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
    const unidades = await _extrairESalvarSugestaoUnidades(
      context.supabase,
      doc.id,
      apiKey,
      { force: true },
    );
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
