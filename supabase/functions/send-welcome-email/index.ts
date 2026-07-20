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

function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}

async function getAuthenticatedUser(req: Request): Promise<{ email: string; nome?: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    email?: string;
    user_metadata?: { nome?: string; full_name?: string; name?: string };
  };
  if (!data.email) return null;
  const meta = data.user_metadata ?? {};
  return { email: data.email, nome: meta.nome ?? meta.full_name ?? meta.name };
}

function buildHtml(nome: string): string {
  const safe = escapeHtml(nome || "usuário(a)");
  const URL_LOGO_COMPLETO =
    "https://augustoij.com.br/__l5e/assets-v1/598c4b3d-6b9f-4b5a-a484-6e195d698b48/augusto-ij-logo-full-dark-FINAL.png";
  const link_dashboard = "https://augustoij.com.br/app";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Augusto.IJ</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F3F2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F3F2" style="background-color:#F4F3F2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;max-width:600px;width:100%;">
  <tr>
    <td align="center" bgcolor="#00512B" style="background-color:#00512B;padding:36px 40px;">
      <img src="${URL_LOGO_COMPLETO}" width="240" alt="Augusto.IJ — Inteligência Jurídica para Condomínios" border="0" style="display:block;margin:0 auto;max-width:240px;height:auto;">
    </td>
  </tr>
  <tr>
    <td style="padding:40px;color:#1F2937;font-family:Arial,Helvetica,sans-serif;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:bold;font-size:24px;color:#00512B;margin:0 0 16px;">Bem-vindo, ${safe}.</h1>
      <p style="font-size:15px;line-height:1.65;color:#1F2937;margin:0 0 14px;">Sua conta no Augusto.IJ já está ativa e seu período gratuito de 7 dias começou agora.</p>
      <p style="font-size:15px;line-height:1.65;color:#1F2937;margin:0 0 14px;">Os próximos passos mais úteis:</p>
      <p style="font-size:15px;line-height:1.65;color:#1F2937;margin:0 0 14px;">1. Cadastre seu primeiro condomínio<br>2. Envie a convenção e o regimento interno<br>3. Faça sua primeira pergunta no chat</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto;">
        <tr><td align="center" bgcolor="#B8935A" style="background-color:#B8935A;border-radius:4px;">
          <a href="${link_dashboard}" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Acessar minha conta</a>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#475569;margin:0;">Dúvidas? Este endereço não recebe respostas — escreva para suporte@augustoij.com.br</p>
    </td>
  </tr>
  <tr>
    <td align="center" bgcolor="#F4F3F2" style="background-color:#F4F3F2;padding:22px 40px;border-top:1px solid #E4E1D8;">
      <p style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13px;color:#475569;margin:0 0 6px;">Dura lex, sed Augusto.</p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#475569;margin:0;">Augusto.IJ Tecnologia LTDA — Inteligência Jurídica para Condomínios</p>
    </td>
  </tr>
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