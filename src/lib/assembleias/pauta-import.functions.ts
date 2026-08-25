import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoAssembleias } from "./guard.server";
import { extrairItensPautaDeArquivo } from "./pauta-import.server";

const importInput = z.object({
  fileBase64: z.string().min(1, "Arquivo vazio"),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().min(1),
  basePadrao: z.string().optional(),
});

export const importarPautaPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => importInput.parse(v))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ensureAcessoAssembleias(context as any);
    return await extrairItensPautaDeArquivo(data);
  });
