import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  listAuditoriaContrato, type LinhaAuditoria,
} from "@/lib/contratos-servico/auditoria.functions";

const PAGE = 20;

function fmtDT(iso: string): string {
  try { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }); }
  catch { return iso; }
}

type Grouped = LinhaAuditoria & { checklistCount?: number };

function agruparChecklist(rows: LinhaAuditoria[]): Grouped[] {
  // Agrupa marcações de checklist do mesmo contexto por dia+descrição base
  // em uma única linha resumida.
  const out: Grouped[] = [];
  const buckets = new Map<string, { first: LinhaAuditoria; count: number }>();
  for (const r of rows) {
    if (r.acao !== "checklist.marcar") { out.push(r); continue; }
    // Chave: dia + prefixo da descrição (checklist + período).
    const dia = r.created_at.slice(0, 10);
    const chave = `${dia}|${(r.descricao ?? "").slice(0, 60)}|${r.user_id ?? ""}`;
    const b = buckets.get(chave);
    if (b) { b.count += 1; }
    else { buckets.set(chave, { first: r, count: 1 }); }
  }
  for (const { first, count } of buckets.values()) {
    out.push({
      ...first,
      descricao: count > 1
        ? `${first.descricao} — ${count} itens verificados no dia.`
        : first.descricao,
      checklistCount: count,
    });
  }
  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out;
}

export function AtividadesPanel({ contratoId }: { contratoId: string }) {
  const listFn = useServerFn(listAuditoriaContrato);
  const [rows, setRows] = useState<LinhaAuditoria[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback((reset: boolean) => {
    setCarregando(true);
    setErro(null);
    const off = reset ? 0 : offset;
    listFn({ data: { contratoId, limit: PAGE, offset: off } })
      .then((r) => {
        const novos = r.rows as LinhaAuditoria[];
        setRows((prev) => reset || !prev ? novos : [...prev, ...novos]);
        setHasMore(novos.length === PAGE);
        setOffset(off + novos.length);
      })
      .catch((e: Error) => { setErro(e.message); toast.error(e.message); })
      .finally(() => setCarregando(false));
  }, [listFn, contratoId, offset]);

  useEffect(() => {
    carregar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  return (
    <Card className="app-card p-4">
      <div className="mb-4">
        <h3 className="text-lg font-serif text-primary">Atividades</h3>
        <p className="text-sm text-muted-foreground">
          Linha do tempo das ações realizadas neste contrato.
        </p>
      </div>

      {erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : rows === null ? (
        <div className="space-y-2">
          <div className="h-10 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-10 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-10 rounded-md bg-muted/50 animate-pulse" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há atividades registradas para este contrato.
        </p>
      ) : (
        <>
          <ol className="relative border-l border-border pl-4 space-y-4">
            {agruparChecklist(rows).map((r) => (
              <li key={r.id} className="ml-1">
                <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary/70 border border-background" />
                <p className="text-sm text-foreground break-words">{r.descricao}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtDT(r.created_at)} · {r.autor_nome ?? r.autor_email ?? "sistema"}
                </p>
              </li>
            ))}
          </ol>
          {hasMore && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => carregar(false)} disabled={carregando}>
                {carregando ? "Carregando…" : "Ver mais"}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}