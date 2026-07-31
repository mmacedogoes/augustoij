import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Paperclip, X, ChevronLeft, Lock, RotateCcw, CheckCircle2, FileText, Download, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  getTicket,
  responderTicket,
  encerrarTicket,
  reabrirTicket,
  getAnexoUrl,
  ASSUNTOS,
  type HelpdeskAnexo,
  type HelpdeskAutor,
} from "@/lib/helpdesk.functions";

const MAX_FILE = 5 * 1024 * 1024;
const MIME_OK = /^(application\/pdf|image\/(png|jpe?g|webp)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/;

export function HelpdeskConversa({ ticketId, voltarHref, isAdmin }: { ticketId: string; voltarHref: string; isAdmin?: boolean }) {
  const qc = useQueryClient();
  const fetchTicket = useServerFn(getTicket);
  const responder = useServerFn(responderTicket);
  const encerrar = useServerFn(encerrarTicket);
  const reabrir = useServerFn(reabrirTicket);
  const anexoUrl = useServerFn(getAnexoUrl);

  const [conteudo, setConteudo] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["helpdesk-ticket", ticketId],
    queryFn: () => fetchTicket({ data: { ticketId } }),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.mensagens.length]);

  const encerrado = data?.ticket.status === "encerrado";
  const dentroDoPrazoReabertura = useMemo(() => {
    if (!encerrado || !data?.ticket.encerrado_em) return false;
    const dias = (Date.now() - new Date(data.ticket.encerrado_em).getTime()) / 86400000;
    return dias <= 7;
  }, [encerrado, data?.ticket.encerrado_em]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const atuais = [...arquivos];
    for (const f of Array.from(files)) {
      if (atuais.length >= 3) {
        toast.error("Máximo de 3 anexos por mensagem.");
        break;
      }
      if (f.size > MAX_FILE) {
        toast.error(`"${f.name}" excede 5 MB.`);
        continue;
      }
      if (!MIME_OK.test(f.type)) {
        toast.error(`"${f.name}" — tipo não permitido (PDF, imagem ou DOCX).`);
        continue;
      }
      atuais.push(f);
    }
    setArquivos(atuais);
  }

  async function uploadArquivos(userId: string, ticketId: string): Promise<HelpdeskAnexo[]> {
    const out: HelpdeskAnexo[] = [];
    for (const f of arquivos) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
      const path = `${userId}/${ticketId}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("helpdesk-anexos").upload(path, f, {
        contentType: f.type,
        upsert: false,
      });
      if (error) throw new Error(`Falha ao enviar "${f.name}": ${error.message}`);
      out.push({ path, name: f.name, size: f.size, mime: f.type });
    }
    return out;
  }

  async function handleEnviar() {
    if (conteudo.trim().length < 1) {
      toast.error("Escreva uma mensagem.");
      return;
    }
    if (conteudo.length > 5000) {
      toast.error("Mensagem muito longa (máx. 5000 caracteres).");
      return;
    }
    setEnviando(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("Sessão expirada. Faça login novamente.");
      const anexos = arquivos.length > 0 ? await uploadArquivos(uid, ticketId) : [];
      await responder({ data: { ticketId, conteudo: conteudo.trim(), anexos } });
      setConteudo("");
      setArquivos([]);
      toast.success("Resposta enviada.");
      await refetch();
      qc.invalidateQueries({ queryKey: ["helpdesk-meus-tickets"] });
      qc.invalidateQueries({ queryKey: ["helpdesk-admin-list"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar resposta.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleEncerrar() {
    if (!confirm("Encerrar este chamado?")) return;
    setEncerrando(true);
    try {
      await encerrar({ data: { ticketId } });
      toast.success("Chamado encerrado.");
      await refetch();
      qc.invalidateQueries({ queryKey: ["helpdesk-meus-tickets"] });
      qc.invalidateQueries({ queryKey: ["helpdesk-admin-list"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao encerrar.");
    } finally {
      setEncerrando(false);
    }
  }

  async function handleReabrir() {
    setReabrindo(true);
    try {
      await reabrir({ data: { ticketId } });
      toast.success("Chamado reaberto.");
      await refetch();
      qc.invalidateQueries({ queryKey: ["helpdesk-meus-tickets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reabrir.");
    } finally {
      setReabrindo(false);
    }
  }

  async function abrirAnexo(path: string) {
    try {
      const { url } = await anexoUrl({ data: { path } });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir anexo.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando chamado…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card className="app-card app-card p-8 text-center space-y-3">
        <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Não foi possível carregar o chamado."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
      </Card>
    );
  }

  const { ticket, mensagens } = data;
  const assuntoLabel = ASSUNTOS.find((a) => a.value === ticket.assunto)?.label ?? ticket.assunto;
  const statusMap: Record<string, { label: string; className: string }> = {
    aberto: { label: "Aberto", className: "bg-augusto-gold/20 text-augusto-green border-augusto-gold/40" },
    respondido_admin: { label: "Respondido pelo suporte", className: "bg-augusto-green/15 text-augusto-green border-augusto-green/40" },
    respondido_cliente: { label: "Aguardando suporte", className: "bg-amber-100 text-amber-800 border-amber-300" },
    encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground border-border" },
  };
  const st = statusMap[ticket.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link to={voltarHref as never}><ChevronLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
      <Card className="app-card app-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Protocolo {ticket.protocolo}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground break-words">{ticket.titulo}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{assuntoLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={st.className}>{st.label}</Badge>
            {!encerrado && (
              <Button size="sm" variant="outline" onClick={handleEncerrar} disabled={encerrando}>
                {encerrando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Encerrar</>}
              </Button>
            )}
            {encerrado && dentroDoPrazoReabertura && !isAdmin && (
              <Button size="sm" variant="outline" onClick={handleReabrir} disabled={reabrindo}>
                {reabrindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reabrir</>}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="app-card app-card p-0 overflow-hidden">
        <div ref={scrollRef} className="max-h-[520px] overflow-y-auto p-5 sm:p-6 space-y-4">
          {mensagens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem ainda.</p>
          ) : (
            mensagens.map((m) => (
              <MensagemBubble key={m.id} tipo={m.autor_tipo} conteudo={m.conteudo} anexos={m.anexos} createdAt={m.created_at} onAbrirAnexo={abrirAnexo} />
            ))
          )}
        </div>

        {encerrado && !dentroDoPrazoReabertura ? (
          <div className="border-t border-border/60 p-5 text-sm text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" /> Chamado encerrado há mais de 7 dias. Abra um novo chamado se precisar.
          </div>
        ) : encerrado && !isAdmin ? (
          <div className="border-t border-border/60 p-5 text-sm text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" /> Chamado encerrado. Você pode reabrir dentro de 7 dias.
          </div>
        ) : (
          <div className="border-t border-border/60 p-4 sm:p-5 space-y-3 bg-muted/20">
            <Textarea
              placeholder="Escreva sua mensagem…"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={4}
              maxLength={5000}
              disabled={enviando}
            />
            {arquivos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {arquivos.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs">
                    <FileText className="h-3.5 w-3.5 text-augusto-green" />
                    <span className="max-w-[180px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setArquivos(arquivos.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={enviando || arquivos.length >= 3}
              >
                <Paperclip className="h-4 w-4" /> Anexar ({arquivos.length}/3)
              </Button>
              <Button onClick={handleEnviar} disabled={enviando || conteudo.trim().length === 0} className="gap-1.5">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Enviar</>}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function MensagemBubble({
  tipo, conteudo, anexos, createdAt, onAbrirAnexo,
}: {
  tipo: HelpdeskAutor;
  conteudo: string;
  anexos: HelpdeskAnexo[];
  createdAt: string;
  onAbrirAnexo: (path: string) => void;
}) {
  const isAdmin = tipo === "admin";
  return (
    <div className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
        isAdmin
          ? "bg-augusto-green/10 border border-augusto-green/25 text-foreground"
          : "bg-augusto-gold/15 border border-augusto-gold/30 text-foreground"
      }`}>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          {isAdmin ? "Suporte Augusto.IJ" : "Você"} · {new Date(createdAt).toLocaleString("pt-BR")}
        </p>
        <p className="whitespace-pre-wrap leading-relaxed">{conteudo}</p>
        {anexos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {anexos.map((a, i) => (
              <button
                key={i}
                onClick={() => onAbrirAnexo(a.path)}
                className="inline-flex items-center gap-1.5 rounded border border-border/60 bg-background px-2 py-1 text-xs hover:bg-muted"
              >
                <Download className="h-3 w-3" /> {a.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}