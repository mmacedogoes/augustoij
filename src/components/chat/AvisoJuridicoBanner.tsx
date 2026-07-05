import { useEffect, useState } from "react";
import { ScrollText, X } from "lucide-react";

const SESSION_KEY = "augusto.aviso-juridico-visto";

export function AvisoJuridicoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) setVisible(true);
    } catch { /* ignore */ }
  }, []);

  const dispensar = () => {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="border-b border-border/60 bg-muted/40 transition-all duration-200">
      <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <ScrollText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" aria-hidden="true" />
        <p className="flex-1">
          As respostas do Augusto.IJ têm caráter informativo e não substituem a orientação de um
          advogado para casos concretos.
        </p>
        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar aviso"
          className="rounded-md p-1 text-muted-foreground/70 transition-colors duration-200 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default AvisoJuridicoBanner;