/**
 * Rotina diária de lembretes dos contratos de prestação de serviços (Fase 4).
 *
 * Chamada por pg_cron uma vez por dia. Autentica pelo header `apikey`
 * contra `SUPABASE_ANON_KEY` (padrão do projeto para hooks internos).
 *
 * Passos:
 *  1. Coleta eventos pendentes com data <= hoje (Brasília) que ainda não foram notificados.
 *  2. Coleta checklists atrasados: períodos vencidos com itens obrigatórios ainda pendentes.
 *  3. Agrupa por destinatário (responsáveis do contrato; se não houver, o `criado_por`).
 *  4. Grava uma notificação in-app por item (com dedupe por evento+usuário).
 *  5. Envia UM e-mail resumido por destinatário pelo Resend, usando o template HTML anexo.
 *  6. Marca `notificado_em` nos eventos entregues (checklists usam a própria data de vencimento).
 *
 * Robusto: cada destinatário falha isoladamente (falha no envio de um e-mail
 * não impede os demais e não marca o evento como notificado).
 */
import { createFileRoute } from "@tanstack/react-router";
import templateHtml from "@/lib/contratos-servico/email-lembretes-template.html?raw";

// -------- tipos utilitários
type EventoBase = {
  id: string;
  contrato_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
};
type ContratoInfo = { id: string; prestador_nome: string; criado_por: string | null; condominios: { nome: string } | null };
type Destinatario = { user_id: string; nome: string | null; email: string };
type ItemEmail = {
  evento_id: string | null;
  contrato_id: string;
  etiqueta: string;
  titulo: string;
  descricao: string;
  prestador: string;
  condominio: string;
  data_iso: string;
};

export const Route = createFileRoute("/api/public/hooks/lembretes-contratos")({
  server: {
    handlers: {
      GET: async ({ request }) => runHandler(request),
      POST: async ({ request }) => runHandler(request),
    },
  },
});

