import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setAvisosAutomaticos } from "@/lib/contratos-servico/avisos.functions";

type Props = {
  contratoId: string;
  ativo: boolean;
  onChange?: (novo: boolean) => void;
};

export function AvisosSwitch({ contratoId, ativo, onChange }: Props) {
  const setFn = useServerFn(setAvisosAutomaticos);
  const [checked, setChecked] = useState(ativo);
  const [carregando, setCarregando] = useState(false);

  async function toggle(v: boolean) {
    const antes = checked;
    setChecked(v);
    setCarregando(true);
    try {
      await setFn({ data: { contratoId, ativo: v } });
      toast.success(v ? "Avisos automáticos ligados." : "Avisos automáticos desligados.");
      onChange?.(v);
    } catch (e) {
      setChecked(antes);
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch id="avisos-auto" checked={checked} onCheckedChange={toggle} disabled={carregando} />
      <Label htmlFor="avisos-auto" className="text-sm cursor-pointer">
        Avisos automáticos
      </Label>
      {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}