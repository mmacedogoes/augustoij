/**
 * src/lib/extracao/rotulos.ts
 *
 * Famílias de rótulos e extrator determinístico de medidas em textos de registros.
 */

export type FamiliaRotulo =
  | "area_privativa"
  | "area_comum"
  | "area_total"
  | "area_equivalente"
  | "area_terreno"
  | "fracao_ideal"
  | "vagas";

export type MedidaLida = {
  campo: FamiliaRotulo;
  rotulo_encontrado: string;
  valor_bruto: string;
  valor_numerico: number | null;
  unidade_medida: string | null;
  escala?: "m2" | "percentual" | "decimal" | "milesimo" | "inteiro";
  trecho: string;
  inicio: number;
  fim: number;
};

/**
 * Famílias de rótulos com várias redações típicas de convenções condominiais.
 */
export const PADROES_FAMILIAS: Record<FamiliaRotulo, RegExp[]> = {
  area_privativa: [
    /[áa]rea\s+(?:real\s+)?(?:de\s+constru[çc][ãa]o\s+)?privativa(?:\s+real)?/i,
    /[áa]rea\s+(?:privativa|[úu]til|exclusiva)(?:\s+coberta)?/i,
  ],
  area_comum: [
    /[áa]rea\s+(?:real\s+)?(?:de\s+constru[çc][ãa]o\s+)?(?:de\s+)?uso\s+comum(?:\s+real)?/i,
  ],
  area_total: [
    /[áa]rea\s+(?:real\s+)?(?:de\s+constru[çc][ãa]o\s+)?(?:real\s+)?total/i,
    /[áa]rea\s+global/i,
  ],
  area_equivalente: [
    /[áa]rea\s+equivalente(?:\s+de\s+constru[çc][ãa]o)?/i,
  ],
  area_terreno: [
    /[áa]rea\s+(?:do\s+)?(?:terreno|lote|solo)/i,
  ],
  fracao_ideal: [
    /fra[çc][ãa]o\s+ideal/i,
    /coeficiente\s+de\s+(?:rateio|propriedade)/i,
    /permilagem/i,
    /mil[ée]simos/i,
  ],
  vagas: [
    /(\d+)\s*(?:\([^)]*\))?\s*vagas?\s+de\s+garagem/i,
  ],
};

/**
 * Converte valor numérico brasileiro (com ponto de milhar e vírgula decimal)
 * considerando escalas e unidades como %, ‰, m², etc.
 */
export function converterValorPtBr(
  bruto: string,
  unidade?: string | null,
): {
  numerico: number | null;
  escala: "m2" | "percentual" | "decimal" | "milesimo" | "inteiro";
} {
  const limpo = bruto.trim().replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const num = Number(limpo);
  if (!Number.isFinite(num)) {
    return { numerico: null, escala: "decimal" };
  }

  const u = (unidade ?? "").toLowerCase();
  if (u.includes("%")) {
    return { numerico: num / 100, escala: "percentual" };
  }
  if (u.includes("‰") || u.includes("mil") || u.includes("permil")) {
    return { numerico: num / 1000, escala: "milesimo" };
  }
  if (u.includes("m") || u.includes("m²") || u.includes("m2")) {
    return { numerico: num, escala: "m2" };
  }
  return { numerico: num, escala: "decimal" };
}

/**
 * Captura medidas associadas a uma família em um texto de registro.
 * Aceita:
 * (a) rótulo seguido de pontilhado e valor: "ÁREA REAL PRIVATIVA......75,90 m²"
 * (b) rótulo embutido na prosa com "de":   "uma Área de construção privativa real de 75,90 m2"
 */
function capturarMedidasFamilia(
  texto: string,
  campo: FamiliaRotulo,
  padroes: RegExp[],
): MedidaLida[] {
  const medidas: MedidaLida[] = [];

  // Tratamento especial para vagas (onde o número normalmente vem antes da palavra 'vagas')
  if (campo === "vagas") {
    // 1. "4 (quatro) vagas de garagem" ou "2 vagas de garagem"
    const reVagasAntes =
      /(\d+)\s*(?:\([^)]*\))?\s*vagas?\s+(?:de\s+garagem|de\s+estacionamento|para\s+ve[íi]culos?)?/gi;
    let m: RegExpExecArray | null;
    while ((m = reVagasAntes.exec(texto)) !== null) {
      const valorNum = Number(m[1]);
      if (Number.isFinite(valorNum)) {
        medidas.push({
          campo: "vagas",
          rotulo_encontrado: "vagas de garagem",
          valor_bruto: m[1],
          valor_numerico: valorNum,
          unidade_medida: "vagas",
          escala: "inteiro",
          trecho: m[0].trim(),
          inicio: m.index,
          fim: m.index + m[0].length,
        });
      }
    }

    // 2. "vagas de garagem: 2" ou "vagas: 2"
    const reVagasDepois =
      /vagas?\s*(?:de\s+garagem)?[\s.:\-–—]*(?:de\s+)?(\d+)/gi;
    while ((m = reVagasDepois.exec(texto)) !== null) {
      const valorNum = Number(m[1]);
      if (Number.isFinite(valorNum)) {
        medidas.push({
          campo: "vagas",
          rotulo_encontrado: "vagas de garagem",
          valor_bruto: m[1],
          valor_numerico: valorNum,
          unidade_medida: "vagas",
          escala: "inteiro",
          trecho: m[0].trim(),
          inicio: m.index,
          fim: m.index + m[0].length,
        });
      }
    }

    return medidas;
  }

  // Para medidas numéricas de áreas e frações:
  // Conector aceita pontilhado, dois-pontos, traços, espaços ou preposições de prosa ('de', 'do', 'no valor de', etc.)
  const CONECTOR =
    /(?:[\s.:\-–—]+|\s+(?:de|do|da|no\s+valor\s+de|correspondente\s+a|equivalente\s+a|igual\s+a)\s+)*/;
  // Valor aceita formato pt-BR: 1.250,75 ou 75,90 ou 0,033395 ou inteiros
  const VALOR =
    /(\d{1,3}(?:\.\d{3})*,\d+|\d+,\d+|\d+\.\d+|\d+)/;
  // Unidade de medida opcional: m2, m², %, ‰, milésimos, permilagem
  const UNIDADE =
    /(?:\s*(m[²2]|%|‰|mil[ée]simos?|permilagem))?/;

  for (const padrao of padroes) {
    const regexCompleta = new RegExp(
      "(" + padrao.source + ")" +
      CONECTOR.source +
      VALOR.source +
      UNIDADE.source +
      "(?![a-zA-Z0-9])",
      "gi"
    );

    let m: RegExpExecArray | null;
    while ((m = regexCompleta.exec(texto)) !== null) {
      const trechoCompleto = m[0].trim();
      const rotuloEncontrado = m[1].trim();
      const valorBruto = m[2];
      const unidade = m[3] || null;

      const { numerico, escala } = converterValorPtBr(valorBruto, unidade);

      medidas.push({
        campo,
        rotulo_encontrado: rotuloEncontrado,
        valor_bruto: valorBruto,
        valor_numerico: numerico,
        unidade_medida: unidade,
        escala,
        trecho: trechoCompleto,
        inicio: m.index,
        fim: m.index + m[0].length,
      });
    }
  }

  return medidas;
}

