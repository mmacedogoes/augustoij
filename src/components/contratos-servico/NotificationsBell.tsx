import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  contarNaoLidas,
  listNotificacoes,
  marcarNotificacaoLida,
  marcarTodasLidas,
  type NotificacaoLinha,
} from "@/lib/contratos-servico/notificacoes.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const POLL_MS = 60_000;

export function NotificationsBell() {
  const contarFn = useServerFn(contarNaoLidas);
  const listarFn = useServerFn(listNotificacoes);
  const marcarUmaFn = useServerFn(marcarNotificacaoLida);
  const marcarTodasFn = useServerFn(marcarTodasLidas);
  const navigate = useNavigate();

  const [count, setCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificacaoLinha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const r = await contarFn();
      setCount(r.count);
    } catch {
      /* contador silencioso */
    }
  }, [contarFn]);

  useEffect(() => {
    void refreshCount();
    timerRef.current = setInterval(refreshCount, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshCount]);

  const abrirPainel = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarFn({ data: { limit: 20 } });
      setRows(r.rows);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar notificações.");
    } finally {
      setCarregando(false);
    }
  }, [listarFn]);

  useEffect(() => {
    if (open) void abrirPainel();
  }, [open, abrirPainel]);

  async function handleClick(n: NotificacaoLinha) {
    try {
      if (!n.lida_em) {
        await marcarUmaFn({ data: { id: n.id } });
        setRows((prev) => prev?.map((r) => (r.id === n.id ? { ...r, lida_em: new Date().toISOString() } : r)) ?? null);
        setCount((c) => Math.max(0, c - 1));
      }
      setOpen(false);
      if (n.url_destino) {
        // navigate expects typed paths — url_destino é um path interno; cast controlado.
        navigate({ to: n.url_destino as never });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar como lida.");
    }
  }

  async function handleMarcarTodas() {
    try {
      await marcarTodasFn();
      setRows((prev) => prev?.map((r) => ({ ...r, lida_em: r.lida_em ?? new Date().toISOString() })) ?? null);
      setCount(0);
      toast.success("Todas as notificações marcadas como lidas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notificações${count > 0 ? ` (${count} não lidas)` : ""}`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70"
        >
          <Bell className="h-4 w-4" strokeWidth={1.6} />
          {count > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-augusto-gold px-1 text-[10px] font-semibold text-primary-foreground leading-none">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notificações</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={handleMarcarTodas}
            disabled={count === 0}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {carregando && rows === null ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
            </div>
          ) : erro ? (
            <p className="p-4 text-sm text-destructive">{erro}</p>
          ) : !rows || rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
          ) : (
            <ul className="divide-y divide-[var(--landing-rule)]">
              {rows.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-accent/70 transition-colors ${n.lida_em ? "opacity-70" : "bg-augusto-gold/5"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 rounded-full ${n.lida_em ? "" : "bg-augusto-gold"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{n.titulo}</p>
                        {n.mensagem ? (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.mensagem}</p>
                        ) : null}
                        <p className="text-[11px] text-muted-foreground mt-1">{tempoRelativo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function tempoRelativo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}