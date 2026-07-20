import { createFileRoute } from "@tanstack/react-router";

// Cron: verifica tickets aguardando resposta do admin há mais de 12h e reenvia lembrete.
export const Route = createFileRoute("/api/public/hooks/helpdesk-lembretes")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const RESEND_API_KEY = process.env.RESEND_API_KEY;
          if (!RESEND_API_KEY) return Response.json({ ok: false, error: "no_resend_key" });

          const doze = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const admin = supabaseAdmin as any;
          const { data: tickets, error } = await admin
            .from("helpdesk_tickets")
            .select("id, protocolo, titulo, assunto, user_id, status, last_admin_notified_at")
            .in("status", ["aberto", "respondido_cliente"])
            .lt("last_admin_notified_at", doze)
            .limit(50);
          if (error) throw new Error(error.message);
          if (!tickets || tickets.length === 0) return Response.json({ ok: true, sent: 0 });

          const userIds = Array.from(new Set(tickets.map((t: { user_id: string }) => t.user_id)));
          const { data: perfis } = await admin
            .from("profiles").select("id, nome, email").in("id", userIds);
          const pmap = new Map<string, { nome: string | null; email: string | null }>();
          for (const p of (perfis ?? []) as Array<{ id: string; nome: string | null; email: string | null }>) {
            pmap.set(p.id, { nome: p.nome, email: p.email });
          }

          let sent = 0;
          for (const t of tickets as Array<{ id: string; protocolo: string; titulo: string; user_id: string }>) {
            const p = pmap.get(t.user_id);
            const html = `<!doctype html><html><body style="margin:0;background:#f7f5ef;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2a24;padding:32px 16px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e6e2d5;border-radius:12px;overflow:hidden;">
                <tr><td style="padding:24px 28px;background:#00512B;color:#F4E8D3;">
                  <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;">Augusto.IJ &middot; Suporte</div>
                  <div style="font-size:12px;color:#B8935A;margin-top:4px;text-transform:uppercase;letter-spacing:.14em;">Lembrete de resposta</div>
                </td></tr>
                <tr><td style="padding:24px 28px;font-size:14px;line-height:1.55;">
                  <p style="margin:0 0 12px;">O chamado <strong>${t.protocolo}</strong> de ${p?.nome ?? "cliente"} está aguardando resposta há mais de 12 horas.</p>
                  <p style="margin:0 0 12px;"><strong>Título:</strong> ${String(t.titulo).replace(/</g, "&lt;")}</p>
                  <a href="https://augustoij.com.br/app/admin/helpdesk/${t.id}" style="display:inline-block;background:#B8935A;color:#00201A;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Responder agora</a>
                </td></tr>
              </table></body></html>`;

            const resp = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
              body: JSON.stringify({
                from: "Augusto.IJ Suporte <naoresponda@mail.augustoij.com.br>",
                to: ["mmacedogoes@gmail.com", "suporte@augustoij.com.br"],
                subject: `[Suporte] Lembrete: chamado ${t.protocolo} aguarda resposta`,
                html,
              }),
            });
            if (resp.ok) {
              await admin
                .from("helpdesk_tickets")
                .update({ last_admin_notified_at: new Date().toISOString() })
                .eq("id", t.id);
              sent += 1;
            } else {
              console.error("[helpdesk-lembretes] Resend falhou", resp.status);
            }
          }
          return Response.json({ ok: true, sent });
        } catch (e) {
          console.error("[helpdesk-lembretes] erro", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
        }
      },
    },
  },
});