import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CookieBanner } from "@/components/CookieBanner";
import { Toaster } from "@/components/ui/sonner";
import { hydrateEphemeralSession, initRememberMode, clearRememberMode } from "@/lib/remember-session";

// Restaura sessão efêmera do sessionStorage antes do supabase-js ler o localStorage.
if (typeof window !== "undefined") {
  hydrateEphemeralSession();
}
// favicon agora servido de /public (Augusto.IJ aqueduto)

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Augusto.IJ - Inteligência jurídica para condomínios" },
      { name: "description", content: "Plataforma de IA com apoio jurídico, gestão de documentos e respostas instantâneas para o dia a dia do seu condomínio." },
      { name: "author", content: "Augusto.IJ" },
      { property: "og:title", content: "Augusto.IJ - Inteligência jurídica para condomínios" },
      { property: "og:description", content: "Plataforma de IA com apoio jurídico, gestão de documentos e respostas instantâneas para o dia a dia do seu condomínio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Augusto.IJ - Inteligência jurídica para condomínios" },
      { name: "twitter:description", content: "Plataforma de IA com apoio jurídico, gestão de documentos e respostas instantâneas para o dia a dia do seu condomínio." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/peaHobTmBThQRYs65lAUOWelobt1/social-images/social-1782920437425-TgfKNX6a.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/peaHobTmBThQRYs65lAUOWelobt1/social-images/social-1782920437425-TgfKNX6a.webp" },
      { name: "google-site-verification", content: "PtMOpJOxdrXUGWdA5jmJwaO9ZktiiZG8OOh3srsYxfU" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "alternate icon", type: "image/png", href: "/favicon-256.png" },
      { rel: "apple-touch-icon", href: "/favicon-256.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    initRememberMode();
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (!mounted) return;
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        if (event === "SIGNED_OUT") clearRememberMode();
        // Após login (inclui retorno full-page do Google OAuth), leva o usuário
        // para a área logada se ele estiver numa rota pública de autenticação.
        if (event === "SIGNED_IN" && typeof window !== "undefined") {
          const p = window.location.pathname;
          if (p === "/" || p === "/login" || p === "/signup") {
            router.navigate({ to: "/app" });
          }
        }
      });
      (window as unknown as { __supabaseSub?: { unsubscribe: () => void } }).__supabaseSub = sub.subscription;
    });
    return () => {
      mounted = false;
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <CookieBanner />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
