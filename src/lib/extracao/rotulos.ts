/**
 * src/lib/extracao/rotulos.ts
 *
 * Famílias de rótulos e extrator determinístico de medidas em textos de registros.
 */

export type FamiliaRotulo =
  | "area_privativa"
  | "area_privativa_total"
  | "area_garagem"
  | "area_comum"
  | "area_total"
  | "area_construcao"
  | "area_equivalente"
  | "cota_terreno"
  | "fracao_ideal"
  | "area_terreno"
  | "vagas"
  | "area_generica";

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
 * Famílias em ordem estrita de prioridade (a mais específica primeiro).
 * area_privativa_total vem ANTES de area_privativa.
 * area_garagem vem ANTES de area_comum para capturar "Área de Uso Comum (... Garagem)".
 */
export const FAMILIAS_ORDENADAS: [FamiliaRotulo, RegExp][] = [
  [
    "area_privativa_total",
    /[áa]rea\s+(?:real\s+)?(?:privativa|priv\.?)\s+total|[áa]rea\s+total\s+(?:real\s+)?(?:privativa|priv\.?)/i,
  ],
  [
    "area_garagem",
    /[áa]rea\s+(?:real\s+)?(?:de\s+)?(?:uso\s+)?(?:privativ[oa]|priv\.?)\s+acess[óo]ria|[áa]rea[^|]*\bgaragem\b|[áa]rea\s+de\s+vagas?/i,
  ],
  [
    "area_privativa",
    /[áa]rea\s+(?:real\s+)?(?:de\s+)?(?:uso\s+)?(?:privativ[oa]|priv\.?|exclusiv[oa]|[úu]til)(?:\s*\(\s*principal\s*\))?(?:\s+real)?(?:\s+de\s+constru[çc][ãa]o)?/i,
  ],
  [
    "area_comum",
    /[áa]rea\s+(?:real\s+)?(?:de\s+)?uso\s+comum(?:\s+real)?|[áa]rea\s+comum(?:\s+real)?/i,
  ],
  [
    "area_total",
    /[áa]rea\s+(?:real\s+)?total|[áa]rea\s+global/i,
  ],
  [
    "area_construcao",
    /[áa]rea\s+d[ae]\s+unidade(?:\s*\(?\s*de\s+constru[çc][ãa]o\s*\)?)?|[áa]rea\s+de\s+constru[çc][ãa]o\s+da\s+unidade/i,
  ],
  [
    "area_equivalente",
    /[áa]rea\s+equivalente/i,
  ],
  [
    "cota_terreno",
    /cota\s+(?:ideal|parte)\s+do\s+terreno/i,
  ],
  [
    "fracao_ideal",
    /fra[çc][ãa]o\s+ideal(?:\s+(?:do\s+terreno|de\s+terreno\s+e\s+(?:coisas|partes)\s+comuns?|no\s+terreno|das\s+coisas\s+comuns?))?|coef(?:iciente|\.)?\s+de\s+proporcionalidade|(?:quota|cota)(?:-|\s+)parte\s+ideal|(?:quota|cota|parte)\s+ideal|permilagem|mil[ée]simos/i,
  ],
  [
    "area_terreno",
    /[áa]rea\s+(?:real\s+)?(?:de|do|da)?\s*(?:terreno|lote|solo)\b/i,
  ],
];

export const NUMERO = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:,\d+)?$/;

/**
 * Leitor determinístico de linha no formato de tabela | rótulo | valor | unidade |.
 * Prioritário sobre heurísticas de prosa e sem guarda contemOutraFamilia.
 */
export function lerLinhaTabela(linha: string): {
  campo: FamiliaRotulo | "indeterminado";
  valor_bruto: string;
  unidade: string | null;
  rotulo: string;
} | null {
  if (!/\|/.test(linha)) return null;
  const c = linha
    .split("|")
    .map((s) => s.trim())
    .filter((s, i, a) => !(s === "" && (i === 0 || i === a.length - 1)));
  for (let i = 1; i < c.length; i++) {
    const mNum = c[i].match(/^([-+]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[-+]?\d+(?:,\d+)?)(?:\s*([^\d\s].*))?$/);
    if (!mNum) continue;
    const valor_bruto = mNum[1];
    let unidade = mNum[2]?.trim() || (c[i + 1] && c[i + 1].trim() ? c[i + 1].trim() : null);
    const rotulo = c[i - 1].replace(/^[-–—\s]+/, "");
    if (!unidade && /m[²2]|metros?\s+quadrados?/i.test(rotulo)) {
      unidade = "m²";
    }
    for (const [campo, re] of FAMILIAS_ORDENADAS) {
      if (re.test(rotulo)) {
        return {
          campo,
          valor_bruto,
          unidade,
          rotulo,
        };
      }
    }
    return {
      campo: "indeterminado",
      valor_bruto,
      unidade,
      rotulo,
    };
  }
  return null;
}