async function runHandler(request: Request): Promise<Response> {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const provided = request.headers.get("apikey") ?? "";
  if (!anonKey || provided !== anonKey) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const resendKey = process.env.RESEND_API_KEY;
  const hoje = hojeBR();

  // ---------- 1) Eventos vencidos hoje ou antes, ainda pendentes e não notificados
  const { data: eventosRaw, error: eErr } = await supabaseAdmin
    .from("contrato_eventos")
    .select("id, contrato_id, tipo, titulo, descricao, data_evento")
    .eq("status", "pendente")
    .is("notificado_em", null)
    .lte("data_evento", hoje)
    .order("data_evento", { ascending: true })
    .limit(500);
  if (eErr) {
    console.error("[lembretes-contratos] eventos:", eErr);
    return json({ ok: false, error: eErr.message }, 500);
  }
  const eventos = (eventosRaw ?? []) as EventoBase[];

  // ---------- 2) Checklists atrasados (períodos abertos com competência de mês anterior)
  const primeiroDoMes = hoje.slice(0, 7) + "-01";
  const { data: checkRaw, error: cErr } = await supabaseAdmin
    .from("contrato_checklist_periodos")
    .select("id, competencia, status, checklist_id, contrato_checklists!inner(id, contrato_id, escopo)")
    .eq("status", "aberto")
    .lt("competencia", primeiroDoMes)
    .order("competencia", { ascending: false })
    .limit(500);
  if (cErr) {
    console.warn("[lembretes-contratos] checklists (ignorado):", cErr.message);
  }
  type PeriodoRow = {
    id: string; competencia: string; status: string; checklist_id: string;
    contrato_checklists: { id: string; contrato_id: string; escopo: string } | null;
  };
  const periodos = ((checkRaw ?? []) as unknown as PeriodoRow[]);
  const eventosChecklist: EventoBase[] = [];
  for (const p of periodos) {
    if (!p.contrato_checklists) continue;
    const { data: itens } = await supabaseAdmin
      .from("contrato_checklist_itens")
      .select("id, ativo")
      .eq("checklist_id", p.checklist_id)
      .eq("ativo", true);
    const itensAtivos = ((itens ?? []) as unknown as { id: string }[]);
    if (itensAtivos.length === 0) continue;
    const { data: marc } = await supabaseAdmin
      .from("contrato_checklist_marcacoes")
      .select("item_id, situacao")
      .eq("periodo_id", p.id);
    const decididos = new Set(
      ((marc ?? []) as unknown as { item_id: string; situacao: string }[])
        .filter((m) => m.situacao === "conforme" || m.situacao === "nao_se_aplica")
        .map((m) => m.item_id),
    );
    const pendentesQtd = itensAtivos.filter((i) => !decididos.has(i.id)).length;
    if (pendentesQtd <= 0) continue;
    eventosChecklist.push({
      id: `checklist:${p.id}`,
      contrato_id: p.contrato_checklists.contrato_id,
      tipo: "checklist_pendente",
      titulo: `${pendentesQtd} item(ns) pendente(s) do checklist`,
      descricao: `Competência ${formatBR(p.competencia)} — ${p.contrato_checklists.escopo}.`,
      data_evento: p.competencia,
    });
  }

  const todosEventos: EventoBase[] = [...eventos, ...eventosChecklist];
  if (todosEventos.length === 0) {
    return json({ ok: true, sent: 0, destinatarios: 0, eventos: 0 });
  }

  // ---------- 3) Carrega contratos ativos + destinatarios
  const contratoIds = Array.from(new Set(todosEventos.map((e) => e.contrato_id)));
  const { data: contratosRaw, error: contErr } = await supabaseAdmin
    .from("contratos_servico")
    .select("id, prestador_nome, criado_por, notificacoes_ativas, situacao, condominios(nome)")
    .in("id", contratoIds);
  if (contErr) {
    console.error("[lembretes-contratos] contratos:", contErr);
    return json({ ok: false, error: contErr.message }, 500);
  }
  type ContRow = ContratoInfo & { notificacoes_ativas: boolean; situacao: string };
  const contratosAtivos = ((contratosRaw ?? []) as ContRow[])
    .filter((c) => c.notificacoes_ativas && c.situacao === "ativo");
  const contratosById = new Map(contratosAtivos.map((c) => [c.id, c]));

  const { data: relsRaw } = await supabaseAdmin
    .from("contrato_responsaveis")
    .select("contrato_id, user_id")
    .in("contrato_id", contratoIds);
  const relsPorContrato = new Map<string, string[]>();
  for (const r of (relsRaw ?? []) as { contrato_id: string; user_id: string }[]) {
    const arr = relsPorContrato.get(r.contrato_id) ?? [];
    arr.push(r.user_id);
    relsPorContrato.set(r.contrato_id, arr);
  }

  // Universo de usuários alvo (para carregar profiles em lote)
  const userIds = new Set<string>();
  for (const c of contratosAtivos) {
    const rels = relsPorContrato.get(c.id);
    if (rels && rels.length > 0) rels.forEach((u) => userIds.add(u));
    else if (c.criado_por) userIds.add(c.criado_por);
  }
  if (userIds.size === 0) {
    return json({ ok: true, sent: 0, destinatarios: 0, eventos: todosEventos.length });
  }
  const { data: profilesRaw } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, email")
    .in("id", Array.from(userIds));
  const profilesById = new Map(
    ((profilesRaw ?? []) as { id: string; nome: string | null; email: string | null }[])
      .map((p) => [p.id, p]),
  );

  // ---------- 4) Agrupa por destinatário
  const porUsuario = new Map<string, { destinatario: Destinatario; itens: ItemEmail[]; eventoIds: string[] }>();
  const baseUrl = process.env.PUBLIC_APP_URL || "https://augustoij.com.br";

  for (const ev of todosEventos) {
    const c = contratosById.get(ev.contrato_id);
    if (!c) continue; // contrato inativo ou avisos desligados
    const alvos = relsPorContrato.get(ev.contrato_id) ?? (c.criado_por ? [c.criado_por] : []);
    for (const uid of alvos) {
      const p = profilesById.get(uid);
      if (!p || !p.email) continue;
      const entry = porUsuario.get(uid) ?? {
        destinatario: { user_id: uid, nome: p.nome, email: p.email },
        itens: [],
        eventoIds: [],
      };
      entry.itens.push({
        evento_id: ev.id.startsWith("checklist:") ? null : ev.id,
        contrato_id: ev.contrato_id,
        etiqueta: etiquetaTipo(ev.tipo),
        titulo: ev.titulo,
        descricao: ev.descricao ?? "",
        prestador: c.prestador_nome,
        condominio: c.condominios?.nome ?? "—",
        data_iso: ev.data_evento,
      });
      if (!ev.id.startsWith("checklist:")) entry.eventoIds.push(ev.id);
      porUsuario.set(uid, entry);
    }
  }

  // ---------- 5) Envia + registra notificações + marca notificado_em
  let enviados = 0;
  const eventosMarcados: string[] = [];
  const erros: Array<{ email: string; erro: string }> = [];

  for (const { destinatario, itens, eventoIds } of porUsuario.values()) {
    // Cria notificações in-app (uma por item de evento, não checklist)
    for (const item of itens) {
      if (!item.evento_id) continue;
      await supabaseAdmin.from("notificacoes").insert({
        user_id: destinatario.user_id,
        titulo: item.titulo,
        mensagem: item.descricao || null,
        categoria: "contrato",
        url_destino: `/app/contratos/${item.contrato_id}`,
        contrato_id: item.contrato_id,
        evento_id: item.evento_id,
      } as never).then(({ error }) => {
        if (error && !/duplicate|23505/i.test(error.message)) {
          console.warn("[lembretes-contratos] notificacao:", error.message);
        }
      });
    }

    // Sem chave Resend? seguimos com notificações in-app, sem tentar e-mail.
    if (!resendKey) {
      eventosMarcados.push(...eventoIds);
      continue;
    }

    const html = montarHtml(templateHtml, destinatario, itens, baseUrl);
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Augusto.IJ <lembretes@mail.augustoij.com.br>",
          to: [destinatario.email],
          subject: `Você tem ${itens.length} lembrete${itens.length === 1 ? "" : "s"} de contrato hoje`,
          html,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        console.error(`[lembretes-contratos] Resend ${resp.status}: ${body}`);
        erros.push({ email: destinatario.email, erro: `Resend ${resp.status}` });
        continue; // não marca como notificado — próximo ciclo tenta de novo
      }
      enviados += 1;
      eventosMarcados.push(...eventoIds);
    } catch (e) {
      console.error("[lembretes-contratos] fetch Resend:", e);
      erros.push({ email: destinatario.email, erro: e instanceof Error ? e.message : "erro" });
    }
  }

  if (eventosMarcados.length > 0) {
    const nowIso = new Date().toISOString();
    const { error: markErr } = await supabaseAdmin
      .from("contrato_eventos")
      .update({ notificado_em: nowIso } as never)
      .in("id", eventosMarcados);
    if (markErr) console.warn("[lembretes-contratos] notificado_em:", markErr.message);
  }

  return json({
    ok: true,
    destinatarios: porUsuario.size,
    eventos: todosEventos.length,
    sent: enviados,
    erros: erros.length > 0 ? erros : undefined,
  });
}

