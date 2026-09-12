/**
 * Motor de Busca Híbrida Avançada (RAG Engineer / RAG Implementation)
 *
 * Implementa Reciprocal Rank Fusion (RRF) combinando busca vetorial semântica
 * (pgvector / embeddings) e busca léxica por palavras-chave exatas
 * (dispositivos legais, artigos, unidades, termos técnicos e regras condominiais).
 */

export interface ChunkResultado {
  chunk_id: string;
  documento_id?: string;
  kb_documento_id?: string;
  nome_arquivo?: string;
  titulo?: string;
  tipo?: string;
  fonte?: string | null;
  conteudo: string;
  similarity?: number;
  score_rrf?: number;
  origem_match?: "denso" | "lexico" | "hibrido";
}

export interface TermosChaveExtraidos {
  artigos: string[];
  unidades: string[];
  normas: string[];
  termosJuridicos: string[];
  palavrasChave: string[];
}

/** Constante padrão de suavização do algoritmo RRF (Cormack et al., SIGIR). */
const RRF_K = 60;

/**
 * Extrai entidades, números de artigos, unidades, leis e termos técnicos
 * do prompt do usuário para conduzir a busca léxica direcionada.
 */
export function extrairTermosChaveBusca(query: string): TermosChaveExtraidos {
  const texto = query ?? "";

  // 1. Extração de Artigos e Cláusulas (ex: "art. 12", "artigo 1.336", "cláusula 5ª")
  const regexArtigo = /\b(?:art(?:igo)?\.?|cl[aá]usula)\s*(\d+[ºªa-z\d./-]*)/gi;
  const artigos: string[] = [];
  let mArt: RegExpExecArray | null;
  while ((mArt = regexArtigo.exec(texto)) !== null) {
    const termoOriginal = mArt[0].trim();
    artigos.push(termoOriginal);
    const numLimpo = mArt[1]?.replace(/[ºª.]/g, "").trim();
    if (numLimpo) {
      artigos.push(`artigo ${numLimpo}`);
      artigos.push(`art. ${numLimpo}`);
      artigos.push(`art ${numLimpo}`);
      artigos.push(`artigo ${numLimpo}º`);
      artigos.push(`art. ${numLimpo}º`);
    }
  }

  // 2. Extração de Unidades/Apartamentos (ex: "unidade 101", "apto 704", "bloco B")
  const regexUnidade = /\b(?:unidade|apto|apartamento|sala|bloco)\s*(\d+[a-z]?|[a-z]\b)/gi;
  const unidades: string[] = [];
  let mUni: RegExpExecArray | null;
  while ((mUni = regexUnidade.exec(texto)) !== null) {
    unidades.push(mUni[0].trim());
  }

  // 3. Extração de Leis e Súmulas (ex: "Lei 4.591", "Lei 10.406", "Súmula 331")
  const regexNorma = /\b(?:lei(?:\s+n[ºo.]?)?|c[oó]digo\s+civil|s[uú]mula(?:\s+vinculante)?)\s*([\d./-]+)/gi;
  const normas: string[] = [];
  let mNorm: RegExpExecArray | null;
  while ((mNorm = regexNorma.exec(texto)) !== null) {
    normas.push(mNorm[0].trim());
  }

  // 4. Termos Jurídicos Condominiais Essenciais
  const termosVocabulario = [
    "barulho", "ru[ií]do", "sil[eê]ncio", "animal", "animais", "pet", "pets",
    "cachorro", "elevador", "social", "servi[cç]o", "vaga", "garagem", "ve[ií]culo",
    "inadimpl[eê]ncia", "multa", "advert[eê]ncia", "notifica[cç][aã]o", "defesa",
    "recurso", "prazo", "reforma", "obra", "vazamento", "infiltra[cç][aã]o",
    "sal[aã]o de festas", "churrasqueira", "piscina", "academia", "assembleia",
    "qu[oó]rum", "s[ií]ndico", "conselho", "reajuste", "rescis[aã]o", "terceiriza[cç][aã]o",
    "reten[cç][aã]o", "seguro", "lgpd",
  ];

  const termosJuridicos: string[] = [];
  for (const padrao of termosVocabulario) {
    const re = new RegExp(`\\b${padrao}\\b`, "i");
    if (re.test(texto)) {
      termosJuridicos.push(padrao.replace(/[\[\]]/g, ""));
    }
  }

  // 5. Palavras-chave gerais sem stopwords
  const stopWords = new Set([
    "a", "o", "as", "os", "de", "do", "da", "dos", "das", "em", "no", "na",
    "nos", "nas", "por", "para", "com", "sem", "sob", "sobre", "um", "uma",
    "uns", "umas", "qual", "quais", "que", "como", "onde", "quando", "porque",
    "porquê", "por que", "qual", "quais", "favor", "gostaria", "pode", "fazer",
    "notificar", "notificacao", "notificação", "gerar", "verificar", "consultar",
  ]);

  const palavrasChave = texto
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêîôûãõç]/gi, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !stopWords.has(p));

  return {
    artigos,
    unidades,
    normas,
    termosJuridicos,
    palavrasChave: Array.from(new Set(palavrasChave)).slice(0, 8),
  };
}

