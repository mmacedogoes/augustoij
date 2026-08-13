import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContratoForm, type ContratoFormValues } from "./ContratoForm";

interface EditContratoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: ContratoFormValues;
  onSaved: (id: string) => void;
}

export function EditContratoModal({ open, onOpenChange, initialValues, onSaved }: EditContratoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-serif text-2xl">Editar Dados do Contrato</DialogTitle>
          <DialogDescription>
            Altere as informações centrais, vigência e valores do contrato.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="p-6 pt-4 max-h-[calc(90vh-120px)]">
          <ContratoForm 
            initial={initialValues} 
            onSaved={(id) => {
              onSaved(id);
              onOpenChange(false);
            }} 
            submitLabel="Salvar Alterações"
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
