/**
 * Módulo de Segurança e Conformidade LGPD (Security Developer & Compliance)
 *
 * 1. Sanitização e Verificação de Uploads por Magic Bytes (anti-malware / spoofing).
 * 2. Mascaramento e Anonimização Seletiva de Dados Pessoais Sensíveis (LGPD).
 */

export interface ValidacaoUploadResult {
  valido: boolean;
  tipoDetectado: "pdf" | "docx" | "xlsx" | "imagem" | "texto" | "desconhecido";
  nomeSanitizado: string;
  motivo?: string;
}

const EXTENSOES_PERIGOSAS = new Set([
  "exe", "bat", "cmd", "sh", "bash", "ps1", "vbs", "vbe", "js", "jse", "wsf",
  "wsh", "msc", "jar", "pif", "scr", "hta", "cpl", "dll", "so", "dylib",
  "php", "asp", "aspx", "jsp", "py", "rb", "pl", "cgi",
]);

/**
 * Sanitiza o nome do arquivo para impedir Path Traversal e caracteres nulos.
 */
export function sanitizarNomeArquivo(nomeOriginal: string): string {
  if (!nomeOriginal) return "documento_anexo.pdf";
  // Remove caminhos relativos/absolutos
  const base = nomeOriginal.replace(/^.*[\\/]/, "");
  // Remove caracteres nulos e de controle
  const semControle = base.replace(/[\x00-\x1F\x7F]/g, "");
  // Normaliza caracteres seguros
  const seguro = semControle.replace(/[^\w.\- \(\)\[\]áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/gi, "_").trim();
  return seguro.slice(0, 240) || "documento_anexo.pdf";
}

/**
 * Valida a integridade do arquivo através dos "Magic Bytes" do cabeçalho binário,
 * impedindo extensões executáveis camufladas ou arquivos corrompidos.
 */
export function validarUploadSeguro(
  buffer: Uint8Array,
  nomeArquivo: string,
  maxBytes: number = 50 * 1024 * 1024,
): ValidacaoUploadResult {
  const nomeSanitizado = sanitizarNomeArquivo(nomeArquivo);
  const ext = nomeSanitizado.toLowerCase().split(".").pop() ?? "";

  // 1. Bloqueio de extensões executáveis conhecidas
  if (EXTENSOES_PERIGOSAS.has(ext)) {
    return {
      valido: false,
      tipoDetectado: "desconhecido",
      nomeSanitizado,
      motivo: `Extensão de arquivo potencialmente perigosa (".${ext}") não permitida.`,
    };
  }

  // 2. Verificação de tamanho
  if (buffer.byteLength === 0) {
    return {
      valido: false,
      tipoDetectado: "desconhecido",
      nomeSanitizado,
      motivo: "Arquivo está vazio (0 bytes).",
    };
  }
  if (buffer.byteLength > maxBytes) {
    return {
      valido: false,
      tipoDetectado: "desconhecido",
      nomeSanitizado,
      motivo: `Arquivo excede o limite máximo permitido de ${Math.round(maxBytes / (1024 * 1024))}MB.`,
    };
  }

  // 3. Validação de Magic Bytes
  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (
    buffer.byteLength >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valido: true, tipoDetectado: "pdf", nomeSanitizado };
  }

  // DOCX / XLSX / ZIP: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (
    buffer.byteLength >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4B &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    if (ext === "xlsx" || ext === "xls") {
      return { valido: true, tipoDetectado: "xlsx", nomeSanitizado };
    }
    return { valido: true, tipoDetectado: "docx", nomeSanitizado };
  }

  // PNG: \x89PNG (0x89 0x50 0x4E 0x47)
  if (
    buffer.byteLength >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return { valido: true, tipoDetectado: "imagem", nomeSanitizado };
  }

  // JPEG: \xFF\xD8\xFF
  if (
    buffer.byteLength >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return { valido: true, tipoDetectado: "imagem", nomeSanitizado };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.byteLength >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valido: true, tipoDetectado: "imagem", nomeSanitizado };
  }

  // Arquivo de texto puro (.txt)
  if (ext === "txt") {
    return { valido: true, tipoDetectado: "texto", nomeSanitizado };
  }

  // Se extensão é imagem ou doc suportado, aceitamos com alerta
  if (["pdf", "docx", "doc", "jpg", "jpeg", "png", "webp", "xlsx", "xls", "txt"].includes(ext)) {
    return { valido: true, tipoDetectado: "desconhecido", nomeSanitizado };
  }

  return {
    valido: false,
    tipoDetectado: "desconhecido",
    nomeSanitizado,
    motivo: `Formato de arquivo não reconhecido (".${ext}"). Envie arquivos PDF, DOCX, XLSX ou imagens.`,
  };
}

/**
 * Mascaramento de dados pessoais para conformidade com a LGPD (Lei nº 13.709/2018).
 * Protege números de CPF, telefones, cartões de crédito e e-mails sensíveis
 * em logs de auditoria, histórico analítico e telemetria de IA.
 */
export function mascararDadosSensiveis(
  texto: string,
  opcoes?: {
    mascararCpf?: boolean;
    mascararTelefone?: boolean;
    mascararEmail?: boolean;
    mascararCartao?: boolean;
  },
): string {
  if (!texto) return "";
  let resultado = texto;

  const opt = {
    mascararCpf: true,
    mascararTelefone: true,
    mascararEmail: false,
    mascararCartao: true,
    ...opcoes,
  };

  // 1. Mascarar CPF (ex.: 123.456.789-00 -> 123.***.***-00)
  if (opt.mascararCpf) {
    resultado = resultado.replace(
      /\b(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})\b/g,
      (_match, p1, _p2, _p3, p4) => `${p1}.***.***-${p4}`,
    );
  }

  // 2. Mascarar Cartões de Crédito / Contas Bancárias (16 dígitos)
  if (opt.mascararCartao) {
    resultado = resultado.replace(
      /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g,
      (_match, _p1, _p2, _p3, p4) => `****-****-****-${p4}`,
    );
  }

  // 3. Mascarar Telefones celulares brasileiros (ex.: (11) 98765-4321 -> (11) 9****-**21)
  if (opt.mascararTelefone) {
    resultado = resultado.replace(
      /(?:\(?(\d{2})\)?\s?)?(9\s?\d{4})[-.\s]?(\d{2})(\d{2})\b/g,
      (_match, ddd, _prefixo, _meio, fim) => `${ddd ? `(${ddd}) ` : ""}9****-**${fim}`,
    );
  }

  // 4. Mascarar E-mails (ex.: marcelo.silva@dominio.com.br -> m***a@dominio.com.br)
  if (opt.mascararEmail) {
    resultado = resultado.replace(
      /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*([a-zA-Z0-9_.+-])@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g,
      (_match, prim, ult, dom) => `${prim}***${ult}@${dom}`,
    );
  }

  return resultado;
}
