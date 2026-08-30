import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Ruler, AlertTriangle, CheckCircle2 } from "lucide-react";

import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  visaoGeralUnidades,
  auditarCondominio,
  type ResultadoAuditoria,
} from "@/lib/unidades-auditoria.functions";

export const Route = createFileRoute("/_authenticated/app/admin/unidades")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Auditoria de unidades | Augusto IJ" },
      {
        name: "description",
        content:
          "Confira o cadastro de unidades de cada condomínio contra a convenção: quantidade, áreas e frações ideais.",
      },
      { property: "og:title", content: "Auditoria de unidades | Augusto IJ" },
      {
        property: "og:description",
        content:
          "Auditoria administrativa de unidades, áreas e frações ideais frente à convenção do condomínio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Linha = {
  id: string;
  nome: string;
  declarado: number | null;
  cadastradas: number;
  semFracao: number;
  semArea: number;
  somaFracoes: number | null;
  temConvencao: boolean;
};

function Page() {
  const listFn = useServerFn(visaoGeralUnidades);
  const auditFn = useServerFn(auditarCondominio);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [rodando, setRodando] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoAuditoria>>({});

  function reload() {
    setLoading(true);
    listFn()
      .then((r) => setLinhas(r as Linha[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar"))
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function auditar(id: string) {
    setRodando(id);
    try {
      const r = (await auditFn({
        data: { condominioId: id, aplicar: true },
      })) as ResultadoAuditoria;
      setResultados((prev) => ({ ...prev, [id]: r }));
      if (r.status === "corrigido") {
        toast.success(
          `${r.criadas} unidade(s) criada(s), ${r.fracoesPreenchidas} fração(ões) e ${r.areasPreenchidas} área(s) preenchidas.`,
        );
        reload();
      } else if (r.status === "ok") {
        toast.success("Cadastro conforme a convenção.");
      } else {
        toast.warning(r.mensagem ?? "Auditoria concluída com pendências.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na auditoria");
    } finally {
      setRodando(null);
    }
  }

  return (
    <>
      <div className="max-w-6xl">
        <AdminNav />
        <header className="mt-6 mb-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" /> Auditoria de unidades
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compara o cadastro com a convenção. Só preenche campos vazios e cria unidades
            faltantes — nunca sobrescreve nem apaga dados já informados pelos usuários.
          </p>
        </header>

        {loading ? (
          <Card className="app-card p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" /> Carregando condomínios…
          </Card>
        ) : (
          <div className="space-y-3">
            {linhas.map((l) => {
              const r = resultados[l.id];
              return (
                <Card key={l.id} className="app-card p-4">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{l.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.cadastradas} cadastrada(s)
                        {l.declarado != null ? ` · ${l.declarado} declarada(s)` : ""} ·{" "}
                        {l.semFracao} sem fração · {l.semArea} sem área
                        {l.somaFracoes != null
                          ? ` · soma das frações ${l.somaFracoes}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!l.temConvencao && (
                        <Badge variant="outline" className="text-xs">
                          sem convenção
                        </Badge>
                      )}
                      {l.declarado != null && l.declarado !== l.cadastradas && (
                        <Badge variant="destructive" className="text-xs">
                          quantidade divergente
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!l.temConvencao || rodando === l.id}
                        onClick={() => auditar(l.id)}
                      >
                        {rodando === l.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Auditando…
                          </>
                        ) : (
                          "Auditar com a convenção"
                        )}
                      </Button>
                    </div>
                  </div>

                  {r && (
                    <div className="mt-3 rounded-md border p-3 text-xs space-y-2">
                      <p className="flex items-center gap-2 font-medium">
                        {r.status === "ok" || r.status === "corrigido" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        {r.mensagem ??
                          `Convenção: ${r.naConvencao ?? 0} unidade(s) · criadas ${r.criadas} · frações preenchidas ${r.fracoesPreenchidas} · áreas preenchidas ${r.areasPreenchidas}`}
                      </p>
                      {r.pendencias.length > 0 && (
                        <ul className="space-y-1 text-muted-foreground max-h-48 overflow-auto">
                          {r.pendencias.map((p, i) => (
                            <li key={i}>
                              <span className="font-medium text-foreground">{p.unidade}</span>{" "}
                              — {p.campo}: cadastro {p.cadastro} / convenção {p.convencao}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
