import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Controles de voz do chat com o Augusto.
 * - Botão 🎤 grava a fala do usuário e devolve o texto pra props.onTranscribed.
 * - Toggle 🔊 liga/desliga a leitura automática das respostas.
 * - A instância pai chama `speak()` (via ref) quando uma resposta chega.
 */

const MAX_RECORD_MS = 60_000; // limite duro (proporcional ao caso de uso)

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export type VoiceControlsHandle = {
  speak: (text: string) => Promise<void>;
  autoSpeak: boolean;
};

type Props = {
  disabled?: boolean;
  onTranscribed: (text: string) => void;
  onReady?: (handle: VoiceControlsHandle) => void;
};

export function VoiceControls({ disabled, onTranscribed, onReady }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("augustoij.autoSpeak") === "1";
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    window.localStorage.setItem("augustoij.autoSpeak", autoSpeak ? "1" : "0");
  }, [autoSpeak]);

  const cleanupRecorder = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const stopSpeaking = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    try {
      await audioCtxRef.current?.close();
    } catch {
      /* ignora */
    }
    audioCtxRef.current = null;
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecorder();
      stopSpeaking();
    };
  }, [cleanupRecorder, stopSpeaking]);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador não suporta gravação por microfone.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("Gravação de áudio indisponível neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const collected = chunksRef.current;
        const mime = rec.mimeType || mimeType || "audio/webm";
        cleanupRecorder();
        setRecording(false);
        const blob = new Blob(collected, { type: mime });
        if (blob.size < 2048) {
          toast.error("Gravação muito curta. Tente novamente.");
          return;
        }
        await sendForTranscription(blob, extForMime(mime));
      };
      rec.start();
      setRecording(true);
      stopTimerRef.current = setTimeout(() => {
        try {
          rec.state === "recording" && rec.stop();
        } catch {
          /* ignora */
        }
        toast.info("Gravação encerrada (limite de 1 min).");
      }, MAX_RECORD_MS);
    } catch (err) {
      console.error("[voz] mic error", err);
      cleanupRecorder();
      setRecording(false);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        toast.error("Permissão de microfone negada. Libere nas configurações do navegador.");
      } else {
        toast.error("Não foi possível acessar o microfone.");
      }
    }
  }, [cleanupRecorder]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      try {
        rec.stop();
      } catch (e) {
        console.error("[voz] stop error", e);
        cleanupRecorder();
        setRecording(false);
      }
    }
  }, [cleanupRecorder]);

  const sendForTranscription = useCallback(
    async (blob: Blob, ext: string) => {
      setTranscribing(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          toast.error("Sessão expirada. Faça login novamente.");
          return;
        }
        const form = new FormData();
        form.append("file", blob, `gravacao.${ext}`);
        const res = await fetch("/api/voz/transcrever", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const json = (await res.json().catch(() => ({}))) as {
          text?: string;
          error?: string;
        };
        if (!res.ok) {
          toast.error(json.error ?? "Falha ao transcrever.");
          return;
        }
        if (!json.text) {
          toast.error("Não consegui entender o áudio.");
          return;
        }
        onTranscribed(json.text);
      } catch (err) {
        console.error("[voz] transcrever", err);
        toast.error("Sem conexão para transcrever. Tente de novo.");
      } finally {
        setTranscribing(false);
      }
    },
    [onTranscribed],
  );

  const speak = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    // limita a 4000 chars — trunca com aviso interno (raro em respostas de chat)
    const input = clean.length > 4000 ? clean.slice(0, 4000) : clean;

    // Se já está falando, cancela antes de começar de novo
    await stopSpeaking();

    const controller = new AbortController();
    abortRef.current = controller;
    setSpeaking(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada.");
        setSpeaking(false);
        return;
      }
      const res = await fetch("/api/voz/falar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: input }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Falha ao gerar fala.");
        setSpeaking(false);
        return;
      }

      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) {
        toast.error("Áudio não suportado neste navegador.");
        setSpeaking(false);
        return;
      }
      const ctx = new AudioCtor({ sampleRate: 24000 });
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* ignora */
        }
      }

      let playhead = 0;
      let pending = new Uint8Array(0);
      const playChunk = (incoming: Uint8Array) => {
        const bytes = new Uint8Array(pending.length + incoming.length);
        bytes.set(pending);
        bytes.set(incoming, pending.length);
        const usable = bytes.length - (bytes.length % 2);
        pending = bytes.slice(usable);
        if (usable === 0) return;
        const samples = new Int16Array(bytes.buffer, 0, usable / 2);
        const floats = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) floats[i] = samples[i] / 32768;
        const buffer = ctx.createBuffer(1, floats.length, 24000);
        buffer.copyToChannel(floats, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if (playhead === 0) playhead = ctx.currentTime + 0.05;
        else playhead = Math.max(playhead, ctx.currentTime);
        source.start(playhead);
        playhead += buffer.duration;
      };

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let sseBuffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += value;
        // split por linhas SSE
        let idx: number;
        while ((idx = sseBuffer.indexOf("\n")) >= 0) {
          const line = sseBuffer.slice(0, idx).trim();
          sseBuffer = sseBuffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data) as { type?: string; audio?: string };
            if (evt.type !== "speech.audio.delta" || !evt.audio) continue;
            const bin = atob(evt.audio);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            playChunk(bytes);
          } catch {
            /* ignora linhas não-JSON */
          }
        }
      }
      // Aguarda o áudio agendado terminar antes de liberar o estado
      const wait = Math.max(0, playhead - ctx.currentTime) * 1000;
      setTimeout(() => {
        setSpeaking(false);
      }, wait + 100);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        setSpeaking(false);
        return;
      }
      console.error("[voz] falar", err);
      toast.error("Não foi possível reproduzir a fala.");
      setSpeaking(false);
    }
  }, [stopSpeaking]);

  // Expõe handle ao pai (para auto-speak quando resposta chegar)
  useEffect(() => {
    onReady?.({ speak, autoSpeak });
  }, [onReady, speak, autoSpeak]);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant={recording ? "destructive" : "ghost"}
        className="h-[34px] w-[34px] p-0"
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled || transcribing}
        aria-label={recording ? "Parar gravação" : "Falar"}
        title={recording ? "Parar gravação" : "Ditar por voz"}
      >
        {transcribing ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : recording ? (
          <MicOff className="h-[18px] w-[18px]" />
        ) : (
          <Mic className="h-[18px] w-[18px]" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-[34px] w-[34px] p-0"
        onClick={() => {
          if (speaking) {
            stopSpeaking();
            return;
          }
          setAutoSpeak((v) => !v);
        }}
        aria-label={speaking ? "Silenciar" : "Silencioso"}
        title={
          speaking
            ? "Silenciar Augusto"
            : autoSpeak
              ? "Desligar leitura automática das respostas"
              : "Ligar leitura automática das respostas"
        }
      >
        {speaking ? (
          <VolumeX className="h-[18px] w-[18px] text-augusto-gold" />
        ) : autoSpeak ? (
          <Volume2 className="h-[18px] w-[18px] text-augusto-gold" />
        ) : (
          <Volume2 className="h-[18px] w-[18px]" />
        )}
      </Button>
    </div>
  );
}