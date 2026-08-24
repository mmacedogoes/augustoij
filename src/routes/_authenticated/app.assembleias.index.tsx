import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { Plus, RefreshCcw, Info, Building } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AssembleiasIndicadores } from "@/components/assembleias/AssembleiasIndicadores";
import { AssembleiasLista } from "@/components/assembleias/AssembleiasLista";
import {
  listAssembleias,
  getIndicadoresAssembleias,
  listCondominiosParaAssembleias,
} from "@/lib/assembleias/assembleias.functions";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { isSuperAdmin } from "@/lib/contratos-servico/guard";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "augusto.condominioAtivo";

export const Route = createFileRoute("/_authenticated/app/assembleias/")({
  validateSearch: (raw) => z.object({ cid: z.string().uuid().optional() }).parse(raw),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const condominioId = useCondominioAtivo();
  const fetchAssembleias = useServerFn(listAssembleias);
  const fetchIndicadores = useServerFn(getIndicadoresAssembleias);

  const { data: access, isLoading: checkingAccess } = useQuery({
    queryKey: ["assembleias-access"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isSuper: false };
      const isSuper = await isSuperAdmin({ supabase, userId: user.id });
      return { isSuper };
    }
  });

  useEffect(() => {
    if (access && !access.isSuper) {
      toast.error("Acesso negado.");
      navigate({ to: "/app" });
    }
  }, [access, navigate]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["assembleias", condominioId],
    queryFn: async () => {
      if (!condominioId) return null;
      const [rows, indicators] = await Promise.all([
        fetchAssembleias({ data: { condominioId } }),
        fetchIndicadores({ data: { condominioId } })
      ]);
      return { rows, indicators };
    },
    enabled: !!condominioId && !!access?.isSuper
  });

  if (checkingAccess || (access?.isSuper && isLoading)) {
    return (
      <AppShell>
        <div className="space-y-6 animate-augusto-fade-up">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppShell>
    );
  }

  if (!condominioId) {
    return (
      <AppShell>
        <AppEmptyState
          icon={<Info className="opacity-20" size={48} />}
          title="Selecione um condomínio"
          description="Para visualizar as assembleias, selecione um condomínio no topo da página."
        />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="text-center py-12 space-y-4">
          <p className="text-destructive font-medium">Não foi possível carregar as assembleias.</p>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Tentar de novo
          </Button>
        </div>
      </AppShell>
    );
  }

  const assembleias = data?.rows ?? [];
  const indicadores = data?.indicators ?? { emAndamento: 0, proximaEmDias: null };

  return (
    <AppShell>
      <div className="max-w-6xl space-y-8 animate-augusto-fade-up">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif text-primary tracking-tight">Assembleias</h1>
            <p className="text-muted-foreground text-sm">Gestão de deliberações e votações do condomínio.</p>
          </div>
          <Button 
            variant="augusto" 
            className="gap-2"
            onClick={() => navigate({ to: "/app/assembleias/nova" as any })}
          >
            <Plus className="h-4 w-4" /> Convocar assembleia
          </Button>
        </header>

        <AssembleiasIndicadores 
          emAndamento={indicadores.emAndamento} 
          proximaEmDias={indicadores.proximaEmDias} 
        />

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-augusto-gold/20" />
            <h2 className="text-sm font-medium text-augusto-gold uppercase tracking-widest px-4">Linha do tempo</h2>
            <div className="h-px flex-1 bg-augusto-gold/20" />
          </div>

          {assembleias.length === 0 ? (
            <AppEmptyState
              icon={<RefreshCcw className="opacity-20" size={48} />}
              title="Nenhuma assembleia registrada"
              description="A primeira assembleia começa pela pauta. Clique em convocar para começar."
              action={
                <Button variant="augusto" onClick={() => navigate({ to: "/app/assembleias/nova" as any })}>
                  Convocar assembleia
                </Button>
              }
            />
          ) : (
            <AssembleiasLista assembleias={assembleias as any} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