/**
 * Famílias de rótulos com várias redações típicas de convenções condominiais.
 */
export const PADROES_FAMILIAS: Record<FamiliaRotulo, RegExp[]> = {
  area_privativa_total: [
    /[áa]rea\s+(?:real\s+)?(?:privativa|priv\.?)\s+total/i,
    /[áa]rea\s+total\s+(?:real\s+)?(?:privativa|priv\.?)/i,
  ],
  area_privativa: [
    /[áa]rea\s+(?:real\s+)?(?:de\s+)?(?:uso\s+)?(?:privativ[oa]|priv\.?|exclusiv[oa]|[úu]til)(?!\s+(?:total|acess[óo]ria))\b(?:\s*\(\s*principal\s*\))?(?:\s+real)?(?:\s+de\s+constru[çc][ãa]o)?/i,
    /[áa]rea\s+(?:real\s+)?(?:de\s+constru[çc][ãa]o\s+)?privativa(?!\s+(?:total|acess[óo]ria))\b(?:\s+real)?/i,
    /[áa]rea\s+(?:privativa|priv\.?|[úu]til|exclusiva)(?!\s+(?:total|acess[óo]ria))\b(?:\s+coberta)?/i,
  ],
  area_garagem: [
    /[áa]rea\s+(?:real\s+)?(?:de\s+)?(?:uso\s+)?(?:privativ[oa]|priv\.?)\s+acess[óo]ria/i,
    /[áa]rea[^|]*\bgaragem\b|[áa]rea\s+de\s+vagas?/i,
    /[áa]rea\s+(?:real\s+)?(?:de\s+)?(?:garagem|vaga|estacionamento)/i,
  ],
  area_comum: [
    /[áa]rea\s+(?:real\s+)?(?:de\s+)?uso\s+comum(?:\s+real)?|[áa]rea\s+comum(?:\s+real)?/i,
    /[áa]rea\s+(?:real\s+)?(?:de\s+constru[çc][ãa]o\s+)?(?:de\s+)?uso\s+comum(?:\s+real)?/i,
  ],
  area_total: [
    /[áa]rea\s+(?:real\s+)?total|[áa]rea\s+global/i,
    /[áa]rea\s+(?:real\s+)?(?:de\s+constru[çc][ãa]o\s+)?(?:real\s+)?total/i,
  ],
  area_construcao: [
    /[áa]rea\s+d[ae]\s+unidade(?:\s*\(?\s*de\s+constru[çc][ãa]o\s*\)?)?|[áa]rea\s+de\s+constru[çc][ãa]o\s+da\s+unidade/i,
  ],
  area_equivalente: [
    /[áa]rea\s+equivalente(?:\s+de\s+constru[çc][ãa]o)?/i,
  ],
  cota_terreno: [
    /cota\s+(?:ideal|parte)\s+do\s+terreno/i,
  ],
  fracao_ideal: [
    /fra[çc][ãa]o\s+ideal(?:\s+(?:do\s+terreno|de\s+terreno\s+e\s+(?:coisas|partes)\s+comuns?|no\s+terreno|das\s+coisas\s+comuns?))?/i,
    /coef(?:iciente|\.)?\s+de\s+proporcionalidade/i,
    /(?:quota|cota)(?:-|\s+)parte\s+ideal/i,
    /(?:quota|cota|parte)\s+ideal/i,
    /permilagem/i,
    /mil[ée]simos/i,
  ],
  area_terreno: [
    /[áa]rea\s+(?:real\s+)?(?:privativa\s+)?(?:de|do|da)?\s*(?:terreno|lote|solo|gleba)\b/i,
    /[áa]rea\s+total\s+(?:do\s+|de\s+)?(?:terreno|lote)/i,
  ],
  vagas: [
    /(\d+|uma|um|duas|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez)\s*(?:\([^)]*\))?\s*vagas?\s+(?:de\s+)?(?:garagens?|estacionamento)/i,
  ],
  area_generica: [
    /(?:com\s+)?[áa]rea\s+(?:total\s+)?de(?=\s*[\d.])/i,
    /medindo(?=\s*[\d.])/i,
  ],
};