/**
 * Aplica o algoritmo de Fusão de Ranks Recíprocos (RRF) em duas listas ranqueadas
 * (busca densa vetorial e busca léxica por palavras-chave).
 */
export function reciprocalRankFusion(
  denseResults: ChunkResultado[],
  sparseResults: ChunkResultado[],
  k: number = RRF_K,
  pesoDenso: number = 1.0,
  pesoSparso: number = 1.15, // Leve boost em correspondência léxica exata (artigos e termos exatos)
): ChunkResultado[] {
  const scoreMap = new Map<string, { chunk: ChunkResultado; rrfScore: number; streams: Set<string> }>();

  // 1. Processar resultados da busca densa (vetorial)
  denseResults.forEach((chunk, rank) => {
    const id = chunk.chunk_id;
    const score = pesoDenso * (1 / (k + (rank + 1)));
    if (!scoreMap.has(id)) {
      scoreMap.set(id, {
        chunk: { ...chunk },
        rrfScore: score,
        streams: new Set(["denso"]),
      });
    } else {
      const entry = scoreMap.get(id)!;
      entry.rrfScore += score;
      entry.streams.add("denso");
    }
  });

  // 2. Processar resultados da busca esparsa (léxica)
  sparseResults.forEach((chunk, rank) => {
    const id = chunk.chunk_id;
    const score = pesoSparso * (1 / (k + (rank + 1)));
    if (!scoreMap.has(id)) {
      scoreMap.set(id, {
        chunk: { ...chunk },
        rrfScore: score,
        streams: new Set(["lexico"]),
      });
    } else {
      const entry = scoreMap.get(id)!;
      entry.rrfScore += score;
      entry.streams.add("lexico");
    }
  });

  // 3. Ordenar os resultados pelo score RRF combinado
  const merged = Array.from(scoreMap.values())
    .map((entry) => {
      const origem: "denso" | "lexico" | "hibrido" =
        entry.streams.has("denso") && entry.streams.has("lexico")
          ? "hibrido"
          : entry.streams.has("denso")
            ? "denso"
            : "lexico";

      return {
        ...entry.chunk,
        score_rrf: entry.rrfScore,
        origem_match: origem,
      };
    })
    .sort((a, b) => (b.score_rrf ?? 0) - (a.score_rrf ?? 0));

  return merged;
}

/**
 * Executa a Busca Híbrida Inteligente (Vetorial + Léxica + RRF) nos Documentos do Condomínio.
 */
export async function buscarChunksCondominioHibrido({
  supabase,
  condominioId,
  queryTexto,
  queryEmbedding,
  contratoId,
  matchCount = 12,
  minSimilarity = 0.18,
}: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  condominioId: string;
  queryTexto: string;
  queryEmbedding: number[];
  contratoId?: string | null;
  matchCount?: number;
  minSimilarity?: number;
}): Promise<ChunkResultado[]> {
  const entidades = extrairTermosChaveBusca(queryTexto);

  // 1. Stream Denso: Busca Vetorial via pgvector
  let denseChunks: ChunkResultado[] = [];
  try {
    const { data: matches, error: rpcErr } = await supabase.rpc("match_document_chunks", {
      _condominio_id: condominioId,
      _query_embedding: `[${queryEmbedding.join(",")}]` as unknown as string,
      _match_count: matchCount * 2,
      _min_similarity: minSimilarity,
      ...(contratoId ? { _metadata_filter: { contrato_id: contratoId } } : {}),
    });

    if (!rpcErr && matches && Array.isArray(matches)) {
      denseChunks = matches.map((m: {
        chunk_id?: string;
        id?: string;
        documento_id?: string;
        nome_arquivo?: string;
        conteudo: string;
        similarity?: number;
      }) => ({
        chunk_id: m.chunk_id ?? m.id ?? "",
        documento_id: m.documento_id,
        nome_arquivo: m.nome_arquivo,
        conteudo: m.conteudo,
        similarity: m.similarity,
      }));
    }
  } catch (err) {
    console.warn("[rag-hibrido] falha na busca vetorial condominio:", err);
  }

  // 2. Stream Esparso: Busca Léxica por Artigos, Unidades e Palavras-chave
  let sparseChunks: ChunkResultado[] = [];
  const termosBusca = [
    ...entidades.artigos,
    ...entidades.normas,
    ...entidades.termosJuridicos,
    ...entidades.palavrasChave.slice(0, 3),
  ].filter(Boolean);

  if (termosBusca.length > 0) {
    try {
      // Monta filtros ILIKE combinados para os termos mais relevantes
      const filtroOr = termosBusca
        .slice(0, 10)
        .map((t) => `conteudo.ilike.%${t}%`)
        .join(",");

      const { data: lexMatches, error: lexErr } = await supabase
        .from("document_chunks")
        .select("id, documento_id, conteudo, documentos(nome_arquivo)")
        .eq("condominio_id", condominioId)
        .or(filtroOr)
        .limit(matchCount * 2);

      if (!lexErr && lexMatches && Array.isArray(lexMatches)) {
        sparseChunks = lexMatches.map((row: Record<string, unknown>) => {
          const doc = row.documentos as { nome_arquivo?: string } | null;
          return {
            chunk_id: String(row.id),
            documento_id: String(row.documento_id ?? ""),
            nome_arquivo: doc?.nome_arquivo ?? "Documento",
            conteudo: String(row.conteudo ?? ""),
          };
        });
      }
    } catch (lexErr) {
      console.warn("[rag-hibrido] falha na busca léxica condominio:", lexErr);
    }
  }

  // 3. Fusão RRF (Reciprocal Rank Fusion)
  const resultadoRrf = reciprocalRankFusion(denseChunks, sparseChunks, RRF_K, 1.0, 1.2);

  // Retorna os top-K mais bem classificados
  return resultadoRrf.slice(0, matchCount);
}

