import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { HelpdeskConversa } from "@/components/helpdesk/HelpdeskConversa";

export const Route = createFileRoute("/_authenticated/app/suporte/$ticketId")({
  component: SuporteTicketPage,
});

function SuporteTicketPage() {
  const { ticketId } = Route.useParams();
  return (
      <div className="max-w-3xl">
        <HelpdeskConversa ticketId={ticketId} voltarHref="/app/conta#suporte" />
      </div>
  );
}