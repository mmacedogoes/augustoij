import type { Database } from "@/integrations/supabase/types";

export type PapelSistema = Database["public"]["Enums"]["papel_sistema"];

export const ADMIN_INTERNO: PapelSistema[] = ["super_admin", "admin_operacional", "admin_suporte"];
export const APENAS_SUPER: PapelSistema[] = ["super_admin"];
export const PODE_BLOG: PapelSistema[] = ["super_admin", "admin_operacional"];
export const PODE_KB: PapelSistema[] = ["super_admin", "admin_operacional"];
export const PODE_CLIENTES: PapelSistema[] = ["super_admin", "admin_suporte"];

export function temPapel(papel: PapelSistema | null | undefined, permitidos: PapelSistema[]): boolean {
  return !!papel && permitidos.includes(papel);
}