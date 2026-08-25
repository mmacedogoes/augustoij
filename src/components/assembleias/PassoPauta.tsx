import React, { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { importarPautaPdf } from "@/lib/assembleias/pauta-import.functions";
import { Button } from "@/components/ui/button";
import { Plus, X, GripVertical, Info, MoveUp, MoveDown, Trash2, Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { NumeralRomano } from "./NumeralRomano";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Opcao {
  rotulo: string;
  descricao?: string;
  natureza?: string;
  ordem: number;
}

export interface ItemPauta {
  id?: string;
  titulo: string;
  descricao?: string;
  ordem: number;
  tipo_votacao: "sim_nao_abstencao" | "escolha_unica";
  voto_secreto: boolean;
  regra_quorum: string;
  quorum_valor?: number;
  base_calculo: string;
  opcoes?: Opcao[];
  alerta_ia?: { nivel: string; mensagem: string };
  fundamento_legal?: string;
}

interface PassoPautaProps {
  itens: ItemPauta[];
  onChange: (itens: ItemPauta[]) => void;
  regrasPadrao: { base_calculo: string };
  /** Persiste um item no banco e devolve o id gerado (opcional). */
  onPersistItem?: (item: ItemPauta, index: number) => void;
  /** Remove o item no banco (opcional). */
  onPersistDelete?: (item: ItemPauta) => void;
  /** Persiste a nova ordem dos itens (opcional). */
  onPersistOrder?: (itens: ItemPauta[]) => void;
}

export function PassoPauta({
  itens,
  onChange,
  regrasPadrao,
  onPersistItem,
  onPersistDelete,
  onPersistOrder,
}: PassoPautaProps) {
  const [editingItem, setEditingItem] = useState<{ item: ItemPauta; index: number } | null>(null);

  const handleAddItem = () => {
    const newItem: ItemPauta = {
      titulo: "",
      ordem: itens.length + 1,
      tipo_votacao: "sim_nao_abstencao",
      voto_secreto: false,
      regra_quorum: "maioria_presentes",
      base_calculo: regrasPadrao.base_calculo,
    };
    setEditingItem({ item: newItem, index: -1 });
  };

  const handleSaveItem = (item: ItemPauta) => {
    const newItens = [...itens];
    const index = editingItem?.index === -1 ? newItens.length : editingItem!.index;
    if (editingItem?.index === -1) {
      newItens.push(item);
    } else {
      newItens[index] = item;
    }
    onChange(newItens);
    setEditingItem(null);
    onPersistItem?.(newItens[index], index);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newItens = [...itens];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newItens.length) return;

    [newItens[index], newItens[newIndex]] = [newItens[newIndex], newItens[index]];

    // Recalcular ordens
    const reordenados = newItens.map((it, i) => ({ ...it, ordem: i + 1 }));
    onChange(reordenados);
    onPersistOrder?.(reordenados);
  };

  const handleRemove = (index: number) => {
    const removido = itens[index];
    const reordenados = itens
      .filter((_, i) => i !== index)
      .map((it, i) => ({ ...it, ordem: i + 1 }));
    onChange(reordenados);
    if (removido) onPersistDelete?.(removido);
    onPersistOrder?.(reordenados);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {itens.sort((a, b) => a.ordem - b.ordem).map((item, idx) => (
          <ItemCard 
            key={idx} 
            item={item} 
            onEdit={() => setEditingItem({ item, index: idx })}
            onMoveUp={() => handleMove(idx, "up")}
            onMoveDown={() => handleMove(idx, "down")}
            isFirst={idx === 0}
            isLast={idx === itens.length - 1}
          />
        ))}

        {itens.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-augusto-gold/20 rounded-lg">
            <p className="text-muted-foreground text-sm">Nenhum item adicionado à pauta.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="gap-2 border-augusto-gold/20 text-augusto-gold" onClick={handleAddItem}>
            <Plus className="h-4 w-4" /> Adicionar item à pauta
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf,.docx,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground"
            disabled={importando}
            onClick={() => fileRef.current?.click()}
          >
            {importando ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Lendo o edital...</>
            ) : (
              <><Upload className="h-4 w-4" /> Importar pauta do edital em PDF</>
            )}
          </Button>
        </div>
      </div>

      {editingItem && (
        <ItemPautaForm 
          item={editingItem.item} 
          onSave={handleSaveItem} 
          onClose={() => setEditingItem(null)}
          onDelete={editingItem.index !== -1 ? () => handleRemove(editingItem.index) : undefined}
        />
      )}
    </div>
  );
}

function ItemCard({ item, onEdit, onMoveUp, onMoveDown, isFirst, isLast }: { 
  item: ItemPauta; 
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <Card className="group border-augusto-gold/10 hover:border-augusto-gold/30 transition-all p-4">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1">
          <NumeralRomano n={item.ordem} className="text-xl" />
          <div className="flex flex-col gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={isFirst}>
              <MoveUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={isLast}>
              <MoveDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-primary group-hover:text-augusto-gold transition-colors">{item.titulo}</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                <span>{item.tipo_votacao === "sim_nao_abstencao" ? "Votação Padrão" : "Escolha Única"}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>Quórum: {item.regra_quorum.replace(/_/g, " ")}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>Base: {item.base_calculo.replace(/_/g, " ")}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 text-xs text-augusto-gold">
              Editar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {item.voto_secreto && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-[#800020]/5 text-[#800020] border-[#800020]/20 text-[9px] uppercase">Voto secreto</Badge>
                <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent text-[9px] lowercase">identidade separada no banco</Badge>
              </div>
            )}
            {item.tipo_votacao === "escolha_unica" && item.opcoes && (
              <div className="flex items-center gap-1">
                {item.opcoes.map((o, i) => (
                  <Badge key={i} variant="secondary" className="bg-muted/50 text-[9px]">{o.rotulo}</Badge>
                ))}
              </div>
            )}
            {item.alerta_ia && (
              <Badge variant="outline" className="bg-augusto-gold/10 text-augusto-gold border-augusto-gold/20 gap-1 text-[9px]">
                Augusto conferiu o quórum
              </Badge>
            )}
          </div>

          {item.alerta_ia && (
             <div className={cn(
               "mt-3 p-2 rounded text-[10px] border-l-2",
               item.alerta_ia.nivel === "info" && "bg-augusto-green/5 border-augusto-green/30 text-augusto-green",
               item.alerta_ia.nivel === "atencao" && "bg-augusto-gold/5 border-augusto-gold/30 text-augusto-gold",
               item.alerta_ia.nivel === "risco" && "bg-destructive/5 border-destructive/30 text-destructive"
             )}>
               <p className="font-bold mb-0.5">Revisão IA:</p>
               <p>{item.alerta_ia.mensagem}</p>
             </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ItemPautaForm({ item, onSave, onClose, onDelete }: { 
  item: ItemPauta; 
  onSave: (item: ItemPauta) => void; 
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [formData, setFormData] = useState<ItemPauta>(item);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Item da Pauta</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label>Título do item</Label>
            <Input 
              value={formData.titulo} 
              onChange={e => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Aprovação de contas do exercício anterior"
            />
          </div>

          <div className="grid gap-2">
            <Label>Descrição / Contexto (opcional)</Label>
            <Textarea 
              value={formData.descricao} 
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              className="h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo de votação</Label>
              <Select 
                value={formData.tipo_votacao} 
                onValueChange={(v: any) => setFormData({ ...formData, tipo_votacao: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim_nao_abstencao">Sim, Não e Abstenção</SelectItem>
                  <SelectItem value="escolha_unica">Escolha Única entre Alternativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Switch 
                id="secreto" 
                checked={formData.voto_secreto}
                onCheckedChange={v => setFormData({ ...formData, voto_secreto: v })}
              />
              <Label htmlFor="secreto">Voto Secreto</Label>
            </div>
          </div>

          {formData.tipo_votacao === "escolha_unica" && (
            <OpcoesEditor 
              opcoes={formData.opcoes || []} 
              onChange={opcoes => setFormData({ ...formData, opcoes })}
            />
          )}

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="grid gap-2">
              <Label>Regra de quórum</Label>
              <Select 
                value={formData.regra_quorum} 
                onValueChange={(v: any) => setFormData({ ...formData, regra_quorum: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maioria_presentes">Maioria dos presentes</SelectItem>
                  <SelectItem value="maioria_condominos">Maioria dos condôminos</SelectItem>
                  <SelectItem value="dois_tercos_condominos">Dois terços dos condôminos</SelectItem>
                  <SelectItem value="tres_quartos_condominos">Três quartos dos condôminos</SelectItem>
                  <SelectItem value="unanimidade">Unanimidade</SelectItem>
                  <SelectItem value="personalizado">Quórum personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Base de cálculo</Label>
              <Select 
                value={formData.base_calculo} 
                onValueChange={(v: any) => setFormData({ ...formData, base_calculo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voto_por_unidade">Voto por unidade (1 por apto)</SelectItem>
                  <SelectItem value="fracao_ideal">Fração ideal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
          {onDelete ? (
            <Button variant="ghost" onClick={onDelete} className="text-destructive hover:bg-destructive/5 gap-2">
              <Trash2 className="h-4 w-4" /> Remover item
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button variant="augusto" onClick={() => onSave(formData)}>Salvar Item</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpcoesEditor({ opcoes, onChange }: { opcoes: Opcao[]; onChange: (opcoes: Opcao[]) => void }) {
  const addOpcao = () => {
    onChange([...opcoes, { rotulo: "", ordem: opcoes.length + 1 }]);
  };

  const removeOpcao = (idx: number) => {
    const newOpcoes = opcoes.filter((_, i) => i !== idx);
    newOpcoes.forEach((o, i) => o.ordem = i + 1);
    onChange(newOpcoes);
  };

  return (
    <div className="grid gap-3 bg-muted/30 p-4 rounded-lg">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Alternativas (mínimo 2)</Label>
      {opcoes.map((o, idx) => (
        <div key={idx} className="flex gap-2">
          <Input 
            value={o.rotulo} 
            onChange={e => {
              const next = [...opcoes];
              next[idx].rotulo = e.target.value;
              onChange(next);
            }}
            placeholder={`Opção ${idx + 1}`}
            className="h-8 text-sm"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeOpcao(idx)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-8 border-dashed mt-2" onClick={addOpcao}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar alternativa
      </Button>
    </div>
  );
}