/**
 * Executa a Busca Híbrida Inteligente (Vetorial + Léxica + RRF) na Base Global de Treinamento (KB).
 */
export async function buscarChunksKbHibrido({
  supabase,
  queryTexto,
  queryEmbedding,
  matchCount = 6,
  minSimilarity = 0.20,
}: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  queryTexto: string;
  queryEmbedding: number[];
  matchCount?: number;
  minSimilarity?: number;
}): Promise<ChunkResultado[]> {
  const entidades = extrairTermosChaveBusca(queryTexto);

  // 1. Stream Denso: Busca Vetorial na Base de Conhecimento
  let denseChunks: ChunkResultado[] = [];
  try {
    const { data: kbMatches, error: rpcErr } = await supabase.rpc("match_kb_chunks", {
      _query_embedding: `[${queryEmbedding.join(",")}]` as unknown as string,
      _match_count: matchCount * 2,
      _min_similarity: minSimilarity,
    });

    if (!rpcErr && kbMatches && Array.isArray(kbMatches)) {
      denseChunks = kbMatches.map((m: {
        chunk_id?: string;
        id?: string;
        kb_documento_id?: string;
        titulo?: string;
        tipo?: string;
        fonte?: string | null;
        conteudo: string;
        similarity?: number;
      }) => ({
        chunk_id: m.chunk_id ?? m.id ?? "",
        kb_documento_id: m.kb_documento_id,
        titulo: m.titulo,
        tipo: m.tipo,
        fonte: m.fonte,
        conteudo: m.conteudo,
        similarity: m.similarity,
      }));
    }
  } catch (err) {
    console.warn("[rag-hibrido] falha na busca vetorial KB:", err);
  }

  // 2. Stream Esparso: Busca Léxica na Base de Conhecimento
  let sparseChunks: ChunkResultado[] = [];
  const termosBusca = [
    ...entidades.artigos,
    ...entidades.normas,
    ...entidades.termosJuridicos,
    ...entidades.palavrasChave.slice(0, 3),
  ].filter(Boolean);

  if (termosBusca.length > 0) {
    try {
      const filtroOr = termosBusca
        .slice(0, 10)
        .map((t) => `conteudo.ilike.%${t}%`)
        .join(",");

      const { data: lexMatches, error: lexErr } = await supabase
        .from("kb_chunks")
        .select("id, kb_documento_id, conteudo, kb_documentos(titulo, tipo, fonte)")
        .or(filtroOr)
        .limit(matchCount * 2);

      if (!lexErr && lexMatches && Array.isArray(lexMatches)) {
        sparseChunks = lexMatches.map((row: Record<string, unknown>) => {
          const doc = row.kb_documentos as { titulo?: string; tipo?: string; fonte?: string | null } | null;
          return {
            chunk_id: String(row.id),
            kb_documento_id: String(row.kb_documento_id ?? ""),
            titulo: doc?.titulo ?? "Base de Treinamento",
            tipo: doc?.tipo ?? "orientacao",
            fonte: doc?.fonte ?? null,
            conteudo: String(row.conteudo ?? ""),
          };
        });
      }
    } catch (lexErr) {
      console.warn("[rag-hibrido] falha na busca léxica KB:", lexErr);
    }
  }

  // 3. Fusão RRF (Reciprocal Rank Fusion)
  const resultadoRrf = reciprocalRankFusion(denseChunks, sparseChunks, RRF_K, 1.0, 1.15);

  return resultadoRrf.slice(0, matchCount);
}

