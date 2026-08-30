/**
 * Mapeador central de erros do pipeline de ingestão de documentos.
 * Converte exceções técnicas em mensagens humanas com etapa, causa e dica.
 * Usado por: documentos.functions, admin-kb.functions, chat.functions.
 */

export type IngestStage =
  | "upload"
  | "leitura"
  | "ocr"
  | "chunking"
  | "embedding"
  | "indexacao"
  | "persistencia"
  | "tamanho"
  | "auth";

const STAGE_LABEL: Record<IngestStage, string> = {
  upload: "envio do arquivo",
  leitura: "leitura do documento",
  ocr: "OCR/visão",
  chunking: "divisão do texto",
  embedding: "geração de embeddings",
  indexacao: "indexação no banco",
  persistencia: "salvamento do status",
  tamanho: "validação de tamanho",
  auth: "autenticação",
};

export class IngestError extends Error {
  readonly stage: IngestStage;
  readonly hint: string;
  readonly technical: string;

  constructor(stage: IngestStage, message: string, hint = "", technical = "") {
    super(message);
    this.name = "IngestError";
    this.stage = stage;
    this.hint = hint;
    this.technical = technical;
  }

  /** Mensagem completa para exibir ao usuário (toast / front-end). */
  toHuman(): string {
    return this.hint ? `${this.message} — ${this.hint}` : this.message;
  }

  /** Texto curto para persistir em `status_processamento` (≤ 200 chars). */
  toStatus(): string {
    return `erro: ${this.message}`.slice(0, 200);
  }
}

/**
 * Transforma qualquer erro em IngestError com classificação por etapa.
 * NUNCA deixa marcadores internos (ex: __NEEDS_VISION__) vazarem.
 */
export function humanizeIngestError(
  err: unknown,
  fallbackStage: IngestStage = "leitura",
): IngestError {
  if (err instanceof IngestError) return err;
  const raw = err instanceof Error ? err.message : String(err ?? "");

  // Sinal interno: arquivo sem texto extraível precisa de visão/OCR
  if (raw === "__NEEDS_VISION__") {
    return new IngestError(
      "ocr",
      "Documento escaneado sem texto extraível",
      "Será processado automaticamente por OCR/visão.",
      raw,
    );
  }

  // PDF protegido
  if (/password|encrypted|protegido/i.test(raw)) {
    return new IngestError(
      "leitura",
      "PDF protegido por senha",
      "Remova a proteção antes de enviar.",
      raw,
    );
  }

  // PDF corrompido
  if (/Invalid PDF|InvalidPDFException|corrupt|corromp/i.test(raw)) {
    return new IngestError(
      "leitura",
      "Arquivo corrompido ou inválido",
      "Reenvie o documento original.",
      raw,
    );
  }

  // Formato não suportado
  if (/Formato de arquivo não suportado|unsupported format/i.test(raw)) {
    return new IngestError(
      "leitura",
      "Formato de arquivo não suportado",
      "Use PDF, DOCX, TXT, JPG, PNG ou WEBP.",
      raw,
    );
  }

  // Arquivo vazio
  if (/vazio|0 bytes|empty file/i.test(raw)) {
    return new IngestError(
      "leitura",
      "Arquivo vazio",
      "Reenvie um arquivo válido.",
      raw,
    );
  }

  // Tempo/limite do gateway durante o OCR — NÃO é documento ilegível.
  if (/gateway (429|5\d\d)|timeout|timed out|aborted|too many requests|rate.?limit/i.test(raw)) {
    return new IngestError(
      "ocr",
      "A leitura foi interrompida por limite temporário do serviço de IA",
      "Clique novamente em “Reler documento” para continuar de onde parou.",
      raw,
    );
  }

  // OCR falhou
  if (/Não foi possível interpretar|vision.*fail|OCR/i.test(raw)) {
    return new IngestError(
      "ocr",
      "Não foi possível ler o conteúdo visual do documento",
      "Verifique se a imagem está legível e tente novamente.",
      raw,
    );
  }


  // Limite/créditos do gateway
  if (/Embedding failed.*429|rate.?limit|too many requests/i.test(raw)) {
    return new IngestError(
      "embedding",
      "Limite temporário da IA atingido",
      "Aguarde alguns instantes e tente novamente.",
      raw,
    );
  }
  if (/Embedding failed.*402|payment required|credit/i.test(raw)) {
    return new IngestError(
      "embedding",
      "Créditos de IA esgotados",
      "Recarregue os créditos para concluir a indexação.",
      raw,
    );
  }
  if (/Embedding failed/i.test(raw)) {
    return new IngestError(
      "embedding",
      "Falha ao gerar embeddings",
      "Tente reprocessar o documento.",
      raw,
    );
  }

  // Timeout / limite de execução
  if (/timeout|deadline|exceeded.*time|cpu time/i.test(raw)) {
    return new IngestError(
      "embedding",
      "Limite de processamento excedido",
      "Divida o documento em partes menores ou tente novamente.",
      raw,
    );
  }

  // Upload / storage
  if (/signed url|bucket|storage|upload/i.test(raw)) {
    return new IngestError(
      "upload",
      "Falha no envio do arquivo",
      "Verifique a conexão e tente novamente.",
      raw,
    );
  }

  // RLS / permissão
  if (/row-level security|policy|permission|not authorized|forbidden/i.test(raw)) {
    return new IngestError(
      "indexacao",
      "Permissão insuficiente para salvar o documento",
      "Sua sessão pode ter expirado — entre novamente.",
      raw,
    );
  }

  // Tamanho
  if (/excede|too large|payload|body.*limit/i.test(raw)) {
    return new IngestError(
      "tamanho",
      "Arquivo grande demais para processamento",
      "Divida em partes menores ou comprima o arquivo.",
      raw,
    );
  }

  // Fallback
  return new IngestError(
    fallbackStage,
    `Falha na etapa de ${STAGE_LABEL[fallbackStage]}`,
    "Tente novamente em instantes.",
    raw,
  );
}

/** Conveniência: lança como Error com a mensagem humana. */
export function throwHumanized(err: unknown, fallbackStage: IngestStage = "leitura"): never {
  const ing = humanizeIngestError(err, fallbackStage);
  // Preserva metadados na própria instância
  throw ing;
}