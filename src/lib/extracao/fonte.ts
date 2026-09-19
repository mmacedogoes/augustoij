import type { SupabaseClient } from "@supabase/supabase-js";
import { consolidarMdDeDocumentoPronto } from "../documentos-processar.server";
import { normalizarLayout } from "./normalizador";

export type PaginaDocumento = {
  numero: number;
  texto: string;
};

export type ResultadoCarregamentoTexto = {
  paginas: PaginaDocumento[];
  fonte: "storage_md" | "reconstruido_md" | "fallback_chunks";
  totalCaracteres: number;
  totalPaginas: number;
  textoIntegral: string;
  linhas_antes_normalizacao?: number;
  linhas_apos_normalizacao?: number;
};

const BUCKET = "documentos";

/**
 * Faz o split do markdown pelas marcações de página geradas pelo consolidador:
 *   "## Página N"
 *   "## Páginas N a M"
 *   "## Página / Bloco N"
 * Preserva o texto exatamente byte a byte sem normalizações, remoção de espaços
 * ou deduplicação.
 */
export function separarPaginasMarkdown(mdConteudo: string): PaginaDocumento[] {
  const regexMarcador = /(?:^|\n)---\s*\n##\s*(?:P[aá]ginas?\s+(\d+)(?:\s*a\s*(\d+))?|P[aá]gina\s*\/\s*Bloco\s+(\d+))\s*\n+/gi;

  const matches: Array<{
    inicio: number;
    fimHeader: number;
    pagInicio: number;
    pagFim: number;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = regexMarcador.exec(mdConteudo)) !== null) {
    const pag1 = match[1] ? Number(match[1]) : Number(match[3]);
    const pag2 = match[2] ? Number(match[2]) : pag1;
    matches.push({
      inicio: match.index,
      fimHeader: match.index + match[0].length,
      pagInicio: pag1,
      pagFim: pag2,
    });
  }

  // Se nenhum marcador estruturado foi encontrado, retorna o documento inteiro como página 1
  if (matches.length === 0) {
    return [{ numero: 1, texto: mdConteudo }];
  }

  const paginas: PaginaDocumento[] = [];

  // Se houver texto introdutório antes do primeiro marcador, inclui como página 1
  if (matches[0].inicio > 0) {
    const preambulo = mdConteudo.slice(0, matches[0].inicio);
    if (preambulo.trim().length > 0) {
      paginas.push({
        numero: 1,
        texto: preambulo,
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const atual = matches[i];
    const proximoInicio = i + 1 < matches.length ? matches[i + 1].inicio : mdConteudo.length;
    // O texto da página é estritamente o trecho entre o fim do cabeçalho atual e o início do próximo marcador
    const textoDaPagina = mdConteudo.slice(atual.fimHeader, proximoInicio);

    paginas.push({
      numero: atual.pagInicio,
      texto: textoDaPagina,
    });
  }

  return paginas;
}

export type CarregarTextoIntegralResult = Promise<ResultadoCarregamentoTexto>;

function processarPaginasCarregadas(
  paginas: PaginaDocumento[],
  fonte: "storage_md" | "reconstruido_md" | "fallback_chunks"
): ResultadoCarregamentoTexto {
  let linhasAntes = 0;
  let linhasApos = 0;

  for (const p of paginas) {
    linhasAntes += p.texto ? p.texto.split("\n").length : 0;
    p.texto = normalizarLayout(p.texto);
    linhasApos += p.texto ? p.texto.split("\n").length : 0;
  }

  const textoIntegral = paginas.map((p) => p.texto).join("\n");

  return {
    paginas,
    fonte,
    totalCaracteres: textoIntegral.length,
    totalPaginas: paginas.length,
    textoIntegral,
    linhas_antes_normalizacao: linhasAntes,
    linhas_apos_normalizacao: linhasApos,
  };
}

/**
 * Carrega o texto integral da transcrição de um documento diretamente do Storage.
 *
 * 1. Tenta baixar `documentos/<condominio_id>/transcricoes/<documento_id>.md`.
 * 2. Se não existir, tenta reconstruí-lo via `consolidarMdDeDocumentoPronto`.
 * 3. Se ainda assim não existir, cai para os chunks de `document_chunks` como fallback.
 *
 * Aplica normalizarLayout em cada página e computa linhas antes e depois da normalização.
 */
export async function carregarTextoIntegral(
  supabase: SupabaseClient,
  documentoId: string,
): CarregarTextoIntegralResult {
  const { data: doc, error: docErr } = await supabase
    .from("documentos")
    .select("id, condominio_id, status_processamento")
    .eq("id", documentoId)
    .single();

  if (docErr || !doc) {
    throw new Error(`Documento não encontrado: ${docErr?.message ?? documentoId}`);
  }

  const storagePath = `${doc.condominio_id}/transcricoes/${doc.id}.md`;

  // 1) Tentar baixar direto do Storage
  try {
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (!downloadErr && fileData) {
      const mdTexto = await fileData.text();
      if (mdTexto && mdTexto.length > 0) {
        const paginas = separarPaginasMarkdown(mdTexto);
        return processarPaginasCarregadas(paginas, "storage_md");
      }
    }
  } catch (errStorage) {
    console.warn("[extracao/fonte] Erro ao baixar MD do storage:", errStorage);
  }

  // 2) Se o .md não existir, tenta reconstruir chamando consolidarMdDeDocumentoPronto
  try {
    const reconst = await consolidarMdDeDocumentoPronto(supabase, documentoId);
    if (reconst.ok) {
      const { data: fileReconst, error: downloadReconstErr } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);

      if (!downloadReconstErr && fileReconst) {
        const mdTexto = await fileReconst.text();
        if (mdTexto && mdTexto.length > 0) {
          const paginas = separarPaginasMarkdown(mdTexto);
          return processarPaginasCarregadas(paginas, "reconstruido_md");
        }
      }
    }
  } catch (errReconst) {
    console.warn("[extracao/fonte] Falha ao tentar reconstruir MD do documento:", errReconst);
  }

  // 3) Fallback final: carregar via document_chunks
  const { data: chunks, error: chunksErr } = await supabase
    .from("document_chunks")
    .select("conteudo, metadata")
    .eq("documento_id", documentoId)
    .order("metadata->ordem_global", { ascending: true, nullsFirst: false });

  if (chunksErr || !chunks || chunks.length === 0) {
    throw new Error(
      `Nenhum texto encontrado no Storage nem nos chunks para o documento ${documentoId}`,
    );
  }

  // Agrupa chunks por página se metadata.pagina_inicio existir
  const paginasMap = new Map<number, string[]>();

  for (const c of chunks) {
    const pag = (c.metadata as any)?.pagina_inicio ?? (c.metadata as any)?.bloco ?? 1;
    if (!paginasMap.has(pag)) {
      paginasMap.set(pag, []);
    }
    paginasMap.get(pag)!.push(c.conteudo);
  }

  const paginas: PaginaDocumento[] = Array.from(paginasMap.entries())
    .sort(([p1], [p2]) => p1 - p2)
    .map(([numero, partes]) => ({
      numero,
      texto: partes.join("\n"),
    }));

  return processarPaginasCarregadas(paginas, "fallback_chunks");
}