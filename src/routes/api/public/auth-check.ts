import { createFileRoute } from "@tanstack/react-router";

// Limita tentativas de login/cadastro por IP: 5 tentativas por minuto,
// bloqueio de 15 minutos após exceder. Chamado ANTES de supabase.auth.*
// no cliente pelas telas de login e signup.
const LIMITE = 5;
const JANELA_MS = 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;
const MENSAGEM = "Muitas tentativas. Aguarde 15 minutos e tente novamente.";

function ipFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip");
  if (!xff) return "unknown";
  return xff.split(",")[0]?.trim() || "unknown";
}

export const Route = createFileRoute("/api/public/auth-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { kind?: string } = {};
        try { body = await request.json(); } catch { /* body opcional */ }
        const kind = body.kind === "signup" ? "signup" : "login";
        const ip = ipFromRequest(request);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const agora = new Date();

        const { data: linha } = await supabaseAdmin
          .from("auth_rate_limits")
          .select("tentativas, janela_inicio, bloqueado_ate")
          .eq("ip", ip)
          .eq("kind", kind)
          .maybeSingle();

        if (linha?.bloqueado_ate && new Date(linha.bloqueado_ate) > agora) {
          return Response.json({ ok: false, message: MENSAGEM }, { status: 429 });
        }

        const janelaInicio = linha?.janela_inicio ? new Date(linha.janela_inicio) : agora;
        const dentroDaJanela = agora.getTime() - janelaInicio.getTime() < JANELA_MS;
        const tentativas = dentroDaJanela ? (linha?.tentativas ?? 0) + 1 : 1;
        const novoInicio = dentroDaJanela ? janelaInicio : agora;
        const excedeu = tentativas > LIMITE;

        await supabaseAdmin.from("auth_rate_limits").upsert({
          ip,
          kind,
          tentativas: excedeu ? 0 : tentativas,
          janela_inicio: (excedeu ? agora : novoInicio).toISOString(),
          bloqueado_ate: excedeu ? new Date(agora.getTime() + BLOQUEIO_MS).toISOString() : null,
        });

        if (excedeu) {
          return Response.json({ ok: false, message: MENSAGEM }, { status: 429 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});