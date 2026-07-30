import { createStart, createMiddleware } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Adiciona headers de segurança a todas as respostas (SSR, server routes, server fns).
const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    setResponseHeaders({
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(self), geolocation=()",
      // COOP relax para permitir popup OAuth do Google/Lovable broker.
      "cross-origin-opener-policy": "same-origin-allow-popups",
      // CSP em modo de bloqueio. Se algum recurso legítimo for
      // bloqueado, adicione a origem exata ao diretivo correspondente —
      // NUNCA relaxe para `*` ou `'unsafe-eval'`.
      "content-security-policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://*.lovable.app https://*.lovable.dev https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovable.dev https://ai.gateway.lovable.dev https://api.asaas.com https://sandbox.asaas.com https://api-sandbox.asaas.com https://api.bcb.gov.br https://api.iconify.design",
        "frame-src 'self' https://sandbox.asaas.com https://www.asaas.com https://accounts.google.com",
        "media-src 'self' blob: data:",
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://sandbox.asaas.com https://www.asaas.com",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ].join("; "),
    } as unknown as Parameters<typeof setResponseHeaders>[0]);
  } catch {
    /* fora de contexto de requisição — ignora */
  }
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
}));
