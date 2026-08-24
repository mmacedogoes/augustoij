import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mic, Square, CircleDot, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  GravadorMesa,
  formatarHms,
  remontarMestreInterrompido,
  limparStore,
} from "@/lib/assembleias/gravador";
import {
  iniciarGravacao,
  urlUploadGravacao,
  registrarBloco,
  registrarMestre,
} from "@/lib/assembleias/gravacao.functions";

const BUCKET = "assembleia-gravacoes";

function tokenDaUrl(signedUrl: string): string {
  try {
    return new URL(signedUrl, window.location.origin).searchParams.get("token") ?? "";
  } catch {
    return "";
  }
}

export function GravacaoMesa({ assembleiaId }: { assembleiaId: string }) {
  const criarUrl = useServerFn(urlUploadGravacao);
  const iniciarFn = useServerFn(iniciarGravacao);
  const registrarBlocoFn = useServerFn(registrarBloco);
  const registrarMestreFn = useServerFn(registrarMestre);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [comunicou, setComunicou] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [pendentes, setPendentes] = useState(0);
  const [modo, setModo] = useState<"duplo" | "unico">("duplo");
  const [recuperavel, setRecuperavel] = useState(false);

  const sessaoIdRef = useRef<string | null>(null);
  const gravadorRef = useRef<GravadorMesa | null>(null);

  useEffect(() => {
    void remontarMestreInterrompido().then((blob) => setRecuperavel(!!blob));
  }, []);

  useEffect(() => {
    if (!gravando) return;
    const t = window.setInterval(() => setSegundos(gravadorRef.current?.segundos ?? 0), 1000);
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const online = () => void gravadorRef.current?.reenviarPendentes();
    window.addEventListener("beforeunload", aviso);
    window.addEventListener("online", online);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("beforeunload", aviso);
      window.removeEventListener("online", online);
    };
  }, [gravando]);

  const enviarArquivo = useCallback(
    async (blob: Blob, tipo: "bloco" | "mestre", nome: string) => {
      const { url, path } = await criarUrl({ data: { assembleiaId, tipo, nomeArquivo: nome } });
      const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, tokenDaUrl(url), blob);
      if (error) throw new Error(error.message);
      return path;
    },
    [assembleiaId, criarUrl],
  );

  const comecar = async () => {
    if (!comunicou) return;
    try {
      const { sessaoId } = await iniciarFn({
        data: {
          assembleiaId,
          comunicouPresentes: true,
          modoGravador: "duplo",
          formato: "auto",
        },
      });
      sessaoIdRef.current = sessaoId;

      const gravador = new GravadorMesa({
        onEstado: (estado) => {
          if (estado.gravando !== undefined) setGravando(estado.gravando);
          if (estado.blocosEnviados !== undefined) setEnviados(estado.blocosEnviados);
          if (estado.blocosPendentes !== undefined) setPendentes(estado.blocosPendentes);
          if (estado.modo) setModo(estado.modo);
        },
        enviarBloco: async (blob, ordem, offset, duracao) => {
          const ext = gravador.formato.extensao;
          const path = await enviarArquivo(blob, "bloco", `bloco-${ordem}.${ext}`);
          await registrarBlocoFn({
            data: {
              assembleiaId,
              sessaoId: sessaoIdRef.current!,
              arquivoPath: path,
              blocoOrdem: ordem,
              offsetInicioSeg: offset,
              duracaoSeg: duracao,
            },
          });
        },
        enviarMestre: async (blob, duracao) => {
          const ext = gravador.formato.extensao;
          const path = await enviarArquivo(blob, "mestre", `mestre.${ext}`);
          await registrarMestreFn({
            data: { assembleiaId, sessaoId: sessaoIdRef.current!, arquivoPath: path, duracaoSeg: duracao },
          });
        },
      });

      gravadorRef.current = gravador;
      await gravador.iniciar();
      setDialogAberto(false);
      if (gravador.modo === "unico") {
        toast.warning(
          "Este navegador não suporta dois gravadores simultâneos. A transcrição só começará ao final da sessão.",
        );
      }
    } catch (err: any) {
      if (String(err?.name) === "NotAllowedError") {
        toast.error(
          "Permissão de microfone negada. Libere o microfone nas configurações do navegador ou envie a gravação como arquivo na tela da Ata.",
        );
      } else {
        toast.error(err?.message ?? "Não foi possível iniciar a gravação.");
      }
    }
  };

  const encerrar = async () => {
    try {
      await gravadorRef.current?.encerrar();
      toast.success("Gravação encerrada e arquivo contínuo enviado.");
      setGravando(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao encerrar a gravação.");
    }
  };

  const recuperar = async () => {
    try {
      const blob = await remontarMestreInterrompido();
      if (!blob) return;
      const { sessaoId } = await iniciarFn({
        data: { assembleiaId, comunicouPresentes: true, modoGravador: "unico", formato: "recuperado" },
      });
      const path = await enviarArquivo(blob, "mestre", "mestre-recuperado.webm");
      await registrarMestreFn({ data: { assembleiaId, sessaoId, arquivoPath: path, duracaoSeg: 0 } });
      await limparStore("mestre");
      setRecuperavel(false);
      toast.success("Gravação interrompida recuperada e enviada.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao recuperar a gravação.");
    }
  };

  return (
    <div className="flex items-center gap-3">
      {gravando ? (
        <div className="text-right">
          <span className="flex items-center gap-2 text-sm font-mono font-bold text-destructive">
            <CircleDot className="h-4 w-4 animate-pulse" aria-hidden />
            Gravando · {formatarHms(segundos)}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            {enviados} bloco(s) enviados
            {pendentes > 0 ? ` · ${pendentes} pendente(s)` : ""}
            {modo === "unico" ? " · gravador único" : ""}
          </span>
        </div>
      ) : recuperavel ? (
        <Button variant="outline" className="gap-2 border-augusto-gold/30" onClick={recuperar}>
          <AlertTriangle className="h-4 w-4 text-augusto-gold" /> Recuperar gravação interrompida
        </Button>
      ) : null}

      {gravando ? (
        <Button variant="destructive" className="gap-2" onClick={encerrar}>
          <Square className="h-4 w-4 fill-current" /> Encerrar gravação
        </Button>
      ) : (
        <Button variant="outline" className="gap-2 border-augusto-gold/30" onClick={() => setDialogAberto(true)}>
          <Mic className="h-4 w-4 text-augusto-gold" /> Iniciar gravação
        </Button>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Iniciar gravação da sessão</DialogTitle>
            <DialogDescription>
              A gravação contém voz de pessoas identificáveis e fica em armazenamento privado, acessível apenas
              por link temporário.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 py-4">
            <Checkbox
              id="comunicou"
              checked={comunicou}
              onCheckedChange={(v) => setComunicou(v === true)}
            />
            <Label htmlFor="comunicou" className="text-sm leading-relaxed font-normal">
              Declaro que a mesa comunicou aos presentes o início da gravação desta assembleia.
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button variant="augusto" disabled={!comunicou} onClick={comecar}>
              Iniciar gravação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
