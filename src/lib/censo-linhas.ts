/**
 * Censo determinístico de linhas candidatas a unidade.
 *
 * Invariante 1: cobertura é por LINHA, nunca por trecho. Toda linha indexada
 * recebe um `linha_id` estável (`documento:ordem_global:índice`).
 * Invariante 2: o censo é a meta da extração — toda linha candidata precisa
 * terminar em `lida_pelo_parser`, `lida_pela_ia` ou `NAO_LIDA`.
 */

export type ChunkCenso = {
  id: string;
  conteudo: string;
  metadata: {
    bloco?: number;
    trecho?: number;
    ordem_global?: number;
    pagina_inicio?: number;
    pagina_fim?: number;
    bloco_contexto?: string | null;
  } | null;
};

export type LinhaCenso = {
  linha_id: string;
  chunk_id: string;
  texto: string;
  pagina: number | null;
  bloco: number | null;
  ordem_global: number;
  indice: number;
  bloco_contexto: string | null;
  candidata: boolean;
  fonte: string;
};

export const REGEX_TITULO_BLOCO = /\b(?:bloco|torre|quadra)\s+([a-z0-9]{1,3})\b/i;

export function semAcento(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const PREFIXO_UNIDADE =
  /^(UNIDADES?|UNID|UN|APARTAMENTOS?|APTO|APART|AP|FLATS?|STUDIOS?|CASAS?|LOJAS?|SALAS?|LOTES?|CONJUNTOS?|CJ|GALPAO|VAGAS?|BOX|N[º°O]|N)\.?\s*/i;
const PREFIXO_BLOCO = /^(?:BL|BLOCO|TORRE|QD|QUADRA)\.?\s*([A-Z0-9]{1,3})[\s\-–—/.]*(?=\d)/;
const SEP = "[\\s\\-–—/.]";

export type Identificador = {
  prefixo: string | null;
  numero: string;
  sufixoBloco: string | null;
};

/** Aceita `601`, `601A`, `Apto 601`, `601-A`, `A-601`, `Unidade 601`, `Nº 601`… */
export function tokenizarIdentificador(celula: string): Identificador | null {
  const bruto = semAcento(celula).replace(/\s+/g, " ").trim();
  if (!bruto || !/\d/.test(bruto)) return null;
  let t = bruto.toUpperCase();
  let prefixo: string | null = null;
  const mPref = PREFIXO_UNIDADE.exec(t);
  if (mPref && /\d/.test(t.slice(mPref[0].length))) {
    prefixo = mPref[1];
    t = t.slice(mPref[0].length).trim();
  }
  let sufixoBloco: string | null = null;
  const mBloco = PREFIXO_BLOCO.exec(t);
  if (mBloco) {
    sufixoBloco = mBloco[1];
    t = t.slice(mBloco[0].length).trim();
  }
  const direto = new RegExp(
    `^(\\d{1,5})(?:${SEP}*(?:BL|BLOCO|TORRE|QD|QUADRA)?\\.?\\s*([A-Z0-9]{1,3}))?$`,
  ).exec(t);
  if (direto) {
    return { prefixo, numero: direto[1], sufixoBloco: sufixoBloco ?? direto[2] ?? null };
  }
  const invertido = new RegExp(`^([A-Z0-9]{1,3})${SEP}+(\\d{1,5})$`).exec(t);
  if (invertido && !/^\d+$/.test(invertido[1])) {
    return { prefixo, numero: invertido[2], sufixoBloco: sufixoBloco ?? invertido[1] };
  }
  return null;
}

export function celulasDaLinha(linha: string) {
  const trim = linha.trim();
  if (/[|!¦]/.test(trim)) {
    return trim
      .replace(/^[|!¦]/, "")
      .replace(/[|!¦]$/, "")
      .split(/[|!¦]/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  if (/^\s*\d{1,5}[A-Z]?\s*:\s*\S/i.test(trim)) {
    const idx = trim.indexOf(":");
    return [trim.slice(0, idx).trim(), trim.slice(idx + 1).trim()];
  }
  return trim
    .split(/\s{2,}|;|\t/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Primeiro token da linha que parece um identificador de unidade. */
export function identificadorDaLinha(linha: string): Identificador | null {
  for (const celula of celulasDaLinha(linha)) {
    const token = tokenizarIdentificador(celula);
    if (token) return token;
  }
  const prosa = /(unidade|unid\.?|un\.?|apartamento|apto\.?|ap\.?|flat|studio|casa|loja|sala|lote|conjunto|cj|galp[aã]o)\s*n?[º°o]?\.?\s*([0-9]{1,5}\s*[-–—/]?\s*[a-z0-9]{0,3})/i.exec(
    semAcento(linha),
  );
  if (prosa) return tokenizarIdentificador(prosa[0]);
  return null;
}

const temDecimal = (texto: string) => /\d+[.,]\d/.test(texto) || /\d\s*%/.test(texto);
const temFracao = (texto: string) => /\b\d+\s*\/\s*\d+\b/.test(texto);

export function ehLinhaCandidata(
  linha: string,
  identificador: Identificador | null,
  contexto?: {
    adjacenteIdentificador?: boolean;
    emSecaoUnidades?: boolean;
  },
): boolean {
  if (!identificador) return false;

  // Linhas que descrevem áreas gerais/coletivas ou partes comuns do condomínio não são candidatas a unidades
  const descricaoAreaColetiva =
    /^[\-–•]?\s*(?:área|area)\s+(?:de|do|da)\s+(?:uso|constru|vaga|solo|terreno|lazer)/i.test(linha.trim()) &&
    identificador.prefixo == null;
  if (descricaoAreaColetiva) return false;

  // Linhas de artigos de direitos/deveres/administração/convenção geral não são unidades
  if (/^\s*(?:ARTIGO|ART\.|PARÁGRAFO|PARAGRAFO|CAP[IÍ]TULO)\b/i.test(linha) && identificador.prefixo == null) {
    return false;
  }

  // 1. Tem número decimal, percentual ou milésimo (área ou fração)
  // Requer que a linha tenha um identificador com prefixo ou esteja adjacente a um identificador
  if (temDecimal(linha)) {
    if (identificador.prefixo != null || contexto?.adjacenteIdentificador || /m2|m²|fracao|fração|cota/i.test(linha)) {
      return true;
    }
  }

  // 2. Tem fração ordinária expressa (ex: 1/10, 1/57)
  if (temFracao(linha)) return true;

  // 3. Tem prefixo explícito de unidade (Apto 101, Flat 505, Sala 111, Loja 2, Lote 12)
  if (identificador.prefixo != null) return true;

  // 4. Linha tabular ou com delimitador OCR (| ! ¦ : ou múltiplos espaços) com >= 2 células
  const celulas = celulasDaLinha(linha);
  if (celulas.length >= 2 && (contexto?.emSecaoUnidades || contexto?.adjacenteIdentificador)) return true;

  // 5. Número de unidade isolado (ex: "102", "505", "1005") em contexto de lista/seção
  if (/^\s*\d{2,5}[A-Z]?\s*$/i.test(linha)) {
    if (contexto?.adjacenteIdentificador || contexto?.emSecaoUnidades) {
      return true;
    }
  }

  return false;
}

function normalizarTextoLinha(texto: string) {
  return semAcento(texto).toLowerCase().replace(/[|\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function ordenar(chunks: ChunkCenso[]) {
  return chunks.slice().sort((a, b) => {
    const ma = a.metadata ?? {};
    const mb = b.metadata ?? {};
    return (
      (ma.ordem_global ?? Number.MAX_SAFE_INTEGER) - (mb.ordem_global ?? Number.MAX_SAFE_INTEGER) ||
      (ma.bloco ?? 0) - (mb.bloco ?? 0) ||
      (ma.trecho ?? 0) - (mb.trecho ?? 0) ||
      a.id.localeCompare(b.id)
    );
  });
}

export type Censo = {
  linhas: LinhaCenso[];
  candidatas: LinhaCenso[];
  porId: Map<string, LinhaCenso>;
  /** Linhas na ordem de leitura, agrupadas por trecho (para o parser de quadros). */
  porChunk: Array<{ chunk: ChunkCenso; linhas: LinhaCenso[] }>;
};

/**
 * Percorre todas as linhas indexadas na ordem de leitura, propaga o título de
 * bloco vigente e deduplica linhas físicas reemitidas pela sobreposição do
 * chunkText (invariante C).
 */
export function construirCenso(documentoId: string, chunks: ChunkCenso[]): Censo {
  const linhas: LinhaCenso[] = [];
  const porChunk: Censo["porChunk"] = [];
  const vistas = new Set<string>();
  let blocoContexto: string | null = null;

  for (const chunk of ordenar(chunks)) {
    const meta = chunk.metadata ?? {};
    const ordem = meta.ordem_global ?? 0;
    const ref = `bloco ${meta.bloco ?? "?"}, páginas ${meta.pagina_inicio ?? "?"}-${meta.pagina_fim ?? "?"}, trecho ${meta.trecho ?? "?"}, ordem ${ordem}`;
    const doChunk: LinhaCenso[] = [];
    const texto = chunk.conteudo.split("\n");
    const idsPre = texto.map((l) => (l.trim() ? identificadorDaLinha(l) : null));
    let emSecaoUnidades = false;

    for (let i = 0; i < texto.length; i++) {
      const linha = texto[i];
      if (!linha.trim()) continue;
      const titulo = REGEX_TITULO_BLOCO.exec(linha);
      if (titulo && !/^\s*\|/.test(linha)) blocoContexto = titulo[1].toUpperCase();

      if (
        /\b(?:unidades?|flats?|studios?|apartamentos?|salas?|lojas?|quadro|frac(?:ao|oes)|relacao|tabela|proprietario)\b/i.test(
          linha,
        )
      ) {
        emSecaoUnidades = true;
      }

      const normal = normalizarTextoLinha(linha);
      const identificador = idsPre[i];
      const adjacenteIdentificador = Boolean(
        (i > 0 && idsPre[i - 1]) ||
        (i < idsPre.length - 1 && idsPre[i + 1]) ||
        (i > 1 && idsPre[i - 2]) ||
        (i < idsPre.length - 2 && idsPre[i + 2]),
      );
      const candidata = ehLinhaCandidata(linha, identificador, {
        adjacenteIdentificador,
        emSecaoUnidades,
      });
      const chaveDedup = `${blocoContexto ?? ""}|${normal}`;
      if (vistas.has(chaveDedup)) continue;
      vistas.add(chaveDedup);
      const item: LinhaCenso = {
        linha_id: `${documentoId}:${ordem}:${i}`,
        chunk_id: chunk.id,
        texto: linha.trim(),
        pagina: meta.pagina_inicio ?? null,
        bloco: meta.bloco ?? null,
        ordem_global: ordem,
        indice: i,
        bloco_contexto: meta.bloco_contexto ?? blocoContexto,
        candidata,
        fonte: ref,
      };
      linhas.push(item);
      doChunk.push(item);
    }
    porChunk.push({ chunk, linhas: doChunk });
  }

  return {
    linhas,
    candidatas: linhas.filter((l) => l.candidata),
    porId: new Map(linhas.map((l) => [l.linha_id, l])),
    porChunk,
  };
}

// ---------------------------------------------------------------------------
// Invariante 3 — identidade resolvida contra o cadastro, nunca inventada.
// ---------------------------------------------------------------------------

export type Conhecida = { bloco: string | null; numero: string };

export function normalizarParte(valor: string) {
  return semAcento(valor)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export type ResultadoIdentidade =
  | { status: "resolvida"; bloco: string | null; numero: string; regra: string }
  | { status: "sem_correspondencia"; regra: "sem_correspondencia" };

export function resolverIdentidade(
  candidata: { bloco?: string | null; numero: string; bloco_contexto?: string | null },
  conhecidas: Conhecida[],
): ResultadoIdentidade {
  if (conhecidas.length === 0) {
    return {
      status: "resolvida",
      bloco: candidata.bloco ?? candidata.bloco_contexto ?? null,
      numero: candidata.numero,
      regra: "cadastro_vazio",
    };
  }
  const numero = normalizarParte(candidata.numero);
  const bloco = normalizarParte(candidata.bloco ?? "");

  // 1) chave exata
  const exata = conhecidas.find(
    (item) => normalizarParte(item.numero) === numero && normalizarParte(item.bloco ?? "") === bloco,
  );
  if (exata) return { status: "resolvida", ...exata, regra: "identidade_exata" };

  // 2) identificador composto (601A -> A/601), nos dois sentidos
  const compostos = conhecidas.filter((item) => {
    const a = normalizarParte(`${item.numero}${item.bloco ?? ""}`);
    const b = normalizarParte(`${item.bloco ?? ""}${item.numero}`);
    return a === numero || b === numero;
  });
  if (compostos.length === 1)
    return { status: "resolvida", ...compostos[0], regra: "identidade_composta" };

  // 3) número + bloco do contexto da linha
  const contexto = normalizarParte(candidata.bloco_contexto ?? "");
  if (contexto) {
    const porContexto = conhecidas.filter(
      (item) =>
        normalizarParte(item.numero) === numero && normalizarParte(item.bloco ?? "") === contexto,
    );
    if (porContexto.length === 1)
      return { status: "resolvida", ...porContexto[0], regra: "identidade_bloco_contexto" };
  }

  // 4) número único no cadastro inteiro
  const porNumero = conhecidas.filter((item) => normalizarParte(item.numero) === numero);
  if (porNumero.length === 1)
    return { status: "resolvida", ...porNumero[0], regra: "identidade_numero_unico" };

  return { status: "sem_correspondencia", regra: "sem_correspondencia" };
}
