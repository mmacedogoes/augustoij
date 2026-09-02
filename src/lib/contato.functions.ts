import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { apenasDigitos } from "./formatters";

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(8, "Telefone inválido").max(40),
  mensagem: z.string().trim().min(10, "Descreva sua necessidade").max(2000),
  // honeypot — deve vir vazio
  website: z.string().max(0).optional().or(z.literal("")),
});

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const enviarContatoPersonalizado = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    // Honeypot preenchido — finge sucesso.
    if (data.website && data.website.length > 0) {
      return { ok: true };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error("[contato] RESEND_API_KEY ausente");
      throw new Error("Serviço de e-mail indisponível no momento.");
    }

    const nome = esc(data.nome);
    const email = esc(data.email);
    const telefone = esc(data.telefone);
    const mensagem = esc(data.mensagem).replace(/\n/g, "<br>");
    const telDigits = apenasDigitos(data.telefone);
    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5ef;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2a24;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f5ef;padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e6e2d5;border-radius:12px;overflow:hidden;">
            <tr><td style="padding:24px 28px;border-bottom:1px solid #ece7d6;">
              <div style="font-family:Georgia,serif;font-size:20px;color:#1e4d3f;">Augusto.IJ · Novo contato</div>
              <div style="font-size:13px;color:#6b6c62;margin-top:4px;">Plano Personalizado — solicitação de contato</div>
            </td></tr>
            <tr><td style="padding:24px 28px;font-size:14px;line-height:1.55;">
              <p style="margin:0 0 12px;"><strong>Nome:</strong> ${nome}</p>
              <p style="margin:0 0 12px;"><strong>E-mail:</strong> <a href="mailto:${email}" style="color:#1e4d3f;">${email}</a></p>
              <p style="margin:0 0 12px;"><strong>Telefone:</strong> <a href="tel:${telDigits}" style="color:#1e4d3f;">${telefone}</a></p>
              <p style="margin:16px 0 6px;"><strong>Mensagem:</strong></p>
              <div style="padding:12px 14px;background:#f7f5ef;border-radius:8px;border:1px solid #ece7d6;">${mensagem}</div>
              <p style="margin:20px 0 0;font-size:12px;color:#6b6c62;">Recebido em ${quando} (America/Sao_Paulo)</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Augusto.IJ <naoresponda@mail.augustoij.com.br>",
        to: ["mmacedogoes@gmail.com"],
        reply_to: data.email,
        subject: `Novo contato — Plano Personalizado — ${data.nome}`,
        html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("[contato] Resend falhou", resp.status, body);
      throw new Error("Não foi possível enviar sua mensagem agora. Tente novamente em instantes.");
    }

    return { ok: true };
  });