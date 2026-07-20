import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Paperclip, X, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { abrirTicket, ASSUNTOS, type HelpdeskAnexo, type HelpdeskAssunto } from "@/lib/helpdesk.functions";

const MAX_FILE = 5 * 1024 * 1024;
const MIME_OK = /^(application\/pdf|image\/(png|jpe?g|webp)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/;

export function NovoChamadoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const abrir = useServerFn(abrirTicket);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [assunto, setAssunto] = useState<HelpdeskAssunto | "">("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  function reset() {
    setAssunto(""); setTitulo(""); setConteudo(""); setArquivos([]);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const atuais = [...arquivos];
    for (const f of Array.from(files)) {
      if (atuais.length >= 3) { toast.error("Máximo de 3 anexos."); break; }
      if (f.size > MAX_FILE) { toast.error(`"${f.name}" excede 5 MB.`); continue; }
      if (!MIME_OK.test(f.type)) { toast.error(`"${f.name}" — tipo não permitido.`); continue; }
      atuais.push(f);
    }
    setArquivos(atuais);
  }

  async function handleSubmit() {
    if (!assunto) { toast.error("Escolha o assunto."); return; }
    if (titulo.trim().length < 3) { toast.error("Informe um título com ao menos 3 caracteres."); return; }
    if (conteudo.trim().length < 10) { toast.error("Descreva com pelo menos 10 caracteres."); return; }
    setEnviando(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("Sessão expirada. Faça login novamente.");

      // Upload dos anexos ANTES de criar o ticket? Precisamos do ticket_id no path.
      // Solução: cria ticket com anexos = [], depois de criado faz upload e adiciona mensagem inicial.
      // Como abrirTicket já cria a mensagem inicial, subimos os arquivos com um ID temporário no path.
      const tempFolder = crypto.randomUUID();
      const anexos: HelpdeskAnexo[] = [];
      for (const f of arquivos) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
        const path = `${uid}/${tempFolder}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("helpdesk-anexos").upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw new Error(`Falha ao enviar "${f.name}": ${error.message}`);
        anexos.push({ path, name: f.name, size: f.size, mime: f.type });
      }

      const ticket = await abrir({
        data: { assunto: assunto as HelpdeskAssunto, titulo: titulo.trim(), conteudo: conteudo.trim(), anexos },
      });
      toast.success(`Chamado ${ticket.protocolo} aberto. Enviamos a confirmação por e-mail.`);
      qc.invalidateQueries({ queryKey: ["helpdesk-meus-tickets"] });
      onOpenChange(false);
      reset();
      navigate({ to: "/app/suporte/$ticketId", params: { ticketId: ticket.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir chamado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!enviando) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir novo chamado</DialogTitle>
          <DialogDescription>Respondemos em até 24 horas úteis. Você acompanha tudo aqui em Conta → Suporte.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Select value={assunto} onValueChange={(v) => setAssunto(v as HelpdeskAssunto)}>
              <SelectTrigger><SelectValue placeholder="Escolha o assunto" /></SelectTrigger>
              <SelectContent>
                {ASSUNTOS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} placeholder="Resumo curto do problema ou dúvida" />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={5} maxLength={5000} placeholder="Descreva com detalhes. Prints ajudam." />
            <p className="text-[11px] text-muted-foreground text-right">{conteudo.length}/5000</p>
          </div>
          <div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*" className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={arquivos.length >= 3} className="gap-1.5">
              <Paperclip className="h-4 w-4" /> Anexar arquivo ({arquivos.length}/3)
            </Button>
            {arquivos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {arquivos.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs">
                    <FileText className="h-3.5 w-3.5 text-augusto-green" />
                    <span className="max-w-[180px] truncate">{f.name}</span>
                    <button type="button" onClick={() => setArquivos(arquivos.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">PDF, imagem ou DOCX. Até 3 arquivos, 5 MB cada.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={enviando}>
            {enviando ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando…</> : "Abrir chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}