export interface ArtigoDeterminista {
  id: string;
  artigo_numero: number;
  artigo_rotulo: string;
  tipo: string;
  capitulo?: string | null;
  titulo?: string | null;
  conteudo: string;
}

export interface ArtigoReferenciado {
  numero: number;
  tipoDoc?: "convencao" | "regimento" | null;
  rotulo: string;
}

export function extrairArtigosEspecificos(query: string): ArtigoReferenciado[] {
  const texto = query ?? "";
  const regex = /\b(?:art(?:igo)?\.?)\s*(\d+)/gi;
  const resultados: ArtigoReferenciado[] = [];
  let m: RegExpExecArray | null;

  const temRegimento = /\b(?:regimento|interno|ri)\b/i.test(texto);
  const temConvencao = /\b(?:conven[cç][aã]o)\b/i.test(texto);

  let tipoDoc: "convencao" | "regimento" | null = null;
  if (temRegimento && !temConvencao) tipoDoc = "regimento";
  else if (temConvencao && !temRegimento) tipoDoc = "convencao";

  while ((m = regex.exec(texto)) !== null) {
    const num = parseInt(m[1], 10);
    if (!isNaN(num) && num > 0) {
      resultados.push({
        numero: num,
        tipoDoc,
        rotulo: `Artigo ${num}`,
      });
    }
  }
  return resultados;
}

/**
 * Busca determinística exata por artigo na tabela documento_artigos.
 * Garante 100% de precisão para qualquer citação direta de artigo (ex.: Art. 98, Art. 45).
 */
export async function buscarArtigosDeterministas({
  supabase,
  condominioId,
  queryTexto,
}: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  condominioId: string;
  queryTexto: string;
}): Promise<ArtigoDeterminista[]> {
  const artigosBuscados = extrairArtigosEspecificos(queryTexto);
  if (artigosBuscados.length === 0) return [];

  const numeros = Array.from(new Set(artigosBuscados.map((a) => a.numero)));
  const tipoFiltro = artigosBuscados[0]?.tipoDoc;

  try {
    let q = supabase
      .from("documento_artigos")
      .select("id, artigo_numero, artigo_rotulo, tipo, capitulo, titulo, conteudo")
      .eq("condominio_id", condominioId)
      .in("artigo_numero", numeros);

    if (tipoFiltro) {
      q = q.eq("tipo", tipoFiltro);
    }

    const { data, error } = await q;
    if (error || !data) {
      console.warn("[buscarArtigosDeterministas] Aviso na busca determinística:", error);
      return [];
    }

    return data as ArtigoDeterminista[];
  } catch (err) {
    console.warn("[buscarArtigosDeterministas] Falha ao consultar documento_artigos:", err);
    return [];
  }
}

export interface ManifestoDocumento {
  tipo: string;
  total_artigos: number;
  primeiro_artigo: number;
  ultimo_artigo: number;
}

/**
 * Retorna o manifesto de integridade dos documentos do condomínio (contagem real de artigos indexados).
 */
export async function obterManifestoIntegridade({
  supabase,
  condominioId,
}: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  condominioId: string;
}): Promise<ManifestoDocumento[]> {
  try {
    const { data, error } = await supabase
      .from("documento_artigos")
      .select("tipo, artigo_numero")
      .eq("condominio_id", condominioId);

    if (error || !data || data.length === 0) return [];

    const porTipo = new Map<string, number[]>();
    for (const row of data) {
      const arr = porTipo.get(row.tipo) ?? [];
      arr.push(row.artigo_numero);
      porTipo.set(row.tipo, arr);
    }

    const out: ManifestoDocumento[] = [];
    for (const [tipo, arts] of porTipo.entries()) {
      arts.sort((a, b) => a - b);
      out.push({
        tipo,
        total_artigos: arts.length,
        primeiro_artigo: arts[0],
        ultimo_artigo: arts[arts.length - 1],
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Avalia se o usuário está fazendo uma pergunta sobre a integridade ou leitura completa dos documentos.
 */
export function ehPerguntaIntegridade(texto: string): boolean {
  const t = (texto ?? "").toLowerCase();
  const termosChecagem = [
    "leitura", "lida", "lido", "lidos", "lidas", "falt", "lacuna", "incompleto",
    "processad", "integra", "íntegra", "completo", "todos os artigos", "quantos artigos",
  ];
  const termosAlvo = [
    "conven", "regimento", "documento", "artigo", "ia", "sistema", "base",
  ];

  const temChecagem = termosChecagem.some((term) => t.includes(term));
  const temAlvo = termosAlvo.some((term) => t.includes(term));

  return temChecagem && temAlvo;
}

