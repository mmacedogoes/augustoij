// Utilidades client-safe: máscaras, formatação e helpers de data / moeda.

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D+/g, "");
}

export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskCpfCnpj(v: string): string {
  const d = onlyDigits(v);
  return d.length <= 11 ? maskCpf(v) : maskCnpj(v);
}

export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskTelefone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

/** Formata número como BRL (R$ 1.234,56). */
export function formatBRL(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Converte string de moeda BRL digitada pelo usuário para number.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56".
 */
export function parseBRL(v: string): number | null {
  if (v === null || v === undefined) return null;
  const raw = String(v).replace(/[^\d,.-]/g, "").trim();
  if (!raw) return null;
  // Se tem ',' presume-se separador decimal pt-BR
  const norm = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Formata Date/ISO como dd/MM/aaaa (pt-BR). Aceita null. */
export function formatDateBR(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Converte "YYYY-MM-DD" para ISO ou null. */
export function dateInputToIso(v: string | null | undefined): string | null {
  if (!v) return null;
  return v; // Postgres DATE aceita "YYYY-MM-DD" direto
}