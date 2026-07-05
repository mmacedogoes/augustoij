import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
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
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = (await next()) as { response?: Response } & Record<string, unknown>;
  const response = result?.response;
  if (response && response.headers) {
    if (!response.headers.has("strict-transport-security"))
      response.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    if (!response.headers.has("x-content-type-options"))
      response.headers.set("x-content-type-options", "nosniff");
    if (!response.headers.has("x-frame-options"))
      response.headers.set("x-frame-options", "DENY");
    if (!response.headers.has("referrer-policy"))
      response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    if (!response.headers.has("permissions-policy"))
      response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
}));
