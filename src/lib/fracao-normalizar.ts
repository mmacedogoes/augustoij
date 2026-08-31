export type EscalaFracao = "percentual" | "decimal" | "milesimo" | "fracao_ordinaria";

const arredondar8 = (valor: number) => Number(valor.toFixed(8));

/** Converte a escrita numérica brasileira para número, preservando milhares e decimais. */
export function numeroBrasileiro(valor: string): number | null {
  const limpo = valor
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^0-9,./+-]/g, "");
  if (!limpo) return null;
  const fracao = limpo.match(/^([+-]?\d+(?:[.,]\d+)?)\/([+-]?\d+(?:[.,]\d+)?)$/);
  if (fracao) {
    const numerador = numeroBrasileiro(fracao[1]);
    const denominador = numeroBrasileiro(fracao[2]);
    return numerador != null && denominador ? numerador / denominador : null;
  }
  let normalizado = limpo;
  const ultimaVirgula = normalizado.lastIndexOf(",");
  const ultimoPonto = normalizado.lastIndexOf(".");
  if (ultimaVirgula > ultimoPonto) {
    normalizado = normalizado.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula && ultimaVirgula >= 0) {
    normalizado = normalizado.replace(/,/g, "");
  } else if ((normalizado.match(/\./g) ?? []).length > 1) {
    const partes = normalizado.split(".");
    normalizado = `${partes.slice(0, -1).join("")}.${partes.at(-1)}`;
  } else if ((normalizado.match(/,/g) ?? []).length > 1) {
    const partes = normalizado.split(",");
    normalizado = `${partes.slice(0, -1).join("")}.${partes.at(-1)}`;
  } else {
    normalizado = normalizado.replace(",", ".");
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Converte para a fração canônica. NÃO descarta valores fora de [0,1]:
 * a célula do quadro costuma trazer "1,9956" com o "%" apenas no cabeçalho
 * da coluna, e quem decide a escala é `detectarEscalaFracoes`, pelo somatório.
 */
export function normalizarFracao(valorBruto: string, escala: EscalaFracao): number | null {
  const numero = numeroBrasileiro(valorBruto);
  if (numero == null) return null;
  const canonica =
    escala === "percentual" ? numero / 100 : escala === "milesimo" ? numero / 1000 : numero;
  return Number.isFinite(canonica) ? arredondar8(canonica) : null;
}

/** Validação de faixa aplicada somente depois de escolhida a escala global. */
export function fracaoNaFaixa(valor: number | null | undefined): valor is number {
  return valor != null && valor >= 0 && valor <= 1;
}


export function inferirEscalaLiteral(valorBruto: string): EscalaFracao | null {
  if (/\//.test(valorBruto)) return "fracao_ordinaria";
  if (/%/.test(valorBruto)) return "percentual";
  if (/‰|mil[eé]simos?/i.test(valorBruto)) return "milesimo";
  return null;
}

export type HipotesesEscala = Record<"percentual" | "decimal" | "milesimo", number>;

export function detectarEscalaFracoes(valores: string[]): {
  escala: "percentual" | "decimal" | "milesimo" | null;
  somas: HipotesesEscala;
} {
  const numeros = valores.map(numeroBrasileiro).filter((v): v is number => v != null);
  const soma = numeros.reduce((total, valor) => total + valor, 0);
  const somas: HipotesesEscala = {
    percentual: arredondar8(soma / 100),
    decimal: arredondar8(soma),
    milesimo: arredondar8(soma / 1000),
  };
  const candidatas = (Object.entries(somas) as Array<[keyof HipotesesEscala, number]>)
    .filter(([, total]) => Math.abs(total - 1) <= 0.005)
    .sort((a, b) => Math.abs(a[1] - 1) - Math.abs(b[1] - 1));
  return { escala: candidatas.length === 1 ? candidatas[0][0] : null, somas };
}

export function extrairNumerais(texto: string) {
  return (
    texto.match(
      /[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?(?:\s*[%‰]|\s*mil[eé]simos?)?|[+-]?\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?|[+-]?\d+(?:[.,]\d+)?/gi,
    ) ?? []
  );
}

export function dentroTolerancia(a: number, b: number, absoluto: number, relativo = 0.001) {
  return Math.abs(a - b) <= Math.max(absoluto, Math.max(Math.abs(a), Math.abs(b)) * relativo);
}
