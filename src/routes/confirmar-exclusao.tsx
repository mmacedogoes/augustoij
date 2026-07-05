import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { confirmarExclusaoConta } from "@/lib/privacidade.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/confirmar-exclusao")({
  head: () => ({
    meta: [
      { title: "Confirmar exclusão de conta — Augusto.IJ" },
      { name: "description", content: "Confirme a exclusão da sua conta no Augusto.IJ." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (input) => searchSchema.parse(input),
  component: ConfirmarExclusaoPage,
});

type Estado =
  | { tipo: "aguardando" }
  | { tipo: "processando" }
  | { tipo: "sucesso"; ja: boolean }
  | { tipo: "erro"; mensagem: string };

function ConfirmarExclusaoPage() {
  const { token } = useSearch({ from: "/confirmar-exclusao" });
  const confirmar = useServerFn(confirmarExclusaoConta);
  const [estado, setEstado] = useState<Estado>({ tipo: "aguardando" });

  useEffect(() => {
    if (!token) {
      setEstado({ tipo: "erro", mensagem: "Link inválido ou incompleto." });
    }
  }, [token]);

  async function handleConfirmar() {
    if (!token) return;
    setEstado({ tipo: "processando" });
    try {
      const res = (await confirmar({ data: { token } })) as { ok: true; ja: boolean };
      await supabase.auth.signOut().catch(() => {});
      setEstado({ tipo: "sucesso", ja: res.ja });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível confirmar.";
      setEstado({ tipo: "erro", mensagem: msg });
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-lg">
        <Card className="p-6 sm:p-8 space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Confirmar exclusão de conta
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ao confirmar, sua conta será suspensa imediatamente e todos os dados,
              condomínios e histórico de conversas serão permanentemente excluídos em
              até 30 dias. Documentos enviados também serão removidos. Dados fiscais
              podem ser retidos pelo prazo legal.
            </p>
          </header>

          {estado.tipo === "aguardando" && (
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button
                variant="destructive"
                disabled={!token}
                onClick={handleConfirmar}
                className="sm:flex-1"
              >
                Confirmar exclusão
              </Button>
              <Button asChild variant="outline" className="sm:flex-1">
                <Link to="/">Cancelar</Link>
              </Button>
            </div>
          )}

          {estado.tipo === "processando" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Processando…
            </div>
          )}

          {estado.tipo === "sucesso" && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <p className="text-sm font-medium">
                  {estado.ja
                    ? "Este pedido já havia sido confirmado."
                    : "Exclusão confirmada."}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sua sessão foi encerrada. A exclusão definitiva ocorrerá em até 30 dias.
                Se mudar de ideia nesse prazo, entre em contato pelo e-mail{" "}
                <span className="font-medium text-foreground">privacidade@augusto.ij</span>.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/">Voltar para o início</Link>
              </Button>
            </div>
          )}

          {estado.tipo === "erro" && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Não foi possível confirmar</p>
              </div>
              <p className="text-xs text-muted-foreground">{estado.mensagem}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}