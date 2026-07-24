import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ContratoForm, type ContratoFormValues } from "@/components/contratos-servico/ContratoForm";
import { ContratoUploadExtrator } from "@/components/contratos-servico/ContratoUploadExtrator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/contratos/novo")({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<ContratoFormValues | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);

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

        <div className="mb-6">
          <ContratoUploadExtrator
            onExtraido={({ campos, tipoServicoId }) => {
              const { tipo_servico_slug: _slug, ...rest } = campos;
              void _slug;
              const clean: ContratoFormValues = {};
              for (const [k, v] of Object.entries(rest)) {
                if (v === null || v === undefined) continue;
                (clean as Record<string, unknown>)[k] = v;
              }
              if (tipoServicoId) clean.tipo_servico_id = tipoServicoId;
              setInitial(clean);
              setFormKey((n) => n + 1);
            }}
          />
        </div>

        <ContratoForm
          key={formKey}
          initial={initial}
          onSaved={(id) => navigate({ to: "/app/contratos/$contratoId", params: { contratoId: id } })}
          submitLabel="Criar contrato"
        />
      </div>
    </AppShell>
  );
}