import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { HelpdeskConversa } from "@/components/helpdesk/HelpdeskConversa";

export const Route = createFileRoute("/_authenticated/app/admin/helpdesk/$ticketId")({
  component: AdminHelpdeskTicketPage,
});

function AdminHelpdeskTicketPage() {
  const { ticketId } = Route.useParams();
  return (
    <AppShell>
      <div className="max-w-4xl">
        <AdminNav />
        <HelpdeskConversa ticketId={ticketId} voltarHref="/app/admin/helpdesk" isAdmin />
      </div>
    </AppShell>
  );
}