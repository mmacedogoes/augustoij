import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoAssembleias } from "./guard.server";
import { extrairItensPautaDeArquivo } from "./pauta-import.server";

const importInput = z.object({
  fileBase64: z.string().min(1, "Arquivo vazio"),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().min(1),
});

export const importarPautaPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => importInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoAssembleias(context as { supabase: unknown; userId: string } as never);
    return await extrairItensPautaDeArquivo(data);
  });
