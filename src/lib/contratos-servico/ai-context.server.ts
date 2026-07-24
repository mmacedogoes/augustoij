/**
 * Sincroniza um contrato de prestação de serviços com o acervo de
 * documentos do condomínio para que ele entre no contexto da IA.
 *
 * - Contratos com arquivo: copia o arquivo para o bucket `documentos`,
 *   registra a linha em `documentos` como tipo `contrato` e aciona o
 *   mesmo pipeline usado pela aba Documentos (chunks + embeddings).
 * - Contratos manuais (sem arquivo): monta um resumo textual estruturado
 *   ("Ficha de contrato — <prestador>") e sobe como .txt no mesmo bucket,
 *   passando pelo mesmo pipeline.
 *
 * Idempotente: se o contrato já estiver vinculado a um documento, apenas
 * atualiza o texto/documento quando fizer sentido, sem duplicar linhas.
 * Nunca lança para não bloquear salvamento — falhas são apenas logadas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined) return "não informado";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "não informada";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

function rotuloIndice(i: string | null | undefined): string {
  switch (i) {
    case "igpm": return "IGP-M";
    case "ipca": return "IPCA";
    case "inpc": return "INPC";
    case "outro": return "outro índice";
    case "nenhum": return "sem índice";
    default: return "não informado";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function montarResumoContrato(c: any, obrigacoes: any[], tipoNome: string | null): string {
  const linhas: string[] = [];
  linhas.push(`Ficha de contrato — ${c.prestador_nome ?? "prestador não identificado"}`);
  linhas.push("");
  linhas.push(`Tipo de serviço: ${tipoNome ?? "não classificado"}`);
  linhas.push(`Prestador: ${c.prestador_nome ?? "—"}${c.prestador_documento ? ` (${c.prestador_documento})` : ""}`);
  if (c.prestador_email) linhas.push(`E-mail do prestador: ${c.prestador_email}`);
  if (c.prestador_telefone) linhas.push(`Telefone do prestador: ${c.prestador_telefone}`);
  linhas.push(`Situação: ${c.situacao ?? "ativo"}`);
  if (c.situacao === "encerrado") {
    linhas.push(
      `Contrato ENCERRADO em ${fmtDate(c.encerrado_em)}${c.motivo_encerramento ? ` — motivo: ${c.motivo_encerramento}` : ""}. Não considere este contrato como vigente.`,
    );
  }
  if (c.situacao === "suspenso") {
    linhas.push(`Contrato SUSPENSO. A execução está paralisada até segunda ordem.`);
  }
  linhas.push("");
  linhas.push(`Objeto: ${c.objeto ?? "não descrito"}`);
  linhas.push(
    `Terceirização de mão de obra: ${c.terceirizacao_mao_de_obra ? "sim (trabalhadores alocados continuamente)" : "não"}`,
  );
  linhas.push("");
  linhas.push(`Vigência: início ${fmtDate(c.data_inicio)} — fim ${c.prazo_indeterminado ? "indeterminado" : fmtDate(c.data_fim)}`);
  linhas.push(
    `Renovação automática: ${c.renovacao_automatica ? `sim (aviso prévio de ${c.aviso_previo_dias ?? "—"} dias)` : "não"}`,
  );
  linhas.push("");
  linhas.push(
    `Valor: ${fmtBRL(c.valor)} (${c.tipo_valor === "global" ? "valor global" : "mensal"})${c.dia_vencimento ? ` — dia de vencimento ${c.dia_vencimento}` : ""}`,
  );
  linhas.push(
    `Reajuste: ${rotuloIndice(c.indice_reajuste)}${c.mes_base_reajuste ? ` — mês base ${c.mes_base_reajuste}` : ""}`,
  );
  if (c.multa_rescisoria) linhas.push(`Multa rescisória: ${c.multa_rescisoria}`);
  linhas.push(`Seguro de responsabilidade civil exigido: ${c.exige_seguro_rc ? "sim" : "não"}`);
  if (c.garantias) linhas.push(`Garantias: ${c.garantias}`);
  if (c.foro) linhas.push(`Foro: ${c.foro}`);

  const doCond = obrigacoes.filter((o) => o.parte === "condominio");
  const doPrest = obrigacoes.filter((o) => o.parte === "prestador");
  if (doCond.length > 0 || doPrest.length > 0) {
    linhas.push("");
    linhas.push("Obrigações do condomínio:");
    if (doCond.length === 0) linhas.push("- (nenhuma mapeada)");
    for (const o of doCond) linhas.push(`- ${o.descricao}${o.periodicidade ? ` [${o.periodicidade}]` : ""}`);
    linhas.push("");
    linhas.push("Obrigações do prestador:");
    if (doPrest.length === 0) linhas.push("- (nenhuma mapeada)");
    for (const o of doPrest) linhas.push(`- ${o.descricao}${o.periodicidade ? ` [${o.periodicidade}]` : ""}`);
  }
  return linhas.join("\n");
}

export type SincronizarOptions = {
  contratoId: string;
  triggerProcess?: boolean; // default true
};

/**
 * Espelha o contrato no acervo do condomínio (bucket `documentos`).
 * Se o contrato tem `arquivo_path` no bucket `contratos`, copia o binário
 * para o bucket `documentos`. Se não, gera um resumo estruturado em .txt.
 */
