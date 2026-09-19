import { PADROES_ANCORA, REGEX_ESCOPO_GLOBAL, expandirListaDeNumeros, gerarChaveIdentidade } from "./ancoras";
import { normalizarLayout } from "./normalizador";

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
  ancora: string;
  texto: string;
  motivo_descarte?: "identidade_repetida_no_documento" | "numero_repetido_sem_escopo" | null;
};

type AncoraCandidata = {
  pageIndex: number;
  pagina: number;
  offsetInicio: number;
  offsetFimMatch: number;
  escopo: string | null;
  numero: string;
  sufixo: string | null;
  padrao: string;
  precedencia: number;
  ancora: string;
  numeros?: string[];
  isGrupo?: boolean;
};

/**
 * Segmenta o texto do documento em registros de unidades por VARREDURA GLOBAL (Blocos 2 e P16).
 *
 * Algoritmo:
 * - Varre com regex global todos os PADROES_ANCORA sobre o texto da página;
 * - Suporta âncoras de grupo com expansão para múltiplos números (P16);
 * - Ordena por índice e resolve sobreposições pela ordem de precedência;
 * - Guarda normativa (Defeito 0.2): inspeciona apenas os 60 caracteres anteriores ao casamento;
 * - Escopo global (Defeito 0.3): busca retrospectivamente o último casamento de escopo antes do índice;
 * - Limita o registro do início da âncora até o início da próxima, com teto de 1.500 caracteres;
 * - Regra da família majoritária (P11) preservada;
 * - Para âncoras de grupo, cria N registros, um por número, compartilhando o mesmo texto;
 * - Identidades repetidas ou números repetidos sem escopo são marcados com motivo_descarte.
 */
