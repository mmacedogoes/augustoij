import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/condominios.functions";

export const Route = createFileRoute("/_authenticated/app/conta")({
  component: ContaPage,
});

function ContaPage() {
  const fetchProfile = useServerFn(getProfile);
  const [profile, setProfile] = useState<{ nome: string | null; email: string | null; oab: string | null; telefone: string | null } | null>(null);

  useEffect(() => {
    fetchProfile().then((p) => setProfile(p as typeof profile)).catch(() => {});
  }, [fetchProfile]);

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Conta e plano</h1>
          <p className="text-muted-foreground">Gerencie seus dados e assinatura.</p>
        </div>

        <Card className="p-6 space-y-2">
          <h2 className="font-semibold text-primary">Seus dados</h2>
          <p className="text-sm"><strong>Nome:</strong> {profile?.nome ?? "—"}</p>
          <p className="text-sm"><strong>E-mail:</strong> {profile?.email ?? "—"}</p>
          <p className="text-sm"><strong>Telefone:</strong> {profile?.telefone ?? "—"}</p>
          <p className="text-sm"><strong>OAB:</strong> {profile?.oab ?? "—"}</p>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold text-primary">Plano atual</h2>
          <p className="text-sm text-muted-foreground">Você está no <strong>trial de 7 dias</strong>. Integração com Stripe será habilitada em breve.</p>
          <div className="flex gap-2">
            <Button disabled>Gerenciar assinatura</Button>
            <Button variant="outline" disabled>Cancelar</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}