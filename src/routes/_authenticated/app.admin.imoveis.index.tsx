import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Users, Building, FileText, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Administração de Imóveis</h1>
        <p className="text-muted-foreground">
          Gestão de proprietários, imóveis e contratos de locação e administração.
        </p>
        <div className="mt-6">
          <AdminNav />
        </div>
        <ImoveisNav />
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/app/admin/imoveis/proprietarios">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Proprietários</p>
                  <p className="text-sm text-muted-foreground">Cadastro dos donos dos imóveis.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/app/admin/imoveis/unidades">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Imóveis</p>
                  <p className="text-sm text-muted-foreground">Unidades vinculadas a cada proprietário.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/app/admin/imoveis/locacao">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Contratos de locação</p>
                  <p className="text-sm text-muted-foreground">Vínculo imóvel × inquilino, valores e caução.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/app/admin/imoveis/administracao">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Contratos de administração</p>
                  <p className="text-sm text-muted-foreground">Honorários e regras entre administrador e proprietário.</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}