export async function sincronizarContratoNoAcervo(
  supabase: Supa,
  opts: SincronizarOptions,
): Promise<void> {
  const triggerProcess = opts.triggerProcess ?? true;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: c, error } = await supabase
      .from("contratos_servico")
      .select(
        "id, condominio_id, prestador_nome, prestador_documento, prestador_email, prestador_telefone, objeto, terceirizacao_mao_de_obra, data_inicio, data_fim, prazo_indeterminado, renovacao_automatica, aviso_previo_dias, valor, tipo_valor, dia_vencimento, indice_reajuste, mes_base_reajuste, multa_rescisoria, exige_seguro_rc, garantias, foro, arquivo_path, documento_id, situacao, encerrado_em, motivo_encerramento, tipo_servico_id, tipos_servico_contrato(nome)",
      )
      .eq("id", opts.contratoId)
      .maybeSingle();
    if (error || !c) {
      console.warn("[ai-context] contrato não encontrado", error?.message);
      return;
    }

    // Se já existe vínculo com um documento do acervo original (importação
    // a partir de doc existente), não duplicamos.
    if (c.documento_id && !c.arquivo_path) return;

    const { data: obrigacoes } = await supabase
      .from("contrato_obrigacoes")
      .select("parte, descricao, periodicidade")
      .eq("contrato_id", opts.contratoId);

    const tipoNome = (c as { tipos_servico_contrato: { nome: string } | null }).tipos_servico_contrato?.nome ?? null;
    const tituloAcervo = `Contrato de serviço — ${c.prestador_nome}${tipoNome ? ` (${tipoNome})` : ""}`;

    let storagePath: string;
    let nomeArquivo: string;
    let contentType: string;

    if (c.arquivo_path) {
      // Baixa do bucket "contratos" e copia para "documentos".
      const { data: file, error: dlErr } = await supabaseAdmin
        .storage.from("contratos").download(c.arquivo_path);
      if (dlErr || !file) {
        console.warn("[ai-context] falha ao baixar arquivo:", dlErr?.message);
        return;
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const base = c.arquivo_path.split("/").pop() ?? `contrato-${opts.contratoId}.pdf`;
      nomeArquivo = base;
      contentType = file.type || "application/pdf";
      storagePath = `${c.condominio_id}/contratos-servico/${opts.contratoId}-${base}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("documentos")
        .upload(storagePath, buf, { contentType, upsert: true });
      if (upErr) {
        console.warn("[ai-context] upload doc falhou:", upErr.message);
        return;
      }
    } else {
      // Contrato manual — gera resumo .txt
      const resumo = montarResumoContrato(c, (obrigacoes ?? []) as never[], tipoNome);
      const bytes = new TextEncoder().encode(resumo);
      nomeArquivo = `ficha-${(c.prestador_nome ?? "contrato").replace(/[^\w\-]+/g, "_").slice(0, 60)}.txt`;
      contentType = "text/plain; charset=utf-8";
      storagePath = `${c.condominio_id}/contratos-servico/${opts.contratoId}-${nomeArquivo}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("documentos")
        .upload(storagePath, bytes, { contentType, upsert: true });
      if (upErr) {
        console.warn("[ai-context] upload resumo falhou:", upErr.message);
        return;
      }
    }

    // Cria (ou atualiza) a linha em documentos.
    let documentoId = c.documento_id as string | null;
    if (documentoId) {
      await supabaseAdmin
        .from("documentos")
        .update({
          storage_path: storagePath,
          nome_arquivo: nomeArquivo,
          titulo: tituloAcervo,
          status_processamento: "processando",
        })
        .eq("id", documentoId);
    } else {
      const { data: novo, error: insErr } = await supabaseAdmin
        .from("documentos")
        .insert({
          condominio_id: c.condominio_id,
          nome_arquivo: nomeArquivo,
          titulo: tituloAcervo,
          tipo: "contrato",
          storage_path: storagePath,
          status_processamento: "processando",
        })
        .select("id")
        .single();
      if (insErr || !novo) {
        console.warn("[ai-context] insert doc falhou:", insErr?.message);
        return;
      }
      documentoId = novo.id as string;
      await supabaseAdmin
        .from("contratos_servico")
        .update({ documento_id: documentoId })
        .eq("id", opts.contratoId);
    }

    if (triggerProcess && documentoId) {
      try {
        await processarDocumentoAcervo(documentoId);
      } catch (e) {
        console.warn("[ai-context] processamento não disparado:", (e as Error).message);
      }
    }
  } catch (err) {
    console.warn("[ai-context] sincronizar falhou:", (err as Error).message);
  }
}

