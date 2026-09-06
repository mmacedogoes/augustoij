import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

/**
 * Substitui o `attachSupabaseAuth` gerado: em vez de ler a sessão uma única vez
 * (que pode estar `null` durante a hidratação ou enquanto o token é renovado),
 * aguarda brevemente a sessão ficar disponível antes de enviar a chamada.
 */
async function obterToken(): Promise<string | null> {
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return token;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

export const attachSupabaseAuthResiliente = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await obterToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
