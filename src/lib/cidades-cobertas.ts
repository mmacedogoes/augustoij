/**
 * Whitelist e normalização de cidades cobertas pela legislação local.
 * Estas três cidades da PB já estão com legislação municipal indexada — não
 * geram alerta para o super admin nem disclaimer para o usuário.
 */
export const CIDADES_WHITELIST: ReadonlySet<string> = new Set([
  "joao pessoa|PB",
  "cabedelo|PB",
  "campina grande|PB",
]);

export function slugCidade(cidade: string, uf: string): string {
  const c = (cidade ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const u = (uf ?? "").trim().toUpperCase();
  return `${c}|${u}`;
}

export function isCidadeWhitelist(cidade: string, uf: string): boolean {
  return CIDADES_WHITELIST.has(slugCidade(cidade, uf));
}