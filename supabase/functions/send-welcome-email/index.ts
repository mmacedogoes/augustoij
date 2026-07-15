// deno-lint-ignore-file
// Envia e-mail de boas-vindas via Resend após cadastro do usuário.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(nome: string): string {
  const safe = escapeHtml(nome || "usuário(a)");
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:Georgia,'Times New Roman',serif;color:#1c1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:40px;">
          <tr><td style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e7e5e4;">
            <h1 style="margin:0;font-size:28px;color:#78350f;letter-spacing:0.5px;">Augusto.IJ</h1>
          </td></tr>
          <tr><td style="padding:32px 0 8px;">
            <h2 style="margin:0 0 16px;font-size:22px;color:#1c1917;">Bem-vindo, ${safe}.</h2>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">
              Sua conta no Augusto.IJ já está ativa e seu período gratuito de 30 dias começou agora.
            </p>
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6;"><strong>Os próximos passos mais úteis:</strong></p>
            <ol style="margin:0 0 24px 20px;padding:0;font-size:16px;line-height:1.8;">
              <li>Cadastre seu primeiro condomínio</li>
              <li>Envie a convenção e o regimento interno</li>
              <li>Faça sua primeira pergunta no chat</li>
            </ol>
            <div style="text-align:center;margin:32px 0;">
              <a href="https://augustoij.com.br/app" style="display:inline-block;background:#78350f;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;">Acessar minha conta</a>
            </div>
            <p style="margin:24px 0 0;font-size:14px;color:#57534e;text-align:center;">
              Dúvidas? Escreva para <a href="mailto:suporte@augustoij.com.br" style="color:#78350f;">suporte@augustoij.com.br</a>
            </p>
          </td></tr>
          <tr><td style="padding-top:24px;border-top:1px solid #e7e5e4;text-align:center;">
            <p style="margin:0 0 8px;font-style:italic;color:#78350f;font-size:14px;">Dura lex, sed Augusto.</p>
            <p style="margin:0;font-size:12px;color:#78716c;">
              Augusto.IJ Tecnologia LTDA — Inteligência Jurídica para Condomínios
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[send-welcome-email] RESEND_API_KEY ausente");
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      nome?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const nome = (body.nome ?? "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "Augusto.IJ <naoresponda@mail.augustoij.com.br>",
        to: [email],
        subject: "Bem-vindo ao Augusto.IJ — sua conta está pronta",
        html: buildHtml(nome),
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("[send-welcome-email] Resend falhou", resp.status, text);
      return new Response(
        JSON.stringify({ error: "resend_failed", status: resp.status, detail: text }),
        { status: 502, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    console.log("[send-welcome-email] enviado para", email);
    return new Response(JSON.stringify({ ok: true, resend: JSON.parse(text) }), {
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[send-welcome-email] erro inesperado", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "unexpected", message }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});