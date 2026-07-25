import { createFileRoute, Outlet } from "@tanstack/react-router";

// Acesso liberado para qualquer usuário autenticado. As RLS filtram os
// contratos por dono do condomínio; super admin recebe leitura ampla.
export const Route = createFileRoute("/_authenticated/app/contratos")({
  component: () => <Outlet />,
});