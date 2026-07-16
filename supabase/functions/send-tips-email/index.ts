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

function buildHtml(nome: string): string {
  // `nome` não é usado no corpo do HTML fornecido pelo cliente, mas
  // mantemos o escape/parâmetro para compatibilidade futura.
  void escapeHtml(nome);
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
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:bold;font-size:24px;color:#00512B;margin:0 0 16px;">4 formas de aproveitar melhor o Augusto</h1>
      <p style="font-size:15px;line-height:1.65;color:#1F2937;margin:0 0 18px;">Você já tem um dia de conta. Aqui estão os recursos que a maioria dos síndicos descobre tarde demais:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
        <tr>
          <td width="3" bgcolor="#B8935A" style="background-color:#B8935A;"></td>
          <td style="padding:2px 0 2px 16px;">
            <p style="font-size:14px;font-weight:bold;color:#1F2937;margin:0 0 4px;">Peça modelos prontos</p>
            <p style="font-size:13px;color:#475569;margin:0;">"Gere uma notificação de multa para o apartamento 302 por barulho após as 22h."</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
        <tr>
          <td width="3" bgcolor="#B8935A" style="background-color:#B8935A;"></td>
          <td style="padding:2px 0 2px 16px;">
            <p style="font-size:14px;font-weight:bold;color:#1F2937;margin:0 0 4px;">Envie fotos de documentos escaneados</p>
            <p style="font-size:13px;color:#475569;margin:0;">Não precisa ser PDF perfeito — o Augusto lê imagens direto.</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
        <tr>
          <td width="3" bgcolor="#B8935A" style="background-color:#B8935A;"></td>
          <td style="padding:2px 0 2px 16px;">
            <p style="font-size:14px;font-weight:bold;color:#1F2937;margin:0 0 4px;">Volte às conversas antigas</p>
            <p style="font-size:13px;color:#475569;margin:0;">O histórico guarda o contexto — você não precisa reexplicar o caso.</p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0;">
        <tr><td align="center" bgcolor="#B8935A" style="background-color:#B8935A;border-radius:4px;">
          <a href="${link_dashboard}" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Explorar agora</a>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" bgcolor="#F4F3F2" style="background-color:#F4F3F2;padding:20px 40px;border-top:1px solid #E4E1D8;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#475569;margin:0;">Augusto.IJ Tecnologia LTDA</p>
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