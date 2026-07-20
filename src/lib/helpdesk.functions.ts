import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Tipos e enums
// ============================================================

export const ASSUNTOS = [
  { value: "duvida_uso", label: "Dúvida de uso" },
  { value: "problema_tecnico", label: "Problema técnico / Bug" },
  { value: "financeiro", label: "Financeiro / Assinatura" },
  { value: "sugestao", label: "Sugestão / Melhoria" },
  { value: "seguranca_lgpd", label: "Segurança / LGPD" },
  { value: "outro", label: "Outro" },
] as const;

export type HelpdeskAssunto = (typeof ASSUNTOS)[number]["value"];
export type HelpdeskStatus =
  | "aberto"
  | "respondido_admin"
  | "respondido_cliente"
  | "encerrado";
export type HelpdeskAutor = "cliente" | "admin";

export type HelpdeskAnexo = {
  path: string;
  name: string;
  size: number;
  mime: string;
};

export type HelpdeskTicket = {
  id: string;
  protocolo: string;
  user_id: string;
  assunto: HelpdeskAssunto;
  titulo: string;
  status: HelpdeskStatus;
  encerrado_em: string | null;
  encerrado_por: HelpdeskAutor | null;
  created_at: string;
  updated_at: string;
};

export type HelpdeskMensagem = {
  id: string;
  ticket_id: string;
  autor_user_id: string;
  autor_tipo: HelpdeskAutor;
  conteudo: string;
  anexos: HelpdeskAnexo[];
  created_at: string;
};

// ============================================================
// Schemas
// ============================================================

const anexoSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(5 * 1024 * 1024),
  mime: z.string().min(1).max(120),
});

const abrirSchema = z.object({
  assunto: z.enum([
    "duvida_uso",
    "problema_tecnico",
    "financeiro",
    "sugestao",
    "seguranca_lgpd",
    "outro",
  ]),
  titulo: z.string().trim().min(3, "Informe um título").max(160),
  conteudo: z.string().trim().min(10, "Descreva com pelo menos 10 caracteres").max(5000),
  anexos: z.array(anexoSchema).max(3).optional().default([]),
});

const responderSchema = z.object({
  ticketId: z.string().uuid(),
  conteudo: z.string().trim().min(1, "Escreva uma mensagem").max(5000),
  anexos: z.array(anexoSchema).max(3).optional().default([]),
});

const idSchema = z.object({ ticketId: z.string().uuid() });

// ============================================================
// Helpers
// ============================================================

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assuntoLabel(a: HelpdeskAssunto): string {
  return ASSUNTOS.find((x) => x.value === a)?.label ?? a;
}

function baseUrl(): string {
  return process.env.APP_PUBLIC_URL || "https://augustoij.com.br";
}

type EmailKind =
  | "abertura_cliente"
  | "resposta_admin_para_cliente"
  | "encerramento_cliente"
  | "novo_para_admin"
  | "resposta_cliente_para_admin"
  | "lembrete_admin";

type EmailCtx = {
  ticket: HelpdeskTicket;
  clienteNome: string;
  clienteEmail: string;
  mensagem?: string;
};

