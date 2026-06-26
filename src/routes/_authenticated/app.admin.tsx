import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isCurrentUserAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: () => <Outlet />,
  beforeLoad: async () => {
    const r = await isCurrentUserAdmin();
    if (!r?.admin) throw redirect({ to: "/app" });
  },
});