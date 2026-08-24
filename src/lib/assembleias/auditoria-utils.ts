/**
 * Utilidades puras da auditoria de assembleias.
 * Usadas tanto no servidor (exportações) quanto na interface.
 */

/** O banco guarda o IP inteiro. Tela e arquivos só mostram os dois primeiros grupos. */
export function mascararIp(ip: unknown): string {
  if (!ip) return "—";
  const texto = String(ip);
  if (texto.includes(":")) {
    const g = texto.split(":");
    return `${g[0] || "0"}:${g[1] || "0"}:x:x`;
  }
  const p = texto.split(".");
  if (p.length !== 4) return "x.x.x.x";
  return `${p[0]}.${p[1]}.x.x`;
}

export function resumirAgente(ua: string | null | undefined): { sistema: string; navegador: string } {
  const s = ua || "";
  const sistema =
    /Android/i.test(s) ? "Android" :
    /iPhone|iPad|iOS/i.test(s) ? "iOS" :
    /Windows/i.test(s) ? "Windows" :
    /Mac OS X|Macintosh/i.test(s) ? "macOS" :
    /Linux/i.test(s) ? "Linux" : "Sistema não identificado";
  const navegador =
    /Edg\//i.test(s) ? "Edge" :
    /OPR\/|Opera/i.test(s) ? "Opera" :
    /Chrome\//i.test(s) ? "Chrome" :
    /Firefox\//i.test(s) ? "Firefox" :
    /Safari\//i.test(s) ? "Safari" : "Navegador não identificado";
  return { sistema, navegador };
}

export function agenteResumido(ua: string | null | undefined): string {
  const { sistema, navegador } = resumirAgente(ua);
  return `${sistema} · ${navegador}`;
}

/** Recibo truncado no meio, preservando início e fim. */
export function truncarRecibo(recibo: string | null | undefined): string {
  if (!recibo) return "—";
  if (recibo.length <= 16) return recibo;
  return `${recibo.slice(0, 8)}…${recibo.slice(-6)}`;
}

const MOTIVOS: Record<string, string> = {
  unidade_nao_habilitada: "Unidade não habilitada",
  inadimplente: "Unidade inadimplente no snapshot de habilitação",
  item_fechado: "Item já encerrado no momento da tentativa",
  item_nao_aberto: "Item ainda não aberto para votação",
  voto_duplicado: "Voto já registrado para a unidade neste item",
  sessao_invalida: "Sessão de votante inválida ou expirada",
  token_invalido: "Token de cabine inválido",
  rate_limit: "Excesso de requisições do mesmo endereço",
  procuracao_excedida: "Limite de procurações por outorgado excedido",
};

export function motivoLegivel(motivo: string | null | undefined): string {
  if (!motivo) return "Motivo não informado";
  return MOTIVOS[motivo] ?? motivo.replace(/_/g, " ");
}

const ACOES_MESA: Record<string, string> = {
  "assembleia.item.abrir": "Abertura de votação do item",
  "assembleia.item.encerrar": "Encerramento de votação do item",
  "assembleia.item.apurar": "Apuração do item",
  "assembleia.item.prorrogar": "Prorrogação do tempo de votação",
  "assembleia.item.exibir_parcial": "Exibição de resultado parcial",
  "assembleia.item.anular": "Anulação de item",
  "assembleia.voto.mesa": "Voto lançado pela mesa",
  "assembleia.cabine.abrir": "Abertura de cabine de voto secreto",
  "assembleia.habilitacao.ajuste_mesa": "Ajuste de habilitação pela mesa",
  "assembleia.habilitacao.confirmar": "Congelamento da habilitação",
  "assembleia.sessao.suspender": "Suspensão da sessão",
  "assembleia.sessao.retomar": "Retomada da sessão",
  "assembleia.encerrar": "Encerramento da assembleia",
  "assembleia.ata.publicar": "Publicação da ata",
  "assembleia.auditoria.verificar": "Verificação de integridade da cadeia",
};

export function acaoLegivel(action: string): string {
  return ACOES_MESA[action] ?? action.replace(/^assembleia\./, "").replace(/[._]/g, " ");
}

export const ACOES_MESA_AUDITADAS = Object.keys(ACOES_MESA);

/** Monta um CSV (separador ponto e vírgula, padrão brasileiro) com BOM. */
export function montarCsv(cabecalho: string[], linhas: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const corpo = [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

export function carimbo(iso: string, precisaoMinuto = false): string {
  const d = new Date(iso);
  const p = (n: number, c = 2) => String(n).padStart(c, "0");
  const base = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  if (precisaoMinuto) return base;
  return `${base}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