/**
 * Pipeline de indexação (extração + chunks + embeddings) executado com
 * service_role. É uma cópia enxuta do que `processDocumento` faz na aba
 * Documentos — mantida aqui para não acoplar este helper à server-fn
 * autenticada. Falhas atualizam o status do documento para erro.
 */
async function processarDocumentoAcervo(documentoId: string): Promise<void> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("[ai-context] LOVABLE_API_KEY ausente — pipeline não executado");
    return;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { embedChunksParallel } = await import("@/lib/ai-gateway.server");
  const { extractText, extractTextWithVision, chunkText } = await import("@/lib/documentos.server");

  const { data: doc, error } = await supabaseAdmin
    .from("documentos")
    .select("id, condominio_id, storage_path, nome_arquivo")
    .eq("id", documentoId)
    .maybeSingle();
  if (error || !doc) return;

  try {
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("documentos")
      .download(doc.storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "download falhou");
    const buffer = new Uint8Array(await file.arrayBuffer());
    if (buffer.byteLength === 0) throw new Error("arquivo vazio");

    let text = "";
    try {
      text = await extractText(buffer, doc.nome_arquivo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "__NEEDS_VISION__") {
        text = await extractTextWithVision(apiKey, buffer, doc.nome_arquivo);
      } else {
        throw err;
      }
    }
    if (!text.trim()) throw new Error("texto vazio");

    const chunks = chunkText(text, 1000, 150);
    const { embeddings } = await embedChunksParallel(apiKey, chunks, 5);

    // Limpa chunks antigos deste documento para permitir reprocessamento.
    await supabaseAdmin.from("document_chunks").delete().eq("documento_id", doc.id);

    const rows = chunks.map((c, i) => ({
      condominio_id: doc.condominio_id,
      documento_id: doc.id,
      conteudo: c,
      embedding: `[${embeddings[i].join(",")}]`,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await supabaseAdmin.from("document_chunks").insert(rows.slice(i, i + 50));
    }

    await supabaseAdmin
      .from("documentos")
      .update({ status_processamento: "pronto" })
      .eq("id", doc.id);
  } catch (e) {
    console.warn("[ai-context] pipeline falhou:", (e as Error).message);
    await supabaseAdmin
      .from("documentos")
      .update({ status_processamento: "erro_leitura" })
      .eq("id", documentoId);
  }
}