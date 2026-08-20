import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";

export const montarEdital = createServerFn({ method: "GET" })
  .inputValidator(z.object({ assembleiaId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data: assembleia, error } = await supabase
      .from("assembleias")
      .select("*, condominio:condominios(*), itens:assembleia_itens(*, opcoes:assembleia_opcoes(*))")
      .eq("id", data.assembleiaId)
      .single();

    if (error || !assembleia) throw new Error("Assembleia não encontrada.");

    // Montagem determinística
    let texto = `${assembleia.condominio.nome.toUpperCase()}\n${assembleia.condominio.endereco || ""}\n\n`;
    texto += `CONVOCAÇÃO DE ASSEMBLEIA ${assembleia.tipo.toUpperCase()}\n\n`;
    
    // ... lógica de montagem segue a ordem especificada ...
    return texto;
  });
