/**
 * Captura de áudio da mesa: um MediaStream, dois gravadores.
 *
 * - Mestre: contínuo, timeslice de 5s, pedaços acumulados em IndexedDB e
 *   concatenados no encerramento (acervo, sem cortes).
 * - Blocos: ciclos de 5 min (stop/start), cada bloco é um arquivo completo
 *   e independente, enviado durante a sessão para alimentar a transcrição.
 *
 * Nada aqui fala com o Supabase diretamente: o envio usa URL assinada
 * gerada no servidor.
 */

const DB_NAME = "augusto-gravacoes";
const STORE_MESTRE = "mestre";
const STORE_PENDENTES = "pendentes";

export const DURACAO_BLOCO_MS = 5 * 60 * 1000;
const TIMESLICE_MESTRE_MS = 5000;

export type FormatoAudio = { mimeType: string; extensao: string };

export function escolherFormato(): FormatoAudio {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", extensao: "webm" };
  }
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4")) {
    return { mimeType: "audio/mp4", extensao: "mp4" };
  }
  return { mimeType: "", extensao: "webm" };
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MESTRE)) db.createObjectStore(STORE_MESTRE, { autoIncrement: true });
      if (!db.objectStoreNames.contains(STORE_PENDENTES)) db.createObjectStore(STORE_PENDENTES, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(store: string, valor: unknown): Promise<void> {
  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).add(valor as any);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function lerTudo<T>(store: string): Promise<T[]> {
  const db = await abrirDb();
  const itens = await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return itens;
}

export async function limparStore(store: string): Promise<void> {
  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Pedaços do mestre deixados por um fechamento acidental. */
export async function pedacosMestrePendentes(): Promise<Blob[]> {
  return lerTudo<Blob>(STORE_MESTRE);
}

export async function blocosPendentes(): Promise<Array<{ blob: Blob; ordem: number; offset: number; duracao: number }>> {
  return lerTudo(STORE_PENDENTES);
}

export type EstadoGravacao = {
  gravando: boolean;
  modo: "duplo" | "unico";
  formato: FormatoAudio;
  segundos: number;
  blocosEnviados: number;
  blocosPendentes: number;
};

export type CallbacksGravador = {
  onEstado: (estado: Partial<EstadoGravacao>) => void;
  /** Deve enviar o bloco e resolver quando o registro no servidor terminar. */
  enviarBloco: (blob: Blob, ordem: number, offsetSeg: number, duracaoSeg: number) => Promise<void>;
  enviarMestre: (blob: Blob, duracaoSeg: number) => Promise<void>;
};

export class GravadorMesa {
  private stream: MediaStream | null = null;
  private mestre: MediaRecorder | null = null;
  private blocos: MediaRecorder | null = null;
  private timerBloco: number | null = null;
  private inicioMs = 0;
  private ordemBloco = 0;
  private offsetAcumulado = 0;
  private enviados = 0;
  private wakeLock: any = null;
  private encerrando = false;

  readonly formato = escolherFormato();
  modo: "duplo" | "unico" = "duplo";

  constructor(private cb: CallbacksGravador) {}

  get segundos() {
    return this.inicioMs ? Math.floor((Date.now() - this.inicioMs) / 1000) : 0;
  }

  private options() {
    return this.formato.mimeType ? { mimeType: this.formato.mimeType } : undefined;
  }

  async iniciar(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.inicioMs = Date.now();
    this.encerrando = false;

    try {
      this.wakeLock = await (navigator as any).wakeLock?.request("screen");
    } catch {
      this.wakeLock = null;
    }

    this.mestre = new MediaRecorder(this.stream, this.options());
    this.mestre.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) void put(STORE_MESTRE, e.data);
    };
    this.mestre.start(TIMESLICE_MESTRE_MS);

    // Testa suporte a dois gravadores simultâneos sobre o mesmo stream.
    try {
      const teste = new MediaRecorder(this.stream, this.options());
      teste.start();
      teste.stop();
      this.modo = "duplo";
    } catch {
      this.modo = "unico";
    }

    if (this.modo === "duplo") this.iniciarCicloBlocos();
    this.cb.onEstado({ gravando: true, modo: this.modo, formato: this.formato, segundos: 0 });
  }

  private iniciarCicloBlocos() {
    if (!this.stream || this.encerrando) return;
    const rec = new MediaRecorder(this.stream, this.options());
    const pedacos: Blob[] = [];
    const inicioBloco = Date.now();

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) pedacos.push(e.data);
    };
    rec.onstop = async () => {
      const duracao = (Date.now() - inicioBloco) / 1000;
      const blob = new Blob(pedacos, { type: this.formato.mimeType || "audio/webm" });
      this.ordemBloco += 1;
      const ordem = this.ordemBloco;
      const offset = this.offsetAcumulado;
      this.offsetAcumulado += duracao;

      try {
        await this.cb.enviarBloco(blob, ordem, offset, duracao);
        this.enviados += 1;
        this.cb.onEstado({ blocosEnviados: this.enviados });
      } catch {
        await put(STORE_PENDENTES, { blob, ordem, offset, duracao });
        const pend = await blocosPendentes();
        this.cb.onEstado({ blocosPendentes: pend.length });
      }
      if (!this.encerrando) this.iniciarCicloBlocos();
    };

    rec.start();
    this.blocos = rec;
    this.timerBloco = window.setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, DURACAO_BLOCO_MS);
  }

  /** Reenvia em segundo plano os blocos que ficaram pendentes. */
  async reenviarPendentes(): Promise<number> {
    const pendentes = await blocosPendentes();
    let ok = 0;
    for (const p of pendentes) {
      try {
        await this.cb.enviarBloco(p.blob, p.ordem, p.offset, p.duracao);
        ok += 1;
      } catch {
        /* mantém em IndexedDB para a próxima tentativa */
      }
    }
    if (ok === pendentes.length) await limparStore(STORE_PENDENTES);
    this.cb.onEstado({ blocosPendentes: pendentes.length - ok });
    return ok;
  }

  async encerrar(): Promise<void> {
    this.encerrando = true;
    const duracao = this.segundos;

    if (this.timerBloco) window.clearTimeout(this.timerBloco);
    if (this.blocos && this.blocos.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const rec = this.blocos!;
        const anterior = rec.onstop;
        rec.onstop = async (ev) => {
          if (typeof anterior === "function") await (anterior as any).call(rec, ev);
          resolve();
        };
        rec.stop();
      });
    }

    if (this.mestre && this.mestre.state !== "inactive") {
      await new Promise<void>((resolve) => {
        this.mestre!.onstop = () => resolve();
        this.mestre!.stop();
      });
    }

    this.stream?.getTracks().forEach((t) => t.stop());
    try {
      await this.wakeLock?.release?.();
    } catch {
      /* noop */
    }

    const pedacos = await pedacosMestrePendentes();
    if (pedacos.length > 0) {
      const blob = new Blob(pedacos, { type: this.formato.mimeType || "audio/webm" });
      await this.cb.enviarMestre(blob, duracao);
      await limparStore(STORE_MESTRE);
    }

    this.cb.onEstado({ gravando: false, segundos: duracao });
  }
}

/** Remonta o arquivo mestre deixado em IndexedDB após um fechamento acidental. */
export async function remontarMestreInterrompido(): Promise<Blob | null> {
  const pedacos = await pedacosMestrePendentes();
  if (pedacos.length === 0) return null;
  const formato = escolherFormato();
  return new Blob(pedacos, { type: formato.mimeType || "audio/webm" });
}

export function formatarHms(totalSeg: number): string {
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export async function duracaoDoArquivo(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(audio.src);
      resolve(d);
    };
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}