/**
 * Lê todas as medidas de um registro aplicando as famílias de rótulos
 * diretamente ao texto completo do registro (não por linha).
 */
export function lerRegistro(registro: { texto: string } | string): MedidaLida[] {
  const texto = typeof registro === "string" ? registro : registro.texto;
  if (!texto || !texto.trim()) return [];

  const todasMedidas: MedidaLida[] = [];

  for (const [campoStr, padroes] of Object.entries(PADROES_FAMILIAS)) {
    const campo = campoStr as FamiliaRotulo;
    const medidas = capturarMedidasFamilia(texto, campo, padroes);
    todasMedidas.push(...medidas);
  }

  // Ordena por posição no texto
  todasMedidas.sort((a, b) => a.inicio - b.inicio);

  // Remove sobreposições exatas de mesmo campo
  const unicas: MedidaLida[] = [];
  for (const med of todasMedidas) {
    const sobreposta = unicas.find(
      (u) =>
        u.campo === med.campo &&
        Math.abs(u.inicio - med.inicio) < 5
    );
    if (!sobreposta) {
      unicas.push(med);
    }
  }

  return unicas;
}

/**
 * Expande listas de identificadores que contêm intervalos.
 * Exemplo: "101 a 104, 201 a 204" -> ["101", "102", "103", "104", "201", "202", "203", "204"]
 * Aceita "a", "até", "ao", "-" e "–" como separador de intervalo.
 * Exige que os extremos tenham o mesmo número de dígitos.
 */
export function expandirIntervalos(texto: string): string[] {
  if (!texto || !texto.trim()) return [];

  // Separa itens por vírgula, ponto-e-vírgula ou ' e '
  const partes = texto.split(/[,;]|\se\s/i).map((p) => p.trim()).filter(Boolean);
  const resultado: string[] = [];

  // Regex de intervalo: número (+ sufixo opcional) + separador + número (+ sufixo opcional)
  const regexIntervalo =
    /^n?[º°o]?\.?\s*(\d{1,5})\s*([A-Za-z])?\s*(?:a|at[ée]|ao|[-–—])\s*n?[º°o]?\.?\s*(\d{1,5})\s*([A-Za-z])?$/i;
  
  // Regex de item único
  const regexUnico = /^n?[º°o]?\.?\s*(\d{1,5})\s*([A-Za-z])?$/i;

  for (const parte of partes) {
    const mInterv = regexIntervalo.exec(parte);
    if (mInterv) {
      const numInicioStr = mInterv[1];
      const sufixoInicio = (mInterv[2] ?? "").toUpperCase();
      const numFimStr = mInterv[3];
      const sufixoFim = (mInterv[4] ?? sufixoInicio ?? "").toUpperCase();

      // Exige que os extremos tenham o mesmo número de dígitos
      if (numInicioStr.length === numFimStr.length) {
        const inicio = Number(numInicioStr);
        const fim = Number(numFimStr);

        if (Number.isFinite(inicio) && Number.isFinite(fim) && inicio <= fim && fim - inicio <= 500) {
          const len = numInicioStr.length;
          const sufixo = sufixoFim || sufixoInicio;
          for (let n = inicio; n <= fim; n++) {
            resultado.push(`${String(n).padStart(len, "0")}${sufixo}`);
          }
          continue;
        }
      }
    }

    // Se não for intervalo válido, tenta como item único
    const mUnico = regexUnico.exec(parte);
    if (mUnico) {
      const num = mUnico[1];
      const sufixo = (mUnico[2] ?? "").toUpperCase();
      resultado.push(`${num}${sufixo}`);
    }
  }

  return [...new Set(resultado)];
}