async function enviarEmailHelpdesk(kind: EmailKind, ctx: EmailCtx): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("[helpdesk] RESEND_API_KEY ausente");
    return;
  }

  const linkCliente = `${baseUrl()}/app/suporte/${ctx.ticket.id}`;
  const linkAdmin = `${baseUrl()}/app/admin/helpdesk/${ctx.ticket.id}`;
  const assunto = assuntoLabel(ctx.ticket.assunto);
  const protocolo = esc(ctx.ticket.protocolo);
  const tituloTicket = esc(ctx.ticket.titulo);
  const mensagemHtml = ctx.mensagem ? esc(ctx.mensagem).replace(/\n/g, "<br>") : "";

  const wrap = (inner: string, cta: { label: string; href: string }): string => `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5ef;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2a24;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f5ef;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e6e2d5;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 28px;background:#00512B;color:#F4E8D3;">
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;letter-spacing:.02em;">Augusto.IJ · Suporte</div>
            <div style="font-size:12px;color:#B8935A;margin-top:4px;text-transform:uppercase;letter-spacing:.14em;">Protocolo ${protocolo}</div>
          </td></tr>
          <tr><td style="padding:24px 28px;font-size:14px;line-height:1.55;">
            ${inner}
            <div style="margin-top:24px;">
              <a href="${cta.href}" style="display:inline-block;background:#B8935A;color:#00201A;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;letter-spacing:.02em;">${cta.label}</a>
            </div>
            <p style="margin:24px 0 0;font-size:12px;color:#6b6c62;">Assunto: ${esc(assunto)} — <em>${tituloTicket}</em></p>
          </td></tr>
          <tr><td style="padding:14px 28px;background:#f7f5ef;border-top:1px solid #ece7d6;font-size:11px;color:#6b6c62;text-align:center;">
            Dura lex, sed Augusto.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  let subject = "";
  let html = "";
  const toCliente = [ctx.clienteEmail];
  const toAdmin = ["mmacedogoes@gmail.com", "suporte@augustoij.com.br"];
  let to: string[] = [];

  switch (kind) {
    case "abertura_cliente":
      subject = `Chamado aberto — ${ctx.ticket.protocolo}`;
      to = toCliente;
      html = wrap(
        `<p style="margin:0 0 12px;">Olá, ${esc(ctx.clienteNome)}.</p>
         <p style="margin:0 0 12px;">Recebemos seu chamado <strong>${protocolo}</strong>. Nossa equipe responde em até <strong>24 horas úteis</strong>.</p>
         <p style="margin:0 0 12px;">Você pode acompanhar toda a conversa na área "Conta → Suporte" do sistema.</p>`,
        { label: "Acompanhar chamado", href: linkCliente },
      );
      break;
    case "resposta_admin_para_cliente":
      subject = `Nova resposta no seu chamado ${ctx.ticket.protocolo}`;
      to = toCliente;
      html = wrap(
        `<p style="margin:0 0 12px;">Olá, ${esc(ctx.clienteNome)}.</p>
         <p style="margin:0 0 12px;">Nossa equipe respondeu ao seu chamado <strong>${protocolo}</strong>.</p>
         ${mensagemHtml ? `<div style="padding:12px 14px;background:#f7f5ef;border-radius:8px;border:1px solid #ece7d6;margin:12px 0;">${mensagemHtml}</div>` : ""}`,
        { label: "Abrir chamado", href: linkCliente },
      );
      break;
    case "encerramento_cliente":
      subject = `Chamado encerrado — ${ctx.ticket.protocolo}`;
      to = toCliente;
      html = wrap(
        `<p style="margin:0 0 12px;">Olá, ${esc(ctx.clienteNome)}.</p>
         <p style="margin:0 0 12px;">O chamado <strong>${protocolo}</strong> foi encerrado. Se precisar retomar, você pode reabri-lo em até 7 dias na área de suporte.</p>`,
        { label: "Ver chamado", href: linkCliente },
      );
      break;
    case "novo_para_admin":
      subject = `[Suporte] Novo chamado ${ctx.ticket.protocolo} — ${assunto}`;
      to = toAdmin;
      html = wrap(
        `<p style="margin:0 0 8px;"><strong>Cliente:</strong> ${esc(ctx.clienteNome)} (${esc(ctx.clienteEmail)})</p>
         <p style="margin:0 0 8px;"><strong>Assunto:</strong> ${esc(assunto)}</p>
         <p style="margin:0 0 8px;"><strong>Título:</strong> ${tituloTicket}</p>
         ${mensagemHtml ? `<div style="padding:12px 14px;background:#f7f5ef;border-radius:8px;border:1px solid #ece7d6;margin:12px 0;">${mensagemHtml}</div>` : ""}`,
        { label: "Responder no painel", href: linkAdmin },
      );
      break;
    case "resposta_cliente_para_admin":
      subject = `[Suporte] Cliente respondeu — ${ctx.ticket.protocolo}`;
      to = toAdmin;
      html = wrap(
        `<p style="margin:0 0 8px;"><strong>Cliente:</strong> ${esc(ctx.clienteNome)} (${esc(ctx.clienteEmail)})</p>
         ${mensagemHtml ? `<div style="padding:12px 14px;background:#f7f5ef;border-radius:8px;border:1px solid #ece7d6;margin:12px 0;">${mensagemHtml}</div>` : ""}`,
        { label: "Responder no painel", href: linkAdmin },
      );
      break;
    case "lembrete_admin":
      subject = `[Suporte] Lembrete: chamado ${ctx.ticket.protocolo} aguarda resposta`;
      to = toAdmin;
      html = wrap(
        `<p style="margin:0 0 12px;">O chamado <strong>${protocolo}</strong> de ${esc(ctx.clienteNome)} está aguardando resposta há mais de 12 horas.</p>`,
        { label: "Responder agora", href: linkAdmin },
      );
      break;
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Augusto.IJ Suporte <naoresponda@mail.augustoij.com.br>",
        to,
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error("[helpdesk] Resend falhou", resp.status, body.slice(0, 200));
    }
  } catch (e) {
    console.error("[helpdesk] Falha ao enviar e-mail", e instanceof Error ? e.message : e);
  }
}

// ============================================================
// Server functions — cliente
// ============================================================

export const listMeusTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("helpdesk_tickets" as any)
      .select("id, protocolo, assunto, titulo, status, encerrado_em, encerrado_por, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as HelpdeskTicket[];
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;
    const { data: ticket, error } = await client
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Chamado não encontrado");

    const { data: mensagens, error: e2 } = await client
      .from("helpdesk_mensagens")
      .select("*")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);

    return {
      ticket: ticket as HelpdeskTicket,
      mensagens: (mensagens ?? []) as HelpdeskMensagem[],
    };
  });

export const abrirTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => abrirSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;

    const { data: proto, error: ep } = await client.rpc("gerar_protocolo_helpdesk");
    if (ep || !proto) throw new Error(ep?.message || "Falha ao gerar protocolo");

    const { data: ticket, error } = await client
      .from("helpdesk_tickets")
      .insert({
        user_id: context.userId,
        protocolo: proto,
        assunto: data.assunto,
        titulo: data.titulo,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { error: em } = await client.from("helpdesk_mensagens").insert({
      ticket_id: ticket.id,
      autor_user_id: context.userId,
      autor_tipo: "cliente",
      conteudo: data.conteudo,
      anexos: data.anexos ?? [],
    });
    if (em) throw new Error(em.message);

    // Dados do cliente para e-mail
    const { data: perfil } = await client
      .from("profiles")
      .select("nome, email")
      .eq("id", context.userId)
      .maybeSingle();

    const ctx: EmailCtx = {
      ticket: ticket as HelpdeskTicket,
      clienteNome: perfil?.nome || "cliente",
      clienteEmail: perfil?.email || (context.claims.email as string) || "",
      mensagem: data.conteudo,
    };

    await Promise.all([
      enviarEmailHelpdesk("abertura_cliente", ctx),
      enviarEmailHelpdesk("novo_para_admin", ctx),
    ]);

    return ticket as HelpdeskTicket;
  });

export const responderTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => responderSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;

    const { data: ticket, error: et } = await client
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (et) throw new Error(et.message);
    if (!ticket) throw new Error("Chamado não encontrado");

    // Checa se é admin
    const { data: isAdmin } = await client.rpc("is_any_admin", { _user_id: context.userId });
    const autor_tipo: HelpdeskAutor =
      ticket.user_id === context.userId ? "cliente" : isAdmin ? "admin" : "cliente";

    if (autor_tipo === "cliente" && ticket.user_id !== context.userId) {
      throw new Error("Sem permissão para responder este chamado");
    }

    const { error: ei } = await client.from("helpdesk_mensagens").insert({
      ticket_id: data.ticketId,
      autor_user_id: context.userId,
      autor_tipo,
      conteudo: data.conteudo,
      anexos: data.anexos ?? [],
    });
    if (ei) throw new Error(ei.message);

    // Envia e-mails
    const { data: dono } = await client
      .from("profiles")
      .select("nome, email")
      .eq("id", ticket.user_id)
      .maybeSingle();

    const ctx: EmailCtx = {
      ticket: ticket as HelpdeskTicket,
      clienteNome: dono?.nome || "cliente",
      clienteEmail: dono?.email || "",
      mensagem: data.conteudo,
    };

    if (autor_tipo === "admin") {
      await enviarEmailHelpdesk("resposta_admin_para_cliente", ctx);
    } else {
      await enviarEmailHelpdesk("resposta_cliente_para_admin", ctx);
    }

    return { ok: true };
  });

export const encerrarTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;
    const { data: ticket, error: et } = await client
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (et) throw new Error(et.message);
    if (!ticket) throw new Error("Chamado não encontrado");

    const { data: isAdmin } = await client.rpc("is_any_admin", { _user_id: context.userId });
    const quem: HelpdeskAutor = ticket.user_id === context.userId ? "cliente" : isAdmin ? "admin" : "cliente";
    if (quem === "cliente" && ticket.user_id !== context.userId) {
      throw new Error("Sem permissão");
    }

    const { error } = await client
      .from("helpdesk_tickets")
      .update({ status: "encerrado", encerrado_em: new Date().toISOString(), encerrado_por: quem })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);

    const { data: dono } = await client
      .from("profiles").select("nome, email").eq("id", ticket.user_id).maybeSingle();

    await enviarEmailHelpdesk("encerramento_cliente", {
      ticket: { ...(ticket as HelpdeskTicket), status: "encerrado", encerrado_por: quem },
      clienteNome: dono?.nome || "cliente",
      clienteEmail: dono?.email || "",
    });

    return { ok: true };
  });

export const reabrirTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;
    const { data: ticket, error: et } = await client
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (et) throw new Error(et.message);
    if (!ticket) throw new Error("Chamado não encontrado");
    if (ticket.user_id !== context.userId) throw new Error("Sem permissão");
    if (ticket.status !== "encerrado") return { ok: true };
    if (ticket.encerrado_em) {
      const dias = (Date.now() - new Date(ticket.encerrado_em).getTime()) / 86400000;
      if (dias > 7) throw new Error("Prazo de 7 dias para reabertura expirado. Abra um novo chamado.");
    }
    const { error } = await client
      .from("helpdesk_tickets")
      .update({ status: "aberto", encerrado_em: null, encerrado_por: null })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAnexoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;
    const { data: signed, error } = await client
      .storage.from("helpdesk-anexos")
      .createSignedUrl(data.path, 60 * 5);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl as string };
  });

// ============================================================
// Server functions — admin
// ============================================================

const adminListSchema = z.object({
  status: z.enum(["aberto", "respondido_admin", "respondido_cliente", "encerrado", "todos"]).optional().default("todos"),
  search: z.string().trim().max(120).optional().default(""),
});

export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminListSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;
    const { data: isAdmin } = await client.rpc("is_any_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    let q = client
      .from("helpdesk_tickets")
      .select("id, protocolo, assunto, titulo, status, user_id, encerrado_em, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.status !== "todos") q = q.eq("status", data.status);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`protocolo.ilike.${s},titulo.ilike.${s}`);
    }
    const { data: tickets, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((tickets ?? []).map((t: { user_id: string }) => t.user_id)));
    const clientesMap = new Map<string, { nome: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: perfis } = await client
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      for (const p of perfis ?? []) {
        clientesMap.set(p.id, { nome: p.nome, email: p.email });
      }
    }
    return (tickets ?? []).map((t: { user_id: string } & Record<string, unknown>) => ({
      ...t,
      cliente: clientesMap.get(t.user_id) ?? { nome: null, email: null },
    }));
  });

export const adminCountAbertos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;
    const { data: isAdmin } = await client.rpc("is_any_admin", { _user_id: context.userId });
    if (!isAdmin) return { count: 0 };
    const { count } = await client
      .from("helpdesk_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["aberto", "respondido_cliente"]);
    return { count: count ?? 0 };
  });