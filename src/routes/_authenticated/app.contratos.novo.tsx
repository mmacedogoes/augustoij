import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ContratoForm } from "@/components/contratos-servico/ContratoForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/contratos/novo")({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="app-eyebrow">Contratos</p>
            <h1 className="text-3xl font-serif text-primary">Novo contrato</h1>
            <p className="text-muted-foreground">
              Cadastre o contrato de prestação de serviços com os dados do prestador e da vigência.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate({ to: "/app/contratos" })}>
            Cancelar
          </Button>
        </div>
        <ContratoForm
          onSaved={(id) => navigate({ to: "/app/contratos/$contratoId", params: { contratoId: id } })}
          submitLabel="Criar contrato"
        />
      </div>
    </AppShell>
  );
}