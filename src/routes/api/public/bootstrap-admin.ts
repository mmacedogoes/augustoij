import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          email?: string;
          password?: string;
          secret?: string;
        };
        if (body.secret !== "CondoIA-bootstrap-2026") {
          return new Response("Forbidden", { status: 401 });
        }
        if (!body.email || !body.password) {
          return new Response("Missing fields", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) return new Response(listErr.message, { status: 500 });
        let user = list.users.find(
          (u) => u.email?.toLowerCase() === body.email!.toLowerCase(),
        );

        if (!user) {
          const { data: created, error: createErr } =
            await supabaseAdmin.auth.admin.createUser({
              email: body.email,
              password: body.password,
              email_confirm: true,
            });
          if (createErr) return new Response(createErr.message, { status: 500 });
          user = created.user!;
        } else {
          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: body.password, email_confirm: true },
          );
          if (updErr) return new Response(updErr.message, { status: 500 });
        }

        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: user.id, role: "admin" },
            { onConflict: "user_id,role" },
          );
        if (roleErr) return new Response(roleErr.message, { status: 500 });

        return Response.json({ ok: true, userId: user.id, email: user.email });
      },
    },
  },
});