import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = /^audio\/(webm|mp4|mpeg|mp3|wav|x-wav|ogg|m4a|aac|flac)($|;)/i;

export const Route = createFileRoute("/api/voz/transcrever")({
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

          // Auth: precisa de sessão Supabase válida
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

          // Multipart parse
          const ctype = request.headers.get("content-type") ?? "";
          if (!ctype.toLowerCase().includes("multipart/form-data")) {
            return Response.json(
              { error: "Envio inválido (esperado multipart/form-data)." },
              { status: 400 },
            );
          }
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File) || file.size === 0) {
            return Response.json(
              { error: "Nenhum áudio recebido." },
              { status: 400 },
            );
          }
          if (file.size > MAX_BYTES) {
            return Response.json(
              { error: "Áudio muito grande (máx. 10 MB)." },
              { status: 413 },
            );
          }
          if (file.size < 2048) {
            return Response.json(
              { error: "Gravação vazia. Tente novamente." },
              { status: 400 },
            );
          }
          if (file.type && !ALLOWED_MIME.test(file.type)) {
            return Response.json(
              { error: "Formato de áudio não suportado." },
              { status: 400 },
            );
          }

          // Encaminha ao Lovable AI Gateway
          const upstream = new FormData();
          upstream.append("model", "openai/gpt-4o-mini-transcribe");
          upstream.append("language", "pt");
          upstream.append("file", file, file.name || "gravacao.webm");

          const res = await fetch(
            "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}` },
              body: upstream,
            },
          );

          if (res.status === 429) {
            return Response.json(
              { error: "Muitas solicitações. Aguarde e tente de novo." },
              { status: 429 },
            );
          }
          if (res.status === 402) {
            return Response.json(
              { error: "Créditos de IA esgotados no momento." },
              { status: 402 },
            );
          }
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error("[voz/transcrever] gateway error", res.status, body);
            return Response.json(
              { error: "Falha ao transcrever o áudio." },
              { status: 502 },
            );
          }

          const json = (await res.json()) as { text?: string };
          const text = (json.text ?? "").trim();
          if (!text) {
            return Response.json(
              { error: "Não consegui entender o áudio. Fale de novo, por favor." },
              { status: 422 },
            );
          }
          return Response.json({ text });
        } catch (err) {
          console.error("[voz/transcrever] erro", err);
          return Response.json(
            { error: "Erro inesperado ao transcrever." },
            { status: 500 },
          );
        }
      },
    },
  },
});