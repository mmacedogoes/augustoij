import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  getRetencoesDoContrato,
  type RetencaoAplicavel,
} from "@/lib/contratos-servico/checklists.functions";

export function RetencoesCard({ contratoId }: { contratoId: string }) {
  const fn = useServerFn(getRetencoesDoContrato);
  const [rows, setRows] = useState<RetencaoAplicavel[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    fn({ data: { contratoId } })
      .then((r) => {
        if (!vivo) return;
        setRows(r.rows);
      })
      .catch((e: Error) => {
        if (!vivo) return;
        setErro(e.message);
        toast.error(e.message);
      });
    return () => {
      vivo = false;
    };
  }, [fn, contratoId]);

  return (
    <Card className="app-card p-4 mb-6">
      <div className="mb-3">
        <h3 className="text-lg font-serif text-primary">Retenções aplicáveis</h3>
        <p className="text-xs text-muted-foreground">
          Sinalização automática com base no tipo do serviço e na terceirização de mão de obra.
        </p>
      </div>
      {rows === null && !erro ? (
        <p className="text-sm text-muted-foreground">Carregando retenções…</p>
      ) : erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : rows && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma retenção sinalizada para este contrato.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows!.map((r) => (
            <li key={r.slug} className="rounded-md border border-border/60 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{r.nome}</p>
                {r.aliquota_referencia ? (
                  <span className="text-xs text-muted-foreground">{r.aliquota_referencia}</span>
                ) : null}
              </div>
              {r.base_legal ? (
                <p className="text-xs text-muted-foreground mt-1">{r.base_legal}</p>
              ) : null}
              {r.descricao ? (
                <p className="text-sm mt-2 text-foreground/90">{r.descricao}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground mt-4 border-t border-border/60 pt-2">
        Sinalização informativa. Confirme o tratamento tributário com a assessoria contábil do
        condomínio.
      </p>
    </Card>
  );
}