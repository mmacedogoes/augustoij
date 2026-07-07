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
import { Trash2, Plus, Loader2, Sparkles } from "lucide-react";

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
  onClose,
  onConfirmar,
}: {
  sugestoes: UnidadeSugerida[];
  onClose: () => void;
  onConfirmar: (linhas: Record<string, unknown>[]) => Promise<void>;
}) {
  const [linhas, setLinhas] = useState<Linha[]>(sugestoes.map(toLinha));
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    setLinhas((prev) => [
      ...prev,
      { bloco: "", numero: "", tipo: "apartamento", fracao_ideal: "", area_m2: "", vagas_garagem: "0" },
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
            A IA identificou {sugestoes.length} unidade(s). Confira, edite ou remova antes de importar.
            Unidades já cadastradas com mesmo bloco+número serão preservadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[80px_100px_140px_120px_100px_80px_40px] gap-2 pb-2 text-xs font-medium text-muted-foreground border-b sticky top-0 bg-background z-10">
              <span>Bloco</span>
              <span>Número*</span>
              <span>Tipo</span>
              <span>Fração ideal</span>
              <span>Área m²</span>
              <span>Vagas</span>
              <span />
            </div>
            <div className="divide-y">
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
                    <option value="sala_comercial">Sala comercial</option>
                    <option value="loja">Loja</option>
                    <option value="vaga_avulsa">Vaga avulsa</option>
                    <option value="outro">Outro</option>
                  </select>
                  <Input value={l.fracao_ideal} onChange={(e) => update(i, { fracao_ideal: e.target.value })} className="h-9" placeholder="0.01" />
                  <Input value={l.area_m2} onChange={(e) => update(i, { area_m2: e.target.value })} className="h-9" placeholder="75.5" />
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
                  <span className="text-xs text-muted-foreground">Unidade #{i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Bloco</Label>
                    <Input value={l.bloco} onChange={(e) => update(i, { bloco: e.target.value })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Número*</Label>
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
                      <option value="sala_comercial">Sala comercial</option>
                      <option value="loja">Loja</option>
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
            <Plus className="h-4 w-4 mr-1" /> Adicionar linha
          </Button>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={saving || linhas.length === 0} className="transition-all">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
              </>
            ) : (
              `Importar ${linhas.filter((l) => l.numero.trim()).length} unidade(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
