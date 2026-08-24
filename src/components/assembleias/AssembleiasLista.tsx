import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit2, Eye, Play, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssembleiaSituacaoBadge } from "./AssembleiaSituacaoBadge";

interface Assembleia {
  id: string;
  titulo: string;
  data_inicio: string;
  modalidade: string;
  situacao: any;
  itens_count: number;
  convocacao_numero: number;
}

export function AssembleiasLista({ assembleias }: { assembleias: Assembleia[] }) {
  const navigate = useNavigate();

  const getAcao = (a: Assembleia) => {
    const instalada = ["ao_vivo", "em_votacao", "votos_encerrados"].includes(a.situacao);
    const encerrada = ["finalizada", "encerrada", "ata_pendente", "ata_publicada"].includes(a.situacao);
    const editavel = ["rascunho", "convocada", "habilitacao_pendente"].includes(a.situacao);

    if (editavel) {
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-2 text-augusto-gold hover:text-augusto-gold hover:bg-augusto-gold/10"
          onClick={() => navigate({ to: "/app/assembleias/nova" as any, search: { id: a.id, step: 2 } as any })}
        >
          <Edit2 className="h-3.5 w-3.5" /> Editar pauta
        </Button>
      );
    }

    if (instalada) {
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-2 text-augusto-gold hover:text-augusto-gold hover:bg-augusto-gold/10"
          onClick={() => navigate({ to: `/app/assembleias/${a.id}/mesa` as any })}
        >
          <Play className="h-3.5 w-3.5" /> Abrir mesa
        </Button>
      );
    }

    if (encerrada) {
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-2 text-augusto-gold hover:text-augusto-gold hover:bg-augusto-gold/10"
          onClick={() => navigate({ to: `/app/assembleias/${a.id}/auditoria` as any })}
        >
          <Eye className="h-3.5 w-3.5" /> Ver ata e votos
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="rounded-md border border-augusto-gold/10 overflow-hidden bg-card">
      {/* Mobile view as cards */}
      <div className="md:hidden divide-y divide-augusto-gold/10">
        {assembleias.map((a) => (
          <div key={a.id} className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-primary">{a.titulo}</h3>
                <p className="text-xs text-muted-foreground">
                  {a.itens_count} itens • {a.convocacao_numero}ª convocação
                </p>
              </div>
              <AssembleiaSituacaoBadge situacao={a.situacao} />
            </div>
            <div className="flex justify-between items-end">
              <div className="text-xs text-muted-foreground">
                <p>{format(new Date(a.data_inicio), "PPP", { locale: ptBR })}</p>
                <p className="capitalize">{a.modalidade}</p>
              </div>
              {getAcao(a)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop view as table */}
      <Table className="hidden md:table">
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent border-augusto-gold/10">
            <TableHead className="font-bold text-primary">Assembleia</TableHead>
            <TableHead className="font-bold text-primary">Data e hora</TableHead>
            <TableHead className="font-bold text-primary">Modalidade</TableHead>
            <TableHead className="font-bold text-primary">Situação</TableHead>
            <TableHead className="text-right font-bold text-primary">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assembleias.map((a) => (
            <TableRow key={a.id} className="hover:bg-augusto-gold/[0.02] border-augusto-gold/10 group transition-colors">
              <TableCell>
                <div>
                  <Link 
                    to={"/app/assembleias/$assembleiaId" as any}
                    params={{ assembleiaId: a.id } as any}
                    className="font-bold text-primary hover:text-augusto-gold transition-colors"
                  >
                    {a.titulo}
                  </Link>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {a.itens_count} {a.itens_count === 1 ? 'item' : 'itens'} de pauta • {a.convocacao_numero}ª convocação
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {format(new Date(a.data_inicio), "PPP 'às' HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs capitalize">
                {a.modalidade}
              </TableCell>
              <TableCell>
                <AssembleiaSituacaoBadge situacao={a.situacao} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end items-center gap-2">
                  {getAcao(a)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate({ to: `/app/assembleias/${a.id}` })}>
                        Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
