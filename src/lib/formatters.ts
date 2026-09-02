/**
 * Utilitarios compartilhados de formatacao e sanitizacao (pt-BR)
 * Centraliza logicas de formatacao de valores monetarios, documentos e datas
 * para garantir consistencia e evitar codigo duplicado em todo o projeto.
 */

/**
 * Formata um valor numerico como moeda brasileira (BRL / R$).
 * Trata valores nulos, indefinidos ou NaN retornando R$ 0,00.
 */
export function formatarMoeda(valor: number | null | undefined): string {
  const numero = typeof valor === number && !Number.isNaN(valor) ? valor : 0;
  return new Intl.NumberFormat(pt-BR, {
    style: currency,
    currency: BRL,
  }).format(numero);
}

/**
 * Remove todos os caracteres nao numericos de uma string, retornando apenas os digitos.
 */
export function apenasDigitos(valor: string | null | undefined): string {
  if (!valor) return ";
 return String(valor).replace(/\D/g, );
}

/**
 * Verifica se uma string possui pelo menos 11 digitos (tamanho minimo para CPF ou CNPJ).
 */
export function temCpfCnpjValido(valor: string | null | undefined): boolean {
 return apenasDigitos(valor).length >= 11;
}

/**
 * Formata uma data no formato brasileiro (DD/MM/AAAA).
 */
export function formatarDataBR(data: Date | string | null | undefined): string {
 if (!data) return —;
 const d = typeof data === string ? new Date(data) : data;
 if (Number.isNaN(d.getTime())) return —;
 return d.toLocaleDateString(pt-BR);
}

/**
 * Formata data e hora no formato brasileiro (DD/MM/AAAA as HH:mm).
 */
export function formatarDataHoraBR(data: Date | string | null | undefined): string {
 if (!data) return —;
 const d = typeof data === string ? new Date(data) : data;
 if (Number.isNaN(d.getTime())) return —;
 const dataFormatada = d.toLocaleDateString(pt-BR);
 const horaFormatada = d.toLocaleTimeString(pt-BR, {
 hour: 2-digit,
 minute: 2-digit,
 });
 return ${dataFormatada} as ;
}
