import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";
export { SERIES_BCB } from "./indices-core";

export const consultarSerieBcb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        serie: z.number().int(),
        anoIni: z.number().int(),
        mesIni: z.number().int().min(1).max(12),
        anoFim: z.number().int(),
        mesFim: z.number().int().min(1).max(12),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { fetchSerieBcb } = await import("./indices-core");
    return fetchSerieBcb(context.supabase, data);
  });