export function segmentarRegistros(
  paginasEntrada: { numero: number; texto: string }[],
  documentoId: string = "doc",
): RegistroUnidade[] {
  const paginas = paginasEntrada.map((p) => ({
    numero: p.numero,
    texto: normalizarLayout(p.texto),
  }));
  let escopoVigente: string | null = null;
  const ancoras: AncoraCandidata[] = [];

  for (let pi = 0; pi < paginas.length; pi++) {
    const textoPagina = paginas[pi].texto;

    // Coleta todos os escopos na página com seus offsets (busca global)
    const escoposNaPagina: Array<{ offset: number; escopo: string }> = [];
    const reEscopo = new RegExp(REGEX_ESCOPO_GLOBAL.source, "gi");
    let matchEscopo: RegExpExecArray | null;
    while ((matchEscopo = reEscopo.exec(textoPagina)) !== null) {
      if (matchEscopo[1]) {
        escoposNaPagina.push({
          offset: matchEscopo.index,
          escopo: matchEscopo[1].toUpperCase(),
        });
      }
    }

    // Coleta candidatos de âncora para cada padrão
    const candidatos: AncoraCandidata[] = [];
    for (let pIndex = 0; pIndex < PADROES_ANCORA.length; pIndex++) {
      const padrao = PADROES_ANCORA[pIndex];
      const flags = padrao.re.flags.includes("g") ? padrao.re.flags : padrao.re.flags + "g";
      const globalRe = new RegExp(padrao.re.source, flags);
      let m: RegExpExecArray | null;
      while ((m = globalRe.exec(textoPagina)) !== null) {
        const matchStart = m.index;
        const matchEnd = m.index + m[0].length;

        // Guarda normativa (Defeito 0.2): inspeciona apenas os 60 caracteres anteriores
        const contextoAntes = textoPagina.slice(Math.max(0, matchStart - 60), matchStart);
        if (/(?:art(?:igo|\.)|par[aá]grafo|cl[aá]usula|§)\s*(?:n[º°o.]\s*)?$/i.test(contextoAntes.trim())) {
          continue;
        }

        if (padrao.tipo === "grupo") {
          const numeros = expandirListaDeNumeros(m[1]);
          candidatos.push({
            pageIndex: pi,
            pagina: paginas[pi].numero,
            offsetInicio: matchStart,
            offsetFimMatch: matchEnd,
            escopo: null,
            numero: numeros[0] ?? m[1],
            sufixo: null,
            padrao: padrao.nome,
            precedencia: pIndex,
            ancora: m[0],
            numeros,
            isGrupo: true,
          });
          continue;
        }

        const numero = m[1].replace(/\./g, "");
        const sufixo = m[2] ? m[2].toUpperCase() : null;

        candidatos.push({
          pageIndex: pi,
          pagina: paginas[pi].numero,
          offsetInicio: matchStart,
          offsetFimMatch: matchEnd,
          escopo: null,
          numero,
          sufixo,
          padrao: padrao.nome,
          precedencia: pIndex,
          ancora: m[0],
          isGrupo: false,
        });
      }
    }

    // Ordena candidatos por offsetInicio e depois por precedência
    candidatos.sort((a, b) => {
      if (a.offsetInicio !== b.offsetInicio) return a.offsetInicio - b.offsetInicio;
      return a.precedencia - b.precedencia;
    });

    // Resolve sobreposições pela ordem de precedência dos padrões
    const semSobreposicao: AncoraCandidata[] = [];
    for (const cand of candidatos) {
      if (semSobreposicao.length > 0) {
        const ultimo = semSobreposicao[semSobreposicao.length - 1];
        if (cand.offsetInicio < ultimo.offsetFimMatch) {
          if (cand.precedencia < ultimo.precedencia) {
            semSobreposicao[semSobreposicao.length - 1] = cand;
          }
          continue;
        }
      }
      semSobreposicao.push(cand);
    }

    // Atribui escopo global: último match de escopo ANTES daquele índice
    for (const cand of semSobreposicao) {
      let escopoDaAncora = escopoVigente;
      for (const e of escoposNaPagina) {
        if (e.offset < cand.offsetInicio) {
          escopoDaAncora = e.escopo;
        } else {
          break;
        }
      }
      ancoras.push({
        ...cand,
        escopo: escopoDaAncora,
      });
    }

    // Atualiza escopo vigente para páginas seguintes
    if (escoposNaPagina.length > 0) {
      escopoVigente = escoposNaPagina[escoposNaPagina.length - 1].escopo;
    }
  }

  // Regra da família majoritária (P11)
  let ancorasFiltradas = ancoras;
  if (ancoras.length > 0) {
    const contagemPorPadrao = new Map<string, number>();
    for (const a of ancoras) {
      const familia =
        a.padrao === "grupo_unidades" ||
        a.padrao === "unidade_autonoma_singular" ||
        a.padrao === "unidade_autonoma" ||
        a.padrao === "apartamento"
          ? "unidade_autonoma"
          : a.padrao;
      contagemPorPadrao.set(familia, (contagemPorPadrao.get(familia) ?? 0) + 1);
    }
    const maxOcorrencias = Math.max(...contagemPorPadrao.values());
    if (maxOcorrencias >= 10) {
      ancorasFiltradas = ancoras.filter((a) => {
        const familia =
          a.padrao === "grupo_unidades" ||
          a.padrao === "unidade_autonoma_singular" ||
          a.padrao === "unidade_autonoma" ||
          a.padrao === "apartamento"
            ? "unidade_autonoma"
            : a.padrao;
        return (contagemPorPadrao.get(familia) ?? 0) >= Math.max(3, Math.floor(maxOcorrencias * 0.2));
      });
    }
  }

  const registros: RegistroUnidade[] = [];
  const identidadesVistas = new Set<string>();
  const numerosVistosSemEscopo = new Set<string>();

  for (let i = 0; i < ancorasFiltradas.length; i++) {
    const atual = ancorasFiltradas[i];
    const proxima = i + 1 < ancorasFiltradas.length ? ancorasFiltradas[i + 1] : null;

    let texto = "";
    let offsetFim = atual.offsetInicio;

    if (proxima && proxima.pageIndex === atual.pageIndex) {
      offsetFim = proxima.offsetInicio;
      texto = paginas[atual.pageIndex].texto.slice(atual.offsetInicio, proxima.offsetInicio).trim();
    } else if (proxima && proxima.pageIndex === atual.pageIndex + 1) {
      offsetFim = proxima.offsetInicio;
      const parteAtual = paginas[atual.pageIndex].texto.slice(atual.offsetInicio).trim();
      const parteProx = paginas[proxima.pageIndex].texto.slice(0, proxima.offsetInicio).trim();
      texto = [parteAtual, parteProx].filter(Boolean).join("\n");
    } else {
      offsetFim = paginas[atual.pageIndex].texto.length;
      const parteAtual = paginas[atual.pageIndex].texto.slice(atual.offsetInicio).trim();
      let parteProx = "";
      if (atual.pageIndex + 1 < paginas.length) {
        parteProx = paginas[atual.pageIndex + 1].texto.trim();
      }
      texto = [parteAtual, parteProx].filter(Boolean).join("\n");
    }

    // Teto de 1.500 caracteres por registro
    if (texto.length > 1500) {
      texto = texto.slice(0, 1500);
    }

    if (atual.isGrupo && atual.numeros && atual.numeros.length > 0) {
      // 2) UM REGISTRO POR UNIDADE, TODOS COMPARTILHANDO O MESMO CORPO
      for (const num of atual.numeros) {
        const chaveIdentidade = gerarChaveIdentidade(num, null, atual.escopo);
        let motivo_descarte: "identidade_repetida_no_documento" | "numero_repetido_sem_escopo" | null = null;

        if (atual.escopo) {
          if (identidadesVistas.has(chaveIdentidade)) {
            motivo_descarte = "identidade_repetida_no_documento";
          } else {
            identidadesVistas.add(chaveIdentidade);
          }
        } else {
          if (numerosVistosSemEscopo.has(num)) {
            motivo_descarte = "numero_repetido_sem_escopo";
          } else {
            numerosVistosSemEscopo.add(num);
          }
        }

        const registroId = `${documentoId}:${atual.pagina}:${atual.offsetInicio}:${num}`;

        registros.push({
          registro_id: registroId,
          documento_id: documentoId,
          pagina: atual.pagina,
          offset_inicio: atual.offsetInicio,
          offset_fim: offsetFim,
          escopo: atual.escopo,
          numero: num,
          sufixo: null,
          padrao_ancora: `grupo:${atual.padrao}`,
          ancora: atual.ancora,
          texto,
          ...(motivo_descarte ? { motivo_descarte } : {}),
        });
      }
    } else {
      // Âncora individual
      const chaveIdentidade = gerarChaveIdentidade(atual.numero, atual.sufixo, atual.escopo);
      let motivo_descarte: "identidade_repetida_no_documento" | "numero_repetido_sem_escopo" | null = null;

      if (atual.escopo) {
        if (identidadesVistas.has(chaveIdentidade)) {
          motivo_descarte = "identidade_repetida_no_documento";
        } else {
          identidadesVistas.add(chaveIdentidade);
        }
      } else {
        if (numerosVistosSemEscopo.has(atual.numero)) {
          motivo_descarte = "numero_repetido_sem_escopo";
        } else {
          numerosVistosSemEscopo.add(atual.numero);
        }
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
        ancora: atual.ancora,
        texto,
        ...(motivo_descarte ? { motivo_descarte } : {}),
      });
    }
  }

  return registros;
}