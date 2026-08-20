import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

interface PassoRegrasProps {
  data: {
    base_calculo_padrao: string;
    quorum_instalacao_1: string;
    quorum_instalacao_2: string | null;
    bloqueio_inadimplente: boolean;
    limite_procuracoes: number | null;
    voto_pela_mesa: boolean;
  };
  onChange: (data: any) => void;
  unidadesSemFracao: number;
}

export function PassoRegras({ data, onChange, unidadesSemFracao }: PassoRegrasProps) {
  return (
    <div className="grid gap-8 max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>Base de cálculo padrão</Label>
          <Select 
            value={data.base_calculo_padrao} 
            onValueChange={v => onChange({ ...data, base_calculo_padrao: v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="voto_por_unidade">Voto por unidade (1 por apto)</SelectItem>
              <SelectItem value="fracao_ideal">Fração ideal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.base_calculo_padrao === "fracao_ideal" && unidadesSemFracao > 0 && (
          <div className="bg-augusto-gold/10 border border-augusto-gold/20 p-3 rounded-lg flex items-start gap-3 text-augusto-gold">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-bold uppercase tracking-wider">Aviso de Fração Ideal</p>
              <p>Existem {unidadesSemFracao} unidades sem fração ideal cadastrada. A apuração por fração ideal não poderá ser feita enquanto isso não for corrigido.</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Instalação em 1ª convocação</Label>
          <Select value={data.quorum_instalacao_1} onValueChange={v => onChange({ ...data, quorum_instalacao_1: v })}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maioria_unidades">Maioria das unidades</SelectItem>
              <SelectItem value="dois_tercos">2/3 das unidades</SelectItem>
              <SelectItem value="metade_mais_um">Metade mais um</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Instalação em 2ª convocação</Label>
          <Select 
            value={data.quorum_instalacao_2 || "qualquer_numero"} 
            onValueChange={v => onChange({ ...data, quorum_instalacao_2: v === "qualquer_numero" ? null : v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qualquer_numero">Qualquer número de presentes</SelectItem>
              <SelectItem value="maioria_presentes">Maioria dos presentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6 border-t pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="bloqueio">Bloquear inadimplentes</Label>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Impede o voto de unidades com débitos em aberto, conforme Art. 1.335, inciso III, do Código Civil.
            </p>
          </div>
          <Switch 
            id="bloqueio"
            checked={data.bloqueio_inadimplente}
            onCheckedChange={v => onChange({ ...data, bloqueio_inadimplente: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="voto_mesa">Permitir voto pela mesa</Label>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Habilita que o presidente/secretário lance votos presenciais diretamente no sistema.
            </p>
          </div>
          <Switch 
            id="voto_mesa"
            checked={data.voto_pela_mesa}
            onCheckedChange={v => onChange({ ...data, voto_pela_mesa: v })}
          />
        </div>

        <div className="grid gap-2 w-48">
          <Label htmlFor="procuracoes">Limite de procurações</Label>
          <Input 
            id="procuracoes"
            type="number"
            min={0}
            value={data.limite_procuracoes || ""}
            onChange={e => onChange({ ...data, limite_procuracoes: e.target.value === "" ? null : parseInt(e.target.value) })}
            placeholder="Ilimitado se vazio"
          />
          <p className="text-[9px] text-muted-foreground">Máximo por outorgado</p>
        </div>
      </div>
    </div>
  );
}
