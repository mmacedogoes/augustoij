/**
 * Parser determinístico de quadros (tabelas Markdown) de convenções.
 *
 * Trabalha sobre o censo de linhas: cada linha convertida em unidade é
 * registrada pelo seu `linha_id`. O parser NUNCA declara um trecho resolvido —
 * ele só marca o que efetivamente leu (invariante 1).
 */
import type { UnidadeExtraida } from "./unidades-extracao.server";
import { tokenizarIdentificador, celulasDaLinha, semAcento, type Censo } from "./censo-linhas";

type Medida = NonNullable<UnidadeExtraida["medidas"]>[number];
type CampoMedida = Medida["campo"];

export type ResultadoQuadro = {
  unidades: UnidadeExtraida[];
  /** `linha_id` de cada linha efetivamente convertida em unidade. */
  linhasLidas: Set<string>;
};

const sem = (texto: string) => semAcento(texto).toLowerCase().trim();

const ehLinhaTabela = (linha: string) => /^\s*\|.*\|\s*$/.test(linha);
const ehSeparador = (linha: string) => /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/.test(linha);

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
  if (
    /(unidade|unid|apto|apartamento|apart|n\.?o?\b|numero|lote|sala|loja|casa|imovel)/.test(t) &&
    !/area|fracao|coeficiente/.test(t)
  )
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

function escalaDaCelula(valor: string, percentualNoCabecalho: boolean): Medida["escala"] {
  if (/\//.test(valor)) return "fracao_ordinaria";
  if (/%/.test(valor)) return "percentual";
  if (/‰|mil[eé]sim/i.test(valor)) return "milesimo";
  return percentualNoCabecalho ? "percentual" : "decimal";
}

/**
 * Lê todas as tabelas Markdown do censo. Cabeçalho de coluna e título de bloco
 * atravessam a fronteira de trecho, porque a leitura é sequencial.
 */
export function extrairUnidadesDeQuadros(censo: Censo): ResultadoQuadro {
  const unidades: UnidadeExtraida[] = [];
  const linhasLidas = new Set<string>();
  let colunas: Coluna[] | null = null;

  for (const { linhas } of censo.porChunk) {
    for (let i = 0; i < linhas.length; i++) {
      const atual = linhas[i];
      const linha = atual.texto;
      if (!ehLinhaTabela(linha)) continue;
      if (ehSeparador(linha)) continue;
      if (ehSeparador(linhas[i + 1]?.texto ?? "")) {
        colunas = celulasDaLinha(linha).map(classificarColuna);
        continue;
      }
      if (!colunas) continue;
      const valores = celulasDaLinha(linha);
      if (valores.length < 2) continue;
      let numero: string | null = null;
      let bloco: string | null = atual.bloco_contexto;
      const medidas: Medida[] = [];
      for (let c = 0; c < valores.length && c < colunas.length; c++) {
        const coluna = colunas[c];
        const valor = valores[c];
        if (!valor || /^-+$/.test(valor)) continue;
        if (coluna.tipo === "identificador") {
          const token = tokenizarIdentificador(valor);
          if (token) {
            numero = token.numero;
            if (token.sufixoBloco) bloco = token.sufixoBloco.toUpperCase();
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
          linha_id: atual.linha_id,
          pagina: atual.pagina,
          bloco: atual.bloco,
          fonte: `quadro; ${atual.fonte}`,
          bloco_contexto: atual.bloco_contexto,
        });
      }
      // Linha que o parser não entendeu não é descartada: fica para a IA.
      if (!numero || medidas.length === 0) continue;
      unidades.push({
        bloco,
        numero,
        medidas,
        fonte: `quadro; ${atual.fonte}`,
      });
      linhasLidas.add(atual.linha_id);
    }
  }

  return { unidades, linhasLidas };
}
