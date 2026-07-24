import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PowerOff, PauseCircle, PlayCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  encerrarContrato, reabrirContrato, suspenderContrato, retomarContrato,
} from "@/lib/contratos-servico/situacao.functions";

type Props = {
  contratoId: string;
  situacao: string;
  onChange: () => void;
};

export function EncerrarSuspenderMenu({ contratoId, situacao, onChange }: Props) {
  const encFn = useServerFn(encerrarContrato);
  const reabFn = useServerFn(reabrirContrato);
  const susFn = useServerFn(suspenderContrato);
  const retFn = useServerFn(retomarContrato);

  const [dlgEncerrar, setDlgEncerrar] = useState(false);
  const [dlgSuspender, setDlgSuspender] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [dataEnc, setDataEnc] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<
    "termo_final" | "rescisao_amigavel" | "rescisao_inadimplemento" | "substituicao_prestador" | "outro"
  >("termo_final");
  const [motivoDet, setMotivoDet] = useState("");
  const [motivoSusp, setMotivoSusp] = useState("");

  async function acaoSimples(fn: (a: { data: { contratoId: string } }) => Promise<unknown>, ok: string) {
    setEnviando(true);
    try { await fn({ data: { contratoId } }); toast.success(ok); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha na operação."); }
    finally { setEnviando(false); }
  }

  async function confirmarEncerrar() {
    if (motivo === "outro" && motivoDet.trim().length < 3) {
      toast.error("Descreva o motivo."); return;
    }
    setEnviando(true);
    try {
      await encFn({ data: { contratoId, dataEncerramento: dataEnc, motivo, motivoDetalhe: motivoDet.trim() || null } });
      toast.success("Contrato encerrado.");
      setDlgEncerrar(false);
      onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao encerrar."); }
    finally { setEnviando(false); }
  }

  async function confirmarSuspender() {
    if (motivoSusp.trim().length < 3) { toast.error("Descreva o motivo."); return; }
    setEnviando(true);
    try {
      await susFn({ data: { contratoId, motivo: motivoSusp.trim() } });
      toast.success("Contrato suspenso.");
      setDlgSuspender(false);
      onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao suspender."); }
    finally { setEnviando(false); }
  }

  return (
    <>
      {situacao === "encerrado" ? (
        <Button variant="outline" size="sm" disabled={enviando}
          onClick={() => acaoSimples(reabFn, "Contrato reaberto.")}>
          <Undo2 className="h-4 w-4 mr-1" /> Reabrir contrato
        </Button>
      ) : situacao === "suspenso" ? (
        <Button variant="outline" size="sm" disabled={enviando}
          onClick={() => acaoSimples(retFn, "Contrato retomado.")}>
          <PlayCircle className="h-4 w-4 mr-1" /> Retomar contrato
        </Button>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={() => setDlgSuspender(true)}>
            <PauseCircle className="h-4 w-4 mr-1" /> Suspender
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDlgEncerrar(true)}>
            <PowerOff className="h-4 w-4 mr-1" /> Encerrar contrato
          </Button>
        </>
      )}

      <Dialog open={dlgEncerrar} onOpenChange={(v) => { if (!v) setDlgEncerrar(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar contrato</DialogTitle>
            <DialogDescription>
              Eventos automáticos futuros serão cancelados e novos períodos de checklist
              deixarão de ser criados. O histórico permanece acessível.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="enc-data">Data de encerramento</Label>
              <Input id="enc-data" type="date" value={dataEnc} onChange={(e) => setDataEnc(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as typeof motivo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="termo_final">Termo final da vigência</SelectItem>
                  <SelectItem value="rescisao_amigavel">Rescisão amigável</SelectItem>
                  <SelectItem value="rescisao_inadimplemento">Rescisão por inadimplemento do prestador</SelectItem>
                  <SelectItem value="substituicao_prestador">Substituição de prestador</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {motivo === "outro" && (
              <div>
                <Label htmlFor="enc-det">Detalhe do motivo</Label>
                <Textarea id="enc-det" rows={3} value={motivoDet} onChange={(e) => setMotivoDet(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgEncerrar(false)} disabled={enviando}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarEncerrar} disabled={enviando}>
              {enviando ? "Encerrando…" : "Encerrar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlgSuspender} onOpenChange={(v) => { if (!v) setDlgSuspender(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender contrato</DialogTitle>
            <DialogDescription>
              A execução do contrato ficará pausada. Eventos automáticos futuros são cancelados
              e novos períodos de checklist não são criados até a retomada.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="sus-mot">Motivo</Label>
            <Textarea id="sus-mot" rows={3} value={motivoSusp}
              onChange={(e) => setMotivoSusp(e.target.value)}
              placeholder="Ex.: obra paralisada, negociação em andamento…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgSuspender(false)} disabled={enviando}>Cancelar</Button>
            <Button onClick={confirmarSuspender} disabled={enviando}>
              {enviando ? "Suspendendo…" : "Suspender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}