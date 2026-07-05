import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "augusto.cookies-aceitos";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* localStorage indisponível */
    }
  }, []);

  const aceitar = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-all duration-200"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <p className="text-sm leading-relaxed text-foreground/90">
          Usamos cookies essenciais para o funcionamento da plataforma. Saiba mais em nossa{" "}
          <Link
            to="/privacidade"
            target="_blank"
            rel="noopener"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="flex items-center justify-end gap-2 sm:ml-auto">
          <Button size="sm" onClick={aceitar} className="min-w-[110px]">
            Entendido
          </Button>
          <button
            type="button"
            onClick={aceitar}
            aria-label="Fechar aviso"
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;