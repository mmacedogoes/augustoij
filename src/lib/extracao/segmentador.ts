import { reconhecerAncora, reconhecerEscopo, gerarChaveIdentidade } from "./ancoras";

export type RegistroUnidade = {
  registro_id: string;
  documento_id?: string;
  pagina: number;
  offset_inicio: number;
  offset_fim: number;
  escopo: string | null;
  numero: string;
  sufixo: string | null;
  padrao_ancora: string;
  texto: string;
  motivo_descarte?: "identidade_repetida_no_documento" | null;
};

type AncoraPosicional = {
  pageIndex: number;
  pagina: number;
  offsetInicio: number;
  escopo: string | null;
  numero: string;
  sufixo: string | null;
  padrao: string;
};

/**
 * Segmenta o texto do documento em registros de unidades posicionais.
 *
 * Algoritmo:
 * - percorre o texto na ordem, mantendo o escopo vigente (PADROES_ESCOPO);
 * - toda vez que reconhecerAncora() casar, abre um registro;
 * - o registro vai da posição da âncora até a posição da PRÓXIMA âncora (ou o fim da página
 *   seguinte, o que vier primeiro);
 * - registro_id = `${documentoId}:${pagina}:${offsetInicio}` — POSICIONAL;
 * - NÃO deduplica nada. Dois registros com texto idêntico são duas unidades diferentes.
 *   Se a mesma identidade (escopo|numero) aparecer em dois registros, guarda os dois e
 *   marca o segundo com o motivo "identidade_repetida_no_documento".
 */
export function segmentarRegistros(
  paginas: { numero: number; texto: string }[],
  documentoId: string = "doc",
): RegistroUnidade[] {
  let escopoVigente: string | null = null;
  const ancoras: AncoraPosicional[] = [];

  for (let pi = 0; pi < paginas.length; pi++) {
    const textoPagina = paginas[pi].texto;
    let lineStart = 0;

    while (lineStart < textoPagina.length) {
      const lineEnd = textoPagina.indexOf("\n", lineStart);
      let nextLineStart: number;
      let linha: string;

      if (lineEnd === -1) {
        linha = textoPagina.slice(lineStart);
        nextLineStart = textoPagina.length;
      } else {
        linha = textoPagina.slice(lineStart, lineEnd);
        if (linha.endsWith("\r")) linha = linha.slice(0, -1);
        nextLineStart = lineEnd + 1;
      }

      const linhaTrim = linha.trim();
      if (linhaTrim.length > 0) {
        const escopo = reconhecerEscopo(linha);
        if (escopo && !/^\s*\|/.test(linha)) {
          escopoVigente = escopo;
        }

        const ancora = reconhecerAncora(linha);
        if (ancora) {
          ancoras.push({
            pageIndex: pi,
            pagina: paginas[pi].numero,
            offsetInicio: lineStart,
            escopo: escopoVigente,
            numero: ancora.numero,
            sufixo: ancora.sufixo,
            padrao: ancora.padrao,
          });
        }
      }

      lineStart = nextLineStart;
    }
  }

  const registros: RegistroUnidade[] = [];
  const identidadesVistas = new Set<string>();

  for (let i = 0; i < ancoras.length; i++) {
    const atual = ancoras[i];
    const proxima = i + 1 < ancoras.length ? ancoras[i + 1] : null;

    let texto = "";
    let offsetFim = atual.offsetInicio;

    if (proxima && proxima.pageIndex === atual.pageIndex) {
      // Próxima âncora na mesma página
      offsetFim = proxima.offsetInicio;
      texto = paginas[atual.pageIndex].texto.slice(atual.offsetInicio, proxima.offsetInicio).trim();
    } else if (proxima && proxima.pageIndex === atual.pageIndex + 1) {
      // Próxima âncora na página seguinte
      offsetFim = proxima.offsetInicio;
      const parteAtual = paginas[atual.pageIndex].texto.slice(atual.offsetInicio).trim();
      const parteProx = paginas[proxima.pageIndex].texto.slice(0, proxima.offsetInicio).trim();
      texto = [parteAtual, parteProx].filter(Boolean).join("\n");
    } else {
      // Próxima âncora a 2+ páginas ou última âncora do documento.
      // O registro vai até o fim da página seguinte (ou da atual se for a última).
      offsetFim = paginas[atual.pageIndex].texto.length;
      const parteAtual = paginas[atual.pageIndex].texto.slice(atual.offsetInicio).trim();
      let parteProx = "";
      if (atual.pageIndex + 1 < paginas.length) {
        parteProx = paginas[atual.pageIndex + 1].texto.trim();
      }
      texto = [parteAtual, parteProx].filter(Boolean).join("\n");
    }

    const chaveIdentidade = gerarChaveIdentidade(atual.numero, atual.sufixo, atual.escopo);
    let motivo_descarte: "identidade_repetida_no_documento" | null = null;
    if (identidadesVistas.has(chaveIdentidade)) {
      motivo_descarte = "identidade_repetida_no_documento";
    } else {
      identidadesVistas.add(chaveIdentidade);
    }

    const registroId = `${documentoId}:${atual.pagina}:${atual.offsetInicio}`;

    registros.push({
      registro_id: registroId,
      documento_id: documentoId,
      pagina: atual.pagina,
      offset_inicio: atual.offsetInicio,
      offset_fim: offsetFim,
      escopo: atual.escopo,
      numero: atual.numero,
      sufixo: atual.sufixo,
      padrao_ancora: atual.padrao,
      texto,
      ...(motivo_descarte ? { motivo_descarte } : {}),
    });
  }

  return registros;
}