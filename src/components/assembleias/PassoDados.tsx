import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface PassoDadosProps {
  data: {
    titulo: string;
    tipo: string;
    data_inicio: string;
    local: string;
    modalidade: "presencial" | "virtual" | "hibrida";
    link_videoconferencia: string;
    convocacao_numero: number;
  };
  onChange: (data: any) => void;
}

export function PassoDados({ data, onChange }: PassoDadosProps) {
  return (
    <div className="grid gap-6 max-w-2xl">
      <div className="grid gap-2">
        <Label htmlFor="titulo">Título da assembleia</Label>
        <Input 
          id="titulo"
          value={data.titulo}
          onChange={e => onChange({ ...data, titulo: e.target.value })}
          placeholder="Ex: Assembleia Geral Extraordinária - Obras Fachada"
          className="h-11"
        />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mínimo 5 caracteres</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Tipo de Assembleia</Label>
          <Select value={data.tipo} onValueChange={v => onChange({ ...data, tipo: v })}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AGO">Assembleia Geral Ordinária (AGO)</SelectItem>
              <SelectItem value="AGE">Assembleia Geral Extraordinária (AGE)</SelectItem>
              <SelectItem value="MISTA">Assembleia Mista</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Data e Hora</Label>
          <Input 
            type="datetime-local" 
            value={data.data_inicio}
            onChange={e => onChange({ ...data, data_inicio: e.target.value })}
            className="h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Convocação</Label>
          <Select 
            value={data.convocacao_numero.toString()} 
            onValueChange={v => onChange({ ...data, convocacao_numero: parseInt(v) })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1ª Convocação</SelectItem>
              <SelectItem value="2">2ª Convocação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Modalidade</Label>
          <Select 
            value={data.modalidade} 
            onValueChange={(v: any) => onChange({ ...data, modalidade: v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="virtual">Virtual</SelectItem>
              <SelectItem value="hibrida">Híbrida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="local">Local físico</Label>
        <Input 
          id="local"
          value={data.local}
          onChange={e => onChange({ ...data, local: e.target.value })}
          placeholder="Ex: Salão de Festas ou Endereço completo"
          className="h-11"
        />
      </div>

      {(data.modalidade === "virtual" || data.modalidade === "hibrida") && (
        <div className="grid gap-2 animate-augusto-fade-in">
          <Label htmlFor="link">Link da sala virtual</Label>
          <Input 
            id="link"
            value={data.link_videoconferencia}
            onChange={e => onChange({ ...data, link_videoconferencia: e.target.value })}
            placeholder="https://zoom.us/j/..."
            className="h-11"
          />
        </div>
      )}
    </div>
  );
}
