import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Voz única do Augusto — decidida no servidor. O front nunca escolhe.
const AUGUSTO_VOICE = "onyx";
const MAX_CHARS = 4000;

const Body = z.object({
  text: z.string().trim().min(1).max(MAX_CHARS),
});

export const Route = createFileRoute("/api/voz/falar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          const supaUrl = process.env.SUPABASE_URL;
          const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!apiKey || !supaUrl || !supaKey) {
            return Response.json(
              { error: "Serviço de voz indisponível." },
              { status: 500 },
            );
          }

          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
          if (!token) {
            return Response.json({ error: "Não autenticado." }, { status: 401 });
          }
          const supabase = createClient<Database>(supaUrl, supaKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: userRes, error: authErr } = await supabase.auth.getUser();
          if (authErr || !userRes?.user) {
            return Response.json({ error: "Sessão inválida." }, { status: 401 });
          }

          let payload: z.infer<typeof Body>;
          try {
            payload = Body.parse(await request.json());
          } catch {
            return Response.json(
              { error: `Texto inválido (1 a ${MAX_CHARS} caracteres).` },
              { status: 400 },
            );
          }

          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: payload.text,
              voice: AUGUSTO_VOICE,
              stream_format: "sse",
              response_format: "pcm",
            }),
          });

          if (res.status === 429) {
            return Response.json(
              { error: "Muitas solicitações. Aguarde e tente novamente." },
              { status: 429 },
            );
          }
          if (res.status === 402) {
            return Response.json(
              { error: "Créditos de IA esgotados no momento." },
              { status: 402 },
            );
          }
          if (!res.ok || !res.body) {
            const body = await res.text().catch(() => "");
            console.error("[voz/falar] gateway error", res.status, body);
            return Response.json(
              { error: "Falha ao gerar a fala." },
              { status: 502 },
            );
          }

          return new Response(res.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache, no-transform",
            },
          });
        } catch (err) {
          console.error("[voz/falar] erro", err);
          return Response.json(
            { error: "Erro inesperado ao gerar fala." },
            { status: 500 },
          );
        }
      },
    },
  },
});