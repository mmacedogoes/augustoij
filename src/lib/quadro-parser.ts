/**
 * Parser determinístico de quadros (tabelas Markdown) de convenções.
 *
 * Quando o quadro de áreas e frações já está transcrito em Markdown com
 * cabeçalho, não é preciso IA nenhuma: as colunas são mapeadas por
 * palavra-chave e as linhas viram exatamente a mesma estrutura que a IA
 * devolveria (`UnidadeExtraida[]`), reaproveitando toda a consolidação.
 */
import type { UnidadeExtraida } from "./unidades-extracao.server";

type Medida = NonNullable<UnidadeExtraida["medidas"]>[number];
type CampoMedida = Medida["campo"];

export type ChunkParser = {
  id: string;
  conteudo: string;
  metadata: {
    bloco?: number;
    pagina_inicio?: number;
    pagina_fim?: number;
  } | null;
};

export type ResultadoQuadro = {
  unidades: UnidadeExtraida[];
  chunksResolvidos: Set<string>;
  linhasLidas: number;
};

const sem = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const ehLinhaTabela = (linha: string) => /^\s*\|.*\|\s*$/.test(linha);
const ehSeparador = (linha: string) => /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/.test(linha);

function celulas(linha: string) {
  return linha
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

type Coluna =
  | { tipo: "medida"; campo: CampoMedida; percentualNoCabecalho: boolean; areaEmM2: boolean }
  | { tipo: "identificador" }
  | { tipo: "bloco" }
  | { tipo: "ignorar" };

export function classificarColuna(cabecalho: string): Coluna {
  const t = sem(cabecalho);
  if (!t) return { tipo: "ignorar" };
  const percentual = /%|percent/.test(t);
  if (/(bloco|torre|quadra)/.test(t) && !/fracao|area/.test(t)) return { tipo: "bloco" };
  if (/(unidade|unid|apto|apartamento|apart|n\.?o?\b|numero|lote|sala|loja|casa|imovel)/.test(t) && !/area|fracao|coeficiente/.test(t))
    return { tipo: "identificador" };
  const medida = (campo: CampoMedida, areaEmM2: boolean): Coluna => ({
    tipo: "medida",
    campo,
    percentualNoCabecalho: percentual,
    areaEmM2,
  });
  if (/(fracao|fracao ideal|ideal)/.test(t) && /(comum|coisas comuns)/.test(t))
    return medida("fracao_coisas_comuns", false);
  if (/(coeficiente|rateio)/.test(t)) return medida("coeficiente_rateio", false);
  if (/(fracao|ideal|permilagem|milesim)/.test(t)) return medida("fracao_terreno", false);
  if (/equivalente/.test(t)) return medida("area_equivalente", true);
  if (/(privativa|exclusiva|util)/.test(t)) return medida("area_privativa", true);
  if (/comum/.test(t)) return medida("area_comum", true);
  if (/(global|total|real total)/.test(t)) return medida("area_global", true);
  if (/area/.test(t)) return medida("indeterminado", true);
  return { tipo: "ignorar" };
}

const REGEX_TITULO_BLOCO = /\b(?:bloco|torre|quadra)\s+([a-z0-9]{1,3})\b/i;
const REGEX_NUMERO = /^([a-z]{0,3}\.?\s*)?(\d{1,5})\s*([a-z]{0,2})$/i;

function escalaDaCelula(valor: string, percentualNoCabecalho: boolean): Medida["escala"] {
  if (/\//.test(valor)) return "fracao_ordinaria";
  if (/%/.test(valor)) return "percentual";
  if (/‰|mil[eé]sim/i.test(valor)) return "milesimo";
  return percentualNoCabecalho ? "percentual" : "decimal";
}

/** Lê todas as tabelas Markdown dos trechos indexados. */
export function extrairUnidadesDeQuadros(chunks: ChunkParser[]): ResultadoQuadro {
  const unidades: UnidadeExtraida[] = [];
  const chunksResolvidos = new Set<string>();
  let linhasLidas = 0;

  for (const chunk of chunks) {
    const linhas = chunk.conteudo.split("\n");
    let colunas: Coluna[] | null = null;
    let blocoContexto: string | null = null;
    let resolveuAlgo = false;

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const titulo = REGEX_TITULO_BLOCO.exec(linha);
      if (titulo && !ehLinhaTabela(linha)) blocoContexto = titulo[1].toUpperCase();
      if (!ehLinhaTabela(linha)) continue;
      if (ehSeparador(linha)) continue;
      if (ehSeparador(linhas[i + 1] ?? "")) {
        colunas = celulas(linha).map(classificarColuna);
        continue;
      }
      if (!colunas) continue;
      const valores = celulas(linha);
      if (valores.length < 2) continue;
      let numero: string | null = null;
      let bloco: string | null = blocoContexto;
      const medidas: Medida[] = [];
      for (let c = 0; c < valores.length && c < colunas.length; c++) {
        const coluna = colunas[c];
        const valor = valores[c];
        if (!valor || /^-+$/.test(valor)) continue;
        if (coluna.tipo === "identificador") {
          const m = REGEX_NUMERO.exec(valor.replace(/\s+/g, " ").trim());
          if (m) {
            numero = m[2];
            if (m[3]) bloco = m[3].toUpperCase();
          }
          continue;
        }
        if (coluna.tipo === "bloco") {
          const limpo = valor.replace(/(bloco|torre|quadra|bl\.?|qd\.?)/gi, "").trim();
          if (limpo) bloco = limpo.toUpperCase();
          continue;
        }
        if (coluna.tipo !== "medida") continue;
        if (!/\d/.test(valor)) continue;
        medidas.push({
          campo: coluna.campo,
          valor_bruto: valor.replace(/m²|m2/gi, "").trim(),
          escala: coluna.areaEmM2 ? "m2" : escalaDaCelula(valor, coluna.percentualNoCabecalho),
          trecho: linha.trim(),
          pagina: chunk.metadata?.pagina_inicio ?? null,
          bloco: chunk.metadata?.bloco ?? null,
          fonte: `quadro; trecho ${chunk.id}`,
          bloco_contexto: blocoContexto,
        });
      }
      if (!numero || medidas.length === 0) continue;
      unidades.push({ bloco, numero, medidas, fonte: `quadro; trecho ${chunk.id}` });
      linhasLidas++;
      resolveuAlgo = true;
    }
    if (resolveuAlgo) chunksResolvidos.add(chunk.id);
  }

  return { unidades, chunksResolvidos, linhasLidas };
}
