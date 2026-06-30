import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Lightbulb, X } from "lucide-react";
import { listDicas, setDicasAtivas } from "@/lib/condominios.functions";

type Dica = { id: string; texto: string; categoria: string; ordem: number };

const STORAGE = (uid: string) => `condoia.dicas_vistas.${uid}`;

export function DicasPopup({ userId, enabled }: { userId: string; enabled: boolean }) {
  const fetchDicas = useServerFn(listDicas);
  const persistAtivas = useServerFn(setDicasAtivas);
  const [dicas, setDicas] = useState<Dica[]>([]);
  const [idx, setIdx] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const [oculto, setOculto] = useState(!enabled);

  useEffect(() => {
    if (!enabled || oculto) return;
    fetchDicas()
      .then((r) => {
        const todas = (r as Dica[]) ?? [];
        if (todas.length === 0) return;
        let vistas: string[] = [];
        try {
          vistas = JSON.parse(localStorage.getItem(STORAGE(userId)) ?? "[]");
        } catch {
          vistas = [];
        }
        let disponiveis = todas.filter((d) => !vistas.includes(d.id));
        if (disponiveis.length === 0) {
          localStorage.removeItem(STORAGE(userId));
          disponiveis = todas;
        }
        setDicas(disponiveis);
      })
      .catch(() => {});
    const t = setTimeout(() => setVisivel(true), 3000);
    return () => clearTimeout(t);
  }, [enabled, oculto, userId, fetchDicas]);

  if (!enabled || oculto || !visivel || dicas.length === 0) return null;
  const dica = dicas[idx];

  function marcarVista(id: string) {
    try {
      const vistas: string[] = JSON.parse(localStorage.getItem(STORAGE(userId)) ?? "[]");
      if (!vistas.includes(id)) {
        vistas.push(id);
        localStorage.setItem(STORAGE(userId), JSON.stringify(vistas));
      }
    } catch {
      /* noop */
    }
  }

  function fechar() {
    marcarVista(dica.id);
    setVisivel(false);
  }

  function desabilitar() {
    setOculto(true);
    persistAtivas({ data: { ativas: false } }).catch(() => {});
  }

  function ant() {
    setIdx((i) => (i - 1 + dicas.length) % dicas.length);
  }
  function prox() {
    marcarVista(dica.id);
    setIdx((i) => (i + 1) % dicas.length);
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-[340px] bg-card border border-border shadow-md rounded-lg p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <Lightbulb className="h-4 w-4 text-emerald-500" />
          Dica rápida
        </div>
        <button
          onClick={fechar}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-muted-foreground leading-relaxed">{dica.texto}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={ant}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            {idx + 1}/{dicas.length}
          </span>
          <button
            onClick={prox}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Próxima"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={desabilitar}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Não mostrar dicas
        </button>
      </div>
    </div>
  );
}