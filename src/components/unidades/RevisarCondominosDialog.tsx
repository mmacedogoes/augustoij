import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trash2, Loader2, Sparkles, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export type CondominoSugerido = {
  bloco: string | null;
  numero: string | null;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  tipo_condomino?: string;
  match_status?: "ok" | "ambiguo" | "sem_match";
};

export type UnidadeRef = { id: string; bloco: string | null; numero: string };

type Linha = CondominoSugerido & { destino: string /* "bloco|numero" ou "__nova__" */ };

function keyUnidade(bloco: string | null, numero: string) {
  return `${bloco ?? ""}|${numero}`;
}

export function RevisarCondominosDialog({
  sugestoes,
  unidades,
  onClose,
  onConfirmar,
}: {
  sugestoes: CondominoSugerido[];
  unidades: UnidadeRef[];
  onClose: () => void;
  onConfirmar: (linhas: Record<string, unknown>[]) => Promise<void>;
}) {
  const [linhas, setLinhas] = useState<Linha[]>(
    sugestoes.map((c) => ({
      ...c,
      destino:
        c.bloco != null || c.numero != null
          ? keyUnidade(c.bloco ?? null, c.numero ?? "")
          : "__nova__",
    })),
  );
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function confirmar() {
    const validas = linhas.filter((l) => l.nome.trim().length > 0);
    if (validas.length === 0) {
      toast.error("Nenhum condômino válido para importar.");
      return;
    }
    // toda linha precisa ter destino com número
    for (const l of validas) {
      if (l.destino === "__nova__" && !l.numero?.trim()) {
        toast.error(`"${l.nome}": informe o número da unidade nova.`);
        return;
      }
    }
    setSaving(true);
    try {
      await onConfirmar(
        validas.map((l) => {
          const [blk, num] =
            l.destino === "__nova__"
              ? [l.bloco ?? "", l.numero ?? ""]
              : l.destino.split("|");
          return {
            bloco: (blk || "").trim() || null,
            numero: (num || "").trim(),
            nome: l.nome.trim(),
            cpf: l.cpf?.trim() || null,
            email: l.email?.trim() || null,
            telefone: l.telefone?.trim() || null,
            tipo_condomino: l.tipo_condomino ?? "proprietario",
          };
        }),
      );
    } catch (e) {
      console.error("[RevisarCondominos] falhou", e);
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setSaving(false);
    }
  }

  const contagem = linhas.filter((l) => l.nome.trim()).length;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Revisar condôminos extraídos
          </DialogTitle>
          <DialogDescription>
            A IA identificou {sugestoes.length} condômino(s). Ajuste os dados e a unidade
            de destino antes de importar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
          {linhas.map((l, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <MatchBadge status={l.match_status} />
                <Input
                  value={l.nome}
                  onChange={(e) => update(i, { nome: e.target.value })}
                  className="flex-1 h-9 font-medium"
                  placeholder="Nome completo"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(i)}
                  className="h-8 w-8 text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-2">
                  <Label className="text-xs">Unidade destino</Label>
                  <select
                    value={l.destino}
                    onChange={(e) => update(i, { destino: e.target.value })}
                    className="w-full h-9 border rounded-md px-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {unidades.map((u) => {
                      const k = keyUnidade(u.bloco, u.numero);
                      return (
                        <option key={u.id} value={k}>
                          {u.bloco ? `Bloco ${u.bloco} • ` : ""}
                          {u.numero}
                        </option>
                      );
                    })}
                    <option value="__nova__">➕ Criar nova unidade</option>
                  </select>
                </div>
                {l.destino === "__nova__" && (
                  <>
                    <div>
                      <Label className="text-xs">Novo bloco</Label>
                      <Input
                        value={l.bloco ?? ""}
                        onChange={(e) => update(i, { bloco: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Novo número*</Label>
                      <Input
                        value={l.numero ?? ""}
                        onChange={(e) => update(i, { numero: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label className="text-xs">CPF</Label>
                  <Input
                    value={l.cpf ?? ""}
                    onChange={(e) => update(i, { cpf: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={l.telefone ?? ""}
                    onChange={(e) => update(i, { telefone: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    value={l.email ?? ""}
                    onChange={(e) => update(i, { email: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select
                    value={l.tipo_condomino ?? "proprietario"}
                    onChange={(e) => update(i, { tipo_condomino: e.target.value })}
                    className="w-full h-9 border rounded-md px-2 text-sm bg-background"
                  >
                    <option value="proprietario">Proprietário</option>
                    <option value="inquilino">Inquilino</option>
                    <option value="morador">Morador</option>
                    <option value="responsavel_legal">Responsável legal</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          {linhas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum condômino restante para importar.
            </p>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={saving || contagem === 0}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
              </>
            ) : (
              `Importar ${contagem} condômino(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchBadge({ status }: { status?: "ok" | "ambiguo" | "sem_match" }) {
  if (status === "ok")
    return (
      <span title="Casou com unidade existente" className="text-augusto-green">
        <CheckCircle2 className="h-4 w-4" />
      </span>
    );
  if (status === "ambiguo")
    return (
      <span title="Correspondência ambígua" className="text-amber-500">
        <AlertTriangle className="h-4 w-4" />
      </span>
    );
  return (
    <span title="Sem correspondência — criar nova unidade" className="text-muted-foreground">
      <XCircle className="h-4 w-4" />
    </span>
  );
}
