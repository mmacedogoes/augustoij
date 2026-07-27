import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  origem: z.string().trim().max(64).optional(),
});

export const subscribeContratosWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient<Database>(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { error } = await supabase
      .from("contratos_waitlist")
      .insert({ email: data.email, origem: data.origem ?? "landing-page" });

    // Duplicate email is treated as success (idempotent).
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true as const };
  });
