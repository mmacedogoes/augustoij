import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ObrigacoesEditor, type Obrigacao } from "./ObrigacoesEditor";

interface EditObrigacoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  initialObrigacoes: Obrigacao[];
  onSaved: () => void;
}

export function EditObrigacoesModal({ open, onOpenChange, contratoId, initialObrigacoes, onSaved }: EditObrigacoesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-serif text-2xl">Editar Obrigações</DialogTitle>
          <DialogDescription>
            Gerencie as obrigações e deveres das partes vinculadas a este contrato.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="p-6 pt-4 max-h-[calc(90vh-80px)]">
          <ObrigacoesEditor 
            contratoId={contratoId} 
            itens={initialObrigacoes}
            onChange={onSaved}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
