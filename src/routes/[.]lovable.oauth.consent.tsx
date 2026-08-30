/**
 * Tela de consentimento OAuth: aprova ou nega o acesso de um cliente externo
 * (ChatGPT, Claude, Lovable) às ferramentas MCP do Augusto.IJ, agindo como o
 * usuário conectado.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AugustoLogo } from "@/components/brand/AugustoLogo";

type OAuthDetalhes = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResposta = { data: OAuthDetalhes | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResposta>;
  approveAuthorization: (id: string) => Promise<OAuthResposta>;
  denyAuthorization: (id: string) => Promise<OAuthResposta>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // O cliente Supabase lê a sessão do localStorage — inexistente no SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Autorização inválida (authorization_id ausente).");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ href: `/login?next=${encodeURIComponent(next)}` });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) throw redirect({ href: imediato });
    return data;
  },
  component: Consentimento,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-serif">Não foi possível carregar a autorização</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consentimento() {
  const detalhes = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cliente = detalhes?.client?.name ?? "o aplicativo";

  async function decidir(aprovar: boolean) {
    setOcupado(true);
    setErro(null);
    const api = oauthApi();
    const { data, error } = aprovar
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setOcupado(false);
      setErro(error.message);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setOcupado(false);
      setErro("O servidor de autorização não devolveu um destino de retorno.");
      return;
    }
    window.location.href = destino;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[440px] text-center">
        <div className="flex justify-center mb-8">
          <AugustoLogo variant="stacked" theme="light" size={200} />
        </div>
        <h1 className="text-2xl font-serif font-medium tracking-tight">
          Conectar {cliente} à sua conta
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {cliente} poderá consultar seus condomínios, unidades, documentos, contratos e assembleias
          no Augusto.IJ com as mesmas permissões que você tem hoje. Você pode revogar o acesso a
          qualquer momento.
        </p>
        {erro && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {erro}
          </p>
        )}
        <div className="mt-8 flex gap-3">
          <Button variant="outline" className="flex-1" disabled={ocupado} onClick={() => decidir(false)}>
            Recusar
          </Button>
          <Button className="flex-1" disabled={ocupado} onClick={() => decidir(true)}>
            {ocupado ? "Processando…" : "Autorizar"}
          </Button>
        </div>
      </div>
    </main>
  );
}
