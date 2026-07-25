import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ContratosTabs } from "@/components/contratos-servico/ContratosTabs";
import { Button } from "@/components/ui/button";
import { ContratoForm, type ContratoFormValues } from "@/components/contratos-servico/ContratoForm";
import { getContratoServico } from "@/lib/contratos-servico/contratos.functions";

export const Route = createFileRoute("/_authenticated/app/contratos/$contratoId/editar")({
  component: Page,
});

function Page() {
  const { contratoId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getContratoServico);
  const [initial, setInitial] = useState<ContratoFormValues | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getFn({ data: { id: contratoId } })
      .then((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = (r as any).contrato;
        setInitial({
          id: c.id,
          condominio_id: c.condominio_id,
          tipo_servico_id: c.tipo_servico_id,
          situacao: c.situacao,
          prestador_nome: c.prestador_nome,
          prestador_documento: c.prestador_documento,
          prestador_email: c.prestador_email,
          prestador_telefone: c.prestador_telefone,
          objeto: c.objeto,
          terceirizacao_mao_de_obra: c.terceirizacao_mao_de_obra,
          data_inicio: c.data_inicio,
          prazo_indeterminado: c.prazo_indeterminado,
          data_fim: c.data_fim,
          renovacao_automatica: c.renovacao_automatica,
          aviso_previo_dias: c.aviso_previo_dias,
          valor: c.valor === null ? null : Number(c.valor),
          tipo_valor: c.tipo_valor,
          dia_vencimento: c.dia_vencimento,
          indice_reajuste: c.indice_reajuste,
          mes_base_reajuste: c.mes_base_reajuste,
          multa_rescisoria: c.multa_rescisoria,
          exige_seguro_rc: c.exige_seguro_rc,
          garantias: c.garantias,
          foro: c.foro,
        });
      })
      .catch((e: Error) => {
        setErro(e.message);
        toast.error(e.message);
      });
  }, [getFn, contratoId]);

  return (
    <AppShell>
      <div className="max-w-3xl">
        <div className="mb-4">
          <ContratosTabs condominioId={null} />
        </div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() =>
            navigate({ to: "/app/contratos/$contratoId", params: { contratoId } })
          }
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à ficha
        </Button>
        <div className="mb-6">
          <p className="app-eyebrow">Contratos</p>
          <h1 className="text-3xl font-serif text-primary">Editar contrato</h1>
        </div>
        {erro ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {erro}
          </div>
        ) : !initial ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ContratoForm
            initial={initial}
            onSaved={(id) =>
              navigate({ to: "/app/contratos/$contratoId", params: { contratoId: id } })
            }
            submitLabel="Salvar alterações"
          />
        )}
      </div>
    </AppShell>
  );
}