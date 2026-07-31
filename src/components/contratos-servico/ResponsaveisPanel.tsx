import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adicionarResponsavel,
  listResponsaveis,
  listUsuariosElegiveis,
  removerResponsavel,
  type ResponsavelLinha,
} from "@/lib/contratos-servico/responsaveis.functions";

type Usuario = { id: string; nome: string | null; email: string | null };

export function ResponsaveisPanel({ contratoId }: { contratoId: string }) {
  const listFn = useServerFn(listResponsaveis);
  const elegFn = useServerFn(listUsuariosElegiveis);
  const addFn = useServerFn(adicionarResponsavel);
  const delFn = useServerFn(removerResponsavel);

  const [rows, setRows] = useState<ResponsavelLinha[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selecionado, setSelecionado] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [r, u] = await Promise.all([
        listFn({ data: { contratoId } }),
        elegFn(),
      ]);
      setRows(r.rows);
      setUsuarios(u.rows);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar responsáveis.");
    } finally {
      setCarregando(false);
    }
  }, [listFn, elegFn, contratoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const jaResponsavel = new Set((rows ?? []).map((r) => r.user_id));
  const disponiveis = usuarios.filter((u) => !jaResponsavel.has(u.id));

  async function adicionar() {
    if (!selecionado) return;
    setSalvando(true);
    try {
      await addFn({ data: { contratoId, userId: selecionado } });
      toast.success("Responsável adicionado.");
      setSelecionado("");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(userId: string) {
    try {
      await delFn({ data: { contratoId, userId } });
      toast.success("Responsável removido.");
      setRows((prev) => (prev ? prev.filter((r) => r.user_id !== userId) : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-serif text-primary">Responsáveis</h3>
          <p className="text-xs text-muted-foreground">
            Recebem o e-mail diário com os avisos deste contrato. Sem responsáveis, o autor recebe.
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : (
        <>
          {rows && rows.length > 0 ? (
            <ul className="mb-3 divide-y divide-[var(--landing-rule)] rounded-md border border-border">
              {rows.map((r) => (
                <li key={r.user_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.nome ?? "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email ?? "—"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remover(r.user_id)}
                    aria-label={`Remover ${r.nome ?? r.email ?? "responsável"}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">
              Nenhum responsável designado. O autor do contrato receberá os avisos.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Select value={selecionado} onValueChange={setSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar usuário…" />
                </SelectTrigger>
                <SelectContent>
                  {disponiveis.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhum usuário disponível.
                    </div>
                  ) : (
                    disponiveis.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome ?? u.email ?? u.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={adicionar} disabled={!selecionado || salvando}>
              <UserPlus className="h-4 w-4 mr-1" />
              {salvando ? "Adicionando…" : "Adicionar"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}