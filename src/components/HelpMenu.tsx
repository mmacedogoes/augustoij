import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HelpCircle, BookOpen, PlayCircle, MessageSquare, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function HelpMenu({ onStartTour }: { onStartTour: () => void }) {
  const navigate = useNavigate();
  const [suporteOpen, setSuporteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Ajuda"
        >
          <HelpCircle className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => navigate({ to: "/app/ajuda" })}>
            <BookOpen className="h-4 w-4 mr-2" /> Manual do sistema
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStartTour}>
            <PlayCircle className="h-4 w-4 mr-2" /> Iniciar tour guiado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/app/ajuda/dicas-ia" })}>
            <MessageSquare className="h-4 w-4 mr-2" /> Dicas de uso da IA
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSuporteOpen(true)}>
            <Mail className="h-4 w-4 mr-2" /> Falar com suporte
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={suporteOpen} onOpenChange={setSuporteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Falar com o suporte</DialogTitle>
            <DialogDescription>
              Envie um e-mail descrevendo sua dúvida ou problema. Respondemos em até 1 dia útil.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              <strong>E-mail:</strong>{" "}
              <a className="text-emerald-600 hover:underline" href="mailto:suporte@condoia.com.br">
                suporte@condoia.com.br
              </a>
            </p>
            <p className="text-muted-foreground">
              Informe seu e-mail de cadastro e, se possível, um print da tela.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}