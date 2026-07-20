// deno-lint-ignore-file
// Envia e-mail de dicas de uso via Resend.
// Suporta agendamento nativo do Resend (parâmetro scheduled_at).
// Se `delay_hours` for informado, calcula scheduled_at = agora + N horas.
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
  const URL_LOGO_LIGHT =
    "https://augustoij.com.br/__l5e/assets-v1/4cf5bb71-7fb6-4d4e-8e3b-c4ae0dcbc058/augusto-ij-logo-full-dark-v3.png";
  const link_dashboard = "https://augustoij.com.br/app";
  const nomeSafe = escapeHtml(nome || "");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Augusto.IJ</title>
</head>
<body style="margin:0;padding:0;background-color:#FFFFFF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;max-width:600px;width:100%;">
  <tr>
    <td align="center" bgcolor="#00512B" style="background-color:#00512B;padding:28px 8px;">
      <img src="${URL_LOGO_LIGHT}" width="200" alt="Augusto.IJ" border="0" style="display:block;margin:0 auto;max-width:200px;height:auto;">
    </td>
  </tr>
  <tr>
    <td style="padding:28px 8px;color:#1F2937;font-family:Arial,Helvetica,sans-serif;">
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:0 0 14px;">Olá, ${nomeSafe}.</p>
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:0 0 14px;">Você criou sua conta ontem, então imagino que ainda esteja conhecendo o Augusto. Três coisas que a maioria dos síndicos só descobre depois de semanas — e que valem a pena testar já no primeiro uso:</p>
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:0 0 14px;"><strong>1. Peça documentos prontos.</strong> Em vez de perguntar "posso multar por barulho?", experimente: "gere uma notificação de multa para o apartamento 302 por barulho após as 22h". O Augusto entrega o documento redigido, não só a resposta.</p>
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:0 0 14px;"><strong>2. Envie fotos de documentos escaneados.</strong> Não precisa ser PDF perfeito — uma foto legível da convenção ou da ata já funciona.</p>
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:0 0 14px;"><strong>3. Continue conversas antigas.</strong> O histórico guarda o contexto de cada caso — você não precisa reexplicar a situação toda vez.</p>
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:0 0 14px;">Para testar agora: <a href="${link_dashboard}" style="color:#00512B;font-weight:bold;">acesse sua conta aqui</a>.</p>
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:24px 0 0;">Qualquer dúvida, escreva para suporte@augustoij.com.br — a equipe responde pessoalmente.</p>
      <p style="font-size:15px;line-height:1.7;color:#1F2937;margin:14px 0 0;">Equipe Augusto.IJ</p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 8px;border-top:1px solid #E4E1D8;">
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
      console.error("[send-tips-email] RESEND_API_KEY ausente");
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      nome?: string;
      delay_hours?: number;
      scheduled_at?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const nome = (body.nome ?? "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    let scheduled_at: string | undefined = body.scheduled_at;
    if (!scheduled_at && typeof body.delay_hours === "number" && body.delay_hours > 0) {
      scheduled_at = new Date(Date.now() + body.delay_hours * 3600 * 1000).toISOString();
    }

    const payload: Record<string, unknown> = {
      from: "Augusto.IJ <naoresponda@mail.augustoij.com.br>",
      to: [email],
      subject: "5 minutos para aproveitar melhor o Augusto",
      html: buildHtml(nome),
    };
    if (scheduled_at) payload.scheduled_at = scheduled_at;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("[send-tips-email] Resend falhou", resp.status, text);
      return new Response(
        JSON.stringify({ error: "resend_failed", status: resp.status, detail: text }),
        { status: 502, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    console.log("[send-tips-email] agendado/enviado para", email, "scheduled_at=", scheduled_at ?? "imediato");
    return new Response(
      JSON.stringify({ ok: true, scheduled_at: scheduled_at ?? null, resend: JSON.parse(text) }),
      { status: 200, headers: { ...CORS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-tips-email] erro inesperado", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "unexpected", message }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});