// --------------------------------------------------------------- helpers

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hojeBR(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function etiquetaTipo(tipo: string): string {
  switch (tipo) {
    case "fim_vigencia": return "Vigência";
    case "janela_denuncia": return "Renovação";
    case "reajuste": return "Reajuste";
    case "pagamento": return "Pagamento";
    case "checklist_pendente": return "Checklist";
    case "manual": return "Lembrete";
    default: return "Aviso";
  }
}

/** Escape HTML para strings vindas do banco (nome de prestador, título etc.). */
function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function montarHtml(
  template: string,
  destinatario: Destinatario,
  itens: ItemEmail[],
  baseUrl: string,
): string {
  // Extrai o bloco de item do template
  const inicio = template.indexOf("<!--ITEM_INICIO-->");
  const fim = template.indexOf("<!--ITEM_FIM-->");
  if (inicio === -1 || fim === -1) {
    throw new Error("Template inválido: marcadores de item não encontrados.");
  }
  const itemTpl = template.slice(inicio + "<!--ITEM_INICIO-->".length, fim);
  const antes = template.slice(0, inicio);
  const depois = template.slice(fim + "<!--ITEM_FIM-->".length);

  const itensHtml = itens
    .map((it) =>
      itemTpl
        .replaceAll("{{ITEM_ETIQUETA}}", esc(it.etiqueta))
        .replaceAll("{{ITEM_TITULO}}", esc(it.titulo))
        .replaceAll("{{ITEM_DESCRICAO}}", esc(it.descricao || "—"))
        .replaceAll("{{ITEM_PRESTADOR}}", esc(it.prestador))
        .replaceAll("{{ITEM_CONDOMINIO}}", esc(it.condominio))
        .replaceAll("{{ITEM_DATA}}", esc(formatBR(it.data_iso)))
        .replaceAll("{{ITEM_URL}}", `${baseUrl}/app/contratos/${encodeURIComponent(it.contrato_id)}`),
    )
    .join("\n");

  const nome = destinatario.nome?.trim() || destinatario.email;
  const abertura = itens.length === 1
    ? "Há um evento de contrato pedindo sua atenção hoje. O detalhe está logo abaixo."
    : `Há ${itens.length} eventos de contrato pedindo sua atenção hoje. Confira os detalhes logo abaixo.`;
  const preview = itens.length === 1
    ? `1 lembrete de contrato: ${itens[0].titulo}`
    : `${itens.length} lembretes de contrato para revisar hoje`;

  return (antes + itensHtml + depois)
    .replaceAll("{{PREVIEW_TEXTO}}", esc(preview))
    .replaceAll("{{SUBTITULO}}", esc(itens.length === 1 ? "1 lembrete para hoje" : `${itens.length} lembretes para hoje`))
    .replaceAll("{{NOME_USUARIO}}", esc(nome))
    .replaceAll("{{MENSAGEM_ABERTURA}}", esc(abertura))
    .replaceAll("{{URL_PAINEL}}", `${baseUrl}/app/contratos`)
    .replaceAll("{{ANO}}", String(new Date().getUTCFullYear()));
}