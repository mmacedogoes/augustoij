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
import { Trash2, Plus, Loader2, Sparkles, AlertCircle } from "lucide-react";

export type UnidadeSugerida = {
  bloco: string | null;
  numero: string;
  tipo?: string;
  fracao_ideal: number | null;
  area_m2: number | null;
  vagas_garagem?: number;
};

type Linha = {
  bloco: string;
  numero: string;
  tipo: string;
  fracao_ideal: string;
  area_m2: string;
  vagas_garagem: string;
};

function toLinha(u: UnidadeSugerida): Linha {
  return {
    bloco: u.bloco ?? "",
    numero: u.numero ?? "",
    tipo: u.tipo ?? "apartamento",
    fracao_ideal: u.fracao_ideal != null ? String(u.fracao_ideal) : "",
    area_m2: u.area_m2 != null ? String(u.area_m2) : "",
    vagas_garagem: String(u.vagas_garagem ?? 0),
  };
}

export function RevisarUnidadesDialog({
  sugestoes,
  existentes = [],
  vocab = { bloco: "Bloco", numero: "Número", unidade: "Unidade", tipoPadrao: "apartamento" },
  qtdMaxima = null,
  onClose,
  onConfirmar,
}: {
  sugestoes: UnidadeSugerida[];
  existentes?: { bloco: string | null; numero: string }[];
  vocab?: {
    bloco: string;
    numero: string;
    unidade: string;
    tipoPadrao:
      | "apartamento"
      | "casa"
      | "lote"
      | "terreno"
      | "sala_comercial"
      | "loja"
      | "galpao"
      | "outro";
  };
  qtdMaxima?: number | null;
  onClose: () => void;
  onConfirmar: (
    linhas: Record<string, unknown>[],
    estrategia: "manter" | "substituir",
  ) => Promise<void>;
}) {
  const tipoPadrao = vocab.tipoPadrao;
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    const parseNum = (s: string | null | undefined) => {
      const m = String(s ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
    };
    return sugestoes
      .map((s) => toLinha({ ...s, tipo: s.tipo ?? tipoPadrao }))
      .sort((a, b) => {
        const ba = String(a.bloco ?? "");
        const bb = String(b.bloco ?? "");
        if (ba !== bb) return ba.localeCompare(bb, "pt-BR", { numeric: true });
        const na = parseNum(a.numero);
        const nb = parseNum(b.numero);
        if (na !== nb) return na - nb;
        return String(a.numero ?? "").localeCompare(String(b.numero ?? ""), "pt-BR", { numeric: true });
      });
  });
  const [saving, setSaving] = useState(false);
  const [estrategia, setEstrategia] = useState<"manter" | "substituir">("manter");

  const chaveExistentes = new Set(
    existentes.map((e) => `${(e.bloco ?? "").trim().toLowerCase()}::${e.numero.trim()}`),
  );
  const conflitos = linhas.filter((l) =>
    chaveExistentes.has(`${l.bloco.trim().toLowerCase()}::${l.numero.trim()}`),
  ).length;
  const totalValidas = linhas.filter((l) => l.numero.trim().length > 0).length;
  // Só bloqueia se a convenção declarar um total explícito (> 0).
  // qtdMaxima null ou 0 = "não informado no cadastro" → sem limite.
  const excedeConvencao =
    qtdMaxima != null &&
    qtdMaxima > 0 &&
    totalValidas - conflitos + existentes.length > qtdMaxima;

  function update(i: number, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    setLinhas((prev) => [
      ...prev,
      { bloco: "", numero: "", tipo: tipoPadrao, fracao_ideal: "", area_m2: "", vagas_garagem: "0" },
    ]);
  }

  async function confirmar() {
    const validas = linhas.filter((l) => l.numero.trim().length > 0);
    if (validas.length === 0) {
      toast.error("Adicione ao menos uma unidade com número.");
      return;
    }
    setSaving(true);
    try {
      await onConfirmar(
        validas.map((l) => ({
          bloco: l.bloco.trim() || null,
          numero: l.numero.trim(),
          tipo_unidade: l.tipo,
          fracao_ideal: l.fracao_ideal ? Number(l.fracao_ideal.replace(",", ".")) : null,
          area_m2: l.area_m2 ? Number(l.area_m2.replace(",", ".")) : null,
          vagas_garagem: Number(l.vagas_garagem || 0),
        })),
        estrategia,
      );
    } catch (e) {
      console.error("[RevisarUnidades] falhou", e);
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Revisar unidades extraídas da convenção
          </DialogTitle>
          <DialogDescription>
            A IA identificou {sugestoes.length} {vocab.unidade.toLowerCase()}(s). Confira, edite ou
            remova antes de importar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[80px_100px_140px_120px_100px_80px_40px] gap-2 pb-2 text-xs font-medium text-muted-foreground border-b sticky top-0 bg-background z-10">
              <span>{vocab.bloco}</span>
              <span>{vocab.numero}*</span>
              <span>Tipo</span>
              <span>Fração ideal</span>
              <span>Área m²</span>
              <span>Vagas</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--landing-rule)]">
              {linhas.map((l, i) => (
                <div key={i} className="grid grid-cols-[80px_100px_140px_120px_100px_80px_40px] gap-2 py-2 items-center">
                  <Input value={l.bloco} onChange={(e) => update(i, { bloco: e.target.value })} className="h-9" />
                  <Input value={l.numero} onChange={(e) => update(i, { numero: e.target.value })} className="h-9" />
                  <select
                    value={l.tipo}
                    onChange={(e) => update(i, { tipo: e.target.value })}
                    className="h-9 border rounded-md px-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  >
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                    <option value="lote">Lote</option>
                    <option value="terreno">Terreno</option>
                    <option value="sala_comercial">Sala comercial</option>
                    <option value="loja">Loja</option>
                    <option value="galpao">Galpão</option>
                    <option value="vaga_avulsa">Vaga avulsa</option>
                    <option value="outro">Outro</option>
                  </select>
                  <Input
                    value={l.fracao_ideal}
                    onChange={(e) => update(i, { fracao_ideal: e.target.value })}
                    className={`h-9 ${l.fracao_ideal ? "" : "border-destructive/60 bg-destructive/5"}`}
                    placeholder="não identificada"
                    title={l.fracao_ideal ? undefined : "Fração ideal não identificada na convenção — preencha manualmente."}
                  />
                  <Input
                    value={l.area_m2}
                    onChange={(e) => update(i, { area_m2: e.target.value })}
                    className={`h-9 ${l.area_m2 ? "" : "border-destructive/60 bg-destructive/5"}`}
                    placeholder="não identificada"
                    title={l.area_m2 ? undefined : "Área não identificada na convenção — preencha manualmente."}
                  />
                  <Input type="number" min={0} value={l.vagas_garagem} onChange={(e) => update(i, { vagas_garagem: e.target.value })} className="h-9" />
                  <Button size="icon" variant="ghost" onClick={() => remove(i)} className="text-red-500 hover:text-red-600 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {linhas.map((l, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {vocab.unidade} #{i + 1}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{vocab.bloco}</Label>
                    <Input value={l.bloco} onChange={(e) => update(i, { bloco: e.target.value })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">{vocab.numero}*</Label>
                    <Input value={l.numero} onChange={(e) => update(i, { numero: e.target.value })} className="h-9" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      value={l.tipo}
                      onChange={(e) => update(i, { tipo: e.target.value })}
                      className="w-full h-9 border rounded-md px-2 text-sm bg-background"
                    >
                      <option value="apartamento">Apartamento</option>
                      <option value="casa">Casa</option>
                      <option value="lote">Lote</option>
                      <option value="terreno">Terreno</option>
                      <option value="sala_comercial">Sala comercial</option>
                      <option value="loja">Loja</option>
                      <option value="galpao">Galpão</option>
                      <option value="vaga_avulsa">Vaga avulsa</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Fração</Label>
                    <Input value={l.fracao_ideal} onChange={(e) => update(i, { fracao_ideal: e.target.value })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Área m²</Label>
                    <Input value={l.area_m2} onChange={(e) => update(i, { area_m2: e.target.value })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Vagas</Label>
                    <Input type="number" min={0} value={l.vagas_garagem} onChange={(e) => update(i, { vagas_garagem: e.target.value })} className="h-9" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={add} className="mt-3 transition-colors">
            <Plus className="h-4 w-4 mr-1" /> Adicionar {vocab.unidade.toLowerCase()}
          </Button>
        </div>

        <div className="border-t pt-4 space-y-3">
          {(conflitos > 0 || excedeConvencao) && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              {conflitos > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {conflitos} {vocab.unidade.toLowerCase()}(s) já existem
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Escolha como tratar as duplicatas antes de importar.
                    </p>
                    <div className="mt-2 inline-flex rounded-md border overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => setEstrategia("manter")}
                        className={`px-3 py-1.5 transition-colors ${
                          estrategia === "manter"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        Manter existentes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstrategia("substituir")}
                        className={`px-3 py-1.5 border-l transition-colors ${
                          estrategia === "substituir"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        Substituir pelos da convenção
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {excedeConvencao && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  A convenção prevê {qtdMaxima} {vocab.unidade.toLowerCase()}(s). Você está
                  tentando cadastrar mais que isso — ajuste as linhas ou o total no cadastro do
                  condomínio.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="p-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
            <Button
              onClick={confirmar}
              disabled={saving || linhas.length === 0 || excedeConvencao}
              className="transition-all"
            >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
              </>
            ) : (
                `Importar ${totalValidas} ${vocab.unidade.toLowerCase()}(s)`
            )}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