const MAPA_NUMEROS_EXTENSO: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

export function converterNumeroOuExtenso(val: string): number | null {
  const limpo = val.trim().toLowerCase();
  if (MAPA_NUMEROS_EXTENSO[limpo] !== undefined) {
    return MAPA_NUMEROS_EXTENSO[limpo];
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

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

  // Tratamento especial para vagas (onde o número normalmente vem antes da palavra 'vagas' ou em algarismo/extenso)
  if (campo === "vagas") {
    // 1. "duas vagas de garagens descobertas", "4 (quatro) vagas de garagem", "2 vagas"
    const NUM_OU_EXTENSO = "(\\d+|uma|um|duas|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez)";
    const reVagasAntes = new RegExp(
      `${NUM_OU_EXTENSO}\\s*(?:\\([^)]*\\))?\\s*vagas?\\s+(?:de\\s+)?(?:garagens?|estacionamento|para\\s+ve[íi]culos?)?(?:\\s+descobertas?|\\s+cobertas?|\\s+privativas?)?`,
      "gi"
    );
    let m: RegExpExecArray | null;
    while ((m = reVagasAntes.exec(texto)) !== null) {
      const valorNum = converterNumeroOuExtenso(m[1]);
      if (valorNum != null) {
        medidas.push({
          campo: "vagas",
          rotulo_encontrado: "vagas de garagem",
          valor_bruto: String(valorNum),
          valor_numerico: valorNum,
          unidade_medida: "vagas",
          escala: "inteiro",
          trecho: m[0].trim(),
          inicio: m.index,
          fim: m.index + m[0].length,
        });
      }
    }

    // 2. "vagas de garagem: 2" ou "vagas: duas"
    const reVagasDepois = new RegExp(
      `vagas?\\s*(?:de\\s+garagens?)?[\\s.:\\-–—]*(?:de\\s+)?${NUM_OU_EXTENSO}`,
      "gi"
    );
    while ((m = reVagasDepois.exec(texto)) !== null) {
      const valorNum = converterNumeroOuExtenso(m[1]);
      if (valorNum != null) {
        medidas.push({
          campo: "vagas",
          rotulo_encontrado: "vagas de garagem",
          valor_bruto: String(valorNum),
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

  function contemOutraFamilia(lacuna: string, campoAtual: FamiliaRotulo): boolean {
    // Na captura em prosa, rejeita se a lacuna contiver um rótulo COMPLETO de outra família.
    // Nunca rejeita por palavras soltas como "terreno" ou "garagem".
    for (const [campo, re] of FAMILIAS_ORDENADAS) {
      if (campo === campoAtual) continue;
      if (campo === "vagas" || campo === "area_generica") continue;
      if (re.test(lacuna)) return true;
    }
    return false;
  }

  // Para medidas numéricas de áreas e frações:
  // Lacuna: conector ou até 30 caracteres não numéricos (sem vírgula, ponto-e-vírgula ou quebra de linha)
  const LACUNA_SRC = "(?:[\\s.:\\-–—]+|\\s+(?:de|do|da|no\\s+valor\\s+de|correspondente\\s+a|equivalente\\s+a|igual\\s+a)\\s+|[^0-9,;\\n]{0,30}?)";
  // Valor aceita formato pt-BR: 1.250,75 ou 75,90 ou 0,033395 ou inteiros
  const VALOR_SRC = "(\\d{1,3}(?:\\.\\d{3})*,\\d+|\\d+,\\d+|\\d+\\.\\d+|\\d+)";
  // Unidade de medida opcional: m2, m², %, ‰, milésimos, permilagem, e aceita "m2 de área"
  const UNIDADE_SRC = "(?:\\s*(m[²2]|%|‰|mil[ée]simos?|permilagem))?(?:\\s+de\\s+[áa]rea)?";

  for (const padrao of padroes) {
    const regexCompleta = new RegExp(
      "(?<rotulo>" + padrao.source + ")" +
      "(?<lacuna>" + LACUNA_SRC + ")" +
      "(?<valor>" + VALOR_SRC + ")" +
      "(?<unidade>" + UNIDADE_SRC + ")" +
      "(?![a-zA-Z0-9])",
      "gi"
    );

    let m: RegExpExecArray | null;
    while ((m = regexCompleta.exec(texto)) !== null) {
      const rotuloEncontrado = (m.groups?.rotulo ?? "").trim();
      const lacuna = m.groups?.lacuna ?? "";
      const valorBruto = m.groups?.valor ?? "";
      const unidade = m.groups?.unidade || null;

      if (!valorBruto) continue;

      // Um número só vale como área se vier com "m²", "m2" ou "metros quadrados". "garagem 2" não é área.
      if (campo.startsWith("area_") && (!unidade || !/m[²2]|metros?\s+quadrados?/i.test(unidade))) {
        continue;
      }

      // Rótulo pontilhado aceita lacuna arbitrária de pontos/espaços; prosa limita em 30 caracteres
      const isPontilhado = /^[\s.:\-–—]+$/.test(lacuna);
      if (!isPontilhado && lacuna.length > 30) {
        continue;
      }
      if (contemOutraFamilia(lacuna, campo)) {
        continue;
      }

      const trechoCompleto = m[0].trim();
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
 * Lê todas as medidas de um registro aplicando as famílias de rótulos:
 * 1. Prioritariamente por linha de tabela (| rótulo | valor | unidade |)
 * 2. Em prosa para trechos não tabulares (preservando índices exatos)
 */
export function lerRegistro(registro: { texto: string } | string): MedidaLida[] {
  const texto = typeof registro === "string" ? registro : registro.texto;
  if (!texto || !texto.trim()) return [];

  const todasMedidas: MedidaLida[] = [];

  // 1. Linhas de tabela (| rótulo | valor | unidade |) - Prioritárias sobre heurísticas de prosa
  const linhas = texto.split(/\r?\n/);
  const linhasTabelaIdx = new Set<number>();
  let offset = 0;

  for (let idx = 0; idx < linhas.length; idx++) {
    const linha = linhas[idx];
    const medTab = lerLinhaTabela(linha);
    if (medTab) {
      linhasTabelaIdx.add(idx);
      if (medTab.campo !== "indeterminado") {
        const { numerico, escala } = converterValorPtBr(medTab.valor_bruto, medTab.unidade);
        todasMedidas.push({
          campo: medTab.campo,
          rotulo_encontrado: medTab.rotulo,
          valor_bruto: medTab.valor_bruto,
          valor_numerico: numerico,
          unidade_medida: medTab.unidade,
          escala,
          trecho: linha.trim(),
          inicio: offset,
          fim: offset + linha.length,
        });
      }
    }
    offset += linha.length + 1;
  }

  // 2. Prosa: para linhas que não foram tabela, executa heurísticas em prosa.
  // Substitui linhas de tabela por espaços para preservar índices exatos sem interferência.
  const textoProsa = linhas
    .map((linha, idx) => (linhasTabelaIdx.has(idx) ? " ".repeat(linha.length) : linha))
    .join("\n");

  for (const [campoStr, padroes] of Object.entries(PADROES_FAMILIAS)) {
    const campo = campoStr as FamiliaRotulo;
    const medidas = capturarMedidasFamilia(textoProsa, campo, padroes);
    todasMedidas.push(...medidas);
  }

  // Ordena por posição no texto
  todasMedidas.sort((a, b) => a.inicio - b.inicio);

  // Remove sobreposições exatas de mesmo campo ou duplicatas (mesmo valor e mesmo trecho)
  const unicas: MedidaLida[] = [];
  for (const med of todasMedidas) {
    const sobreposta = unicas.find(
      (u) =>
        u.campo === med.campo &&
        (Math.abs(u.inicio - med.inicio) < 5 ||
          (u.valor_bruto === med.valor_bruto && u.trecho === med.trecho))
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