import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { removeObrigacao, upsertObrigacao } from "@/lib/contratos-servico/contratos.functions";

export type Obrigacao = {
  id: string;
  parte: "condominio" | "prestador";
  descricao: string;
  periodicidade: "unica" | "mensal" | "trimestral" | "semestral" | "anual" | "por_evento";
  clausula_origem: string | null;
  ordem: number;
};

const PERIODICIDADES: Array<{ v: Obrigacao["periodicidade"]; label: string }> = [
  { v: "unica", label: "Única" },
  { v: "mensal", label: "Mensal" },
  { v: "trimestral", label: "Trimestral" },
  { v: "semestral", label: "Semestral" },
  { v: "anual", label: "Anual" },
  { v: "por_evento", label: "Por evento" },
];

export function ObrigacoesEditor({
  contratoId,
  itens,
  onChange,
}: {
  contratoId: string;
  itens: Obrigacao[];
  onChange: () => void;
}) {
  const salvar = useServerFn(upsertObrigacao);
  const remover = useServerFn(removeObrigacao);

  const [aberta, setAberta] = useState<null | { parte: Obrigacao["parte"]; item?: Obrigacao }>(null);
  const [descricao, setDescricao] = useState("");
  const [periodicidade, setPeriodicidade] = useState<Obrigacao["periodicidade"]>("mensal");
  const [clausula, setClausula] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState<Obrigacao | null>(null);

  function abrirNovo(parte: Obrigacao["parte"]) {
    setDescricao("");
    setPeriodicidade("mensal");
    setClausula("");
    setAberta({ parte });
  }
  function abrirEdicao(item: Obrigacao) {
    setDescricao(item.descricao);
    setPeriodicidade(item.periodicidade);
    setClausula(item.clausula_origem ?? "");
    setAberta({ parte: item.parte, item });
  }

  async function handleSalvar() {
    if (!aberta) return;
    if (descricao.trim() === "") {
      toast.error("Descreva a obrigação");
      return;
    }
    setSalvando(true);
    try {
      await salvar({
        data: {
          id: aberta.item?.id,
          contrato_id: contratoId,
          parte: aberta.parte,
          descricao: descricao.trim(),
          periodicidade,
          clausula_origem: clausula.trim() === "" ? null : clausula.trim(),
          ordem: aberta.item?.ordem ?? itens.filter((i) => i.parte === aberta.parte).length,
        },
      });
      toast.success(aberta.item ? "Obrigação atualizada" : "Obrigação adicionada");
      setAberta(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(item: Obrigacao) {
    try {
      await remover({ data: { id: item.id } });
      toast.success("Obrigação removida");
      setConfirmar(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Coluna
        titulo="Deveres do condomínio"
        itens={itens.filter((i) => i.parte === "condominio")}
        onNovo={() => abrirNovo("condominio")}
        onEditar={abrirEdicao}
        onRemover={setConfirmar}
      />
      <Coluna
        titulo="Deveres do prestador"
        itens={itens.filter((i) => i.parte === "prestador")}
        onNovo={() => abrirNovo("prestador")}
        onEditar={abrirEdicao}
        onRemover={setConfirmar}
      />

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {aberta?.item ? "Editar obrigação" : "Nova obrigação"}
              {aberta?.parte === "condominio" ? " — condomínio" : " — prestador"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} />
            </div>
            <div className="grid gap-1.5">
              <Label>Periodicidade</Label>
              <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as Obrigacao["periodicidade"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => (
                    <SelectItem key={p.v} value={p.v}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Cláusula de origem (opcional)</Label>
              <Input value={clausula} onChange={(e) => setClausula(e.target.value)} placeholder="Ex: Cláusula 5ª" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberta(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover obrigação?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => confirmar && handleRemover(confirmar)}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Coluna({
  titulo,
  itens,
  onNovo,
  onEditar,
  onRemover,
}: {
  titulo: string;
  itens: Obrigacao[];
  onNovo: () => void;
  onEditar: (i: Obrigacao) => void;
  onRemover: (i: Obrigacao) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-primary">{titulo}</h4>
        <Button size="sm" variant="outline" onClick={onNovo}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma obrigação cadastrada.</p>
      ) : (
        <ul className="space-y-3">
          {itens.map((i) => (
            <li key={i.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground">{i.descricao}</p>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onEditar(i)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onRemover(i)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {PERIODICIDADES.find((p) => p.v === i.periodicidade)?.label}
                {i.clausula_origem ? ` · ${i.clausula_origem}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}