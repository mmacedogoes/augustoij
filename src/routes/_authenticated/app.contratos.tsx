import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isCurrentUserAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/contratos")({
  component: () => <Outlet />,
  beforeLoad: async () => {
    const r = await isCurrentUserAdmin();
    if (r?.papel !== "super_admin") throw redirect({ to: "/app" });
  },
});