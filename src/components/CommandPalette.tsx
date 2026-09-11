import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Building,
  FileText,
  Users,
  User,
  Shield,
  Upload,
  PlusCircle,
  Brain,
  Search,
  Home,
  ArrowRight,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { listCondominios } from "@/lib/condominios.functions";

type CondoItem = {
  id: string;
  nome: string;
  uf: string | null;
  cidade: string | null;
};

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isAdmin?: boolean;
}

export function CommandPalette({ open: controlledOpen, onOpenChange, isAdmin }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const navigate = useNavigate();

  const fetchCondos = useServerFn(listCondominios);
  const { data: condominios = [] } = useQuery<CondoItem[]>({
    queryKey: ["condominios-lista"],
    queryFn: async () => ((await fetchCondos()) as CondoItem[]) ?? [],
    staleTime: 60_000,
  });

  // Global Hotkey: Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))
      ) {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, setOpen]);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite para buscar condomínios, contratos ou comandos..." />
      <CommandList className="max-h-[380px] scroll-py-2 overflow-y-auto p-2">
        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
          Nenhum resultado encontrado.
        </CommandEmpty>

        {/* Grupo 1: Condomínios Cadastrados */}
        {condominios.length > 0 && (
          <CommandGroup heading="Meus Condomínios">
            {condominios.map((c) => (
              <CommandItem
                key={c.id}
                value={`condominio ${c.nome} ${c.cidade ?? ""} ${c.uf ?? ""}`}
                onSelect={() =>
                  handleSelect(() =>
                    navigate({ to: "/app/condominios/$id", params: { id: c.id } }),
                  )
                }
                className="flex items-center justify-between gap-2 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-1.5 rounded-md bg-augusto-gold/10 text-augusto-gold">
                    <Building className="h-4 w-4 shrink-0" />
                  </span>
                  <div className="truncate">
                    <span className="font-medium text-foreground">{c.nome}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : c.uf ?? ""}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Grupo 2: Ações Rápidas & IA */}
        <CommandGroup heading="Ações Rápidas">
          <CommandItem
            value="novo contrato analise upload"
            onSelect={() => handleSelect(() => navigate({ to: "/app/contratos/novo" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <span className="p-1.5 rounded-md bg-augusto-green/10 text-augusto-green">
              <PlusCircle className="h-4 w-4" />
            </span>
            <span className="flex-1 font-medium">Cadastrar Novo Contrato</span>
            <CommandShortcut className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Ação</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="importar lote contratos pdf"
            onSelect={() => handleSelect(() => navigate({ to: "/app/contratos/importar" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <span className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Upload className="h-4 w-4" />
            </span>
            <span className="flex-1 font-medium">Importar Contratos em Lote (PDF)</span>
            <CommandShortcut className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Upload</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="treinar ia base de conhecimento modelos juridicos"
            onSelect={() => handleSelect(() => navigate({ to: "/app/admin/treinamento" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
              <Brain className="h-4 w-4" />
            </span>
            <span className="flex-1 font-medium">Treinar IA / Base Jurídica e Modelos</span>
            <CommandShortcut className="text-[10px] bg-muted px-1.5 py-0.5 rounded">RAG</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Grupo 3: Navegação Principal */}
        <CommandGroup heading="Módulos & Navegação">
          <CommandItem
            value="inicio dashboard home"
            onSelect={() => handleSelect(() => navigate({ to: "/app" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Painel Inicial</span>
          </CommandItem>

          <CommandItem
            value="condominios lista portfolio"
            onSelect={() => handleSelect(() => navigate({ to: "/app/condominios" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <Building className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Meus Condomínios</span>
          </CommandItem>

          <CommandItem
            value="gestao contratos painel alertas reajuste"
            onSelect={() => handleSelect(() => navigate({ to: "/app/contratos/painel" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Gestão de Contratos</span>
          </CommandItem>

          <CommandItem
            value="assembleias virtuais atas editais"
            onSelect={() => handleSelect(() => navigate({ to: "/app/assembleias" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Assembleias Virtuais</span>
          </CommandItem>

          <CommandItem
            value="conta perfil assinatura plano faturas"
            onSelect={() => handleSelect(() => navigate({ to: "/app/conta" }))}
            className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Minha Conta & Assinatura</span>
          </CommandItem>

          {isAdmin && (
            <>
              <CommandItem
                value="admin gestao de imoveis locacoes locatarios"
                onSelect={() => handleSelect(() => navigate({ to: "/app/admin/imoveis" }))}
                className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
              >
                <Home className="h-4 w-4 text-amber-500" />
                <span className="flex-1">Gestão de Imóveis (Locações)</span>
                <CommandShortcut className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">Admin</CommandShortcut>
              </CommandItem>

              <CommandItem
                value="administracao metricas usuarios planos admin"
                onSelect={() => handleSelect(() => navigate({ to: "/app/admin" }))}
                className="flex items-center gap-2.5 py-2 px-3 cursor-pointer rounded-md hover:bg-accent/80 transition-colors"
              >
                <Shield className="h-4 w-4 text-amber-500" />
                <span className="flex-1">Painel Administrativo</span>
                <CommandShortcut className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">Admin</CommandShortcut>
              </CommandItem>
            </>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/60 hover:bg-muted border border-border/60 hover:border-border rounded-lg transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70 group"
      title="Buscar ou navegar rapidamente (Ctrl + K)"
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
        Buscar condomínios, ações...
      </span>
      <kbd className="pointer-events-none ml-2 inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
