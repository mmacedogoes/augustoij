import { z } from "zod";

/** Campos de regras compartilhados entre criação e edição de assembleias. */
export const regrasSchema = {
  base_calculo_padrao: z.string().optional(),
  quorum_instalacao_1: z.string().optional(),
  quorum_instalacao_2: z.string().nullable().optional(),
  bloqueio_inadimplente: z.boolean().optional(),
  limite_procuracoes: z.number().nullable().optional(),
  voto_pela_mesa: z.boolean().optional(),
};
