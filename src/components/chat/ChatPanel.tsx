import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Paperclip, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Logo } from "@/components/Logo";
import iconeAsset from "@/assets/condoia-icone.jpg.asset.json";
import { createConversa, listMensagens, extractAttachmentForChat } from "@/lib/chat.functions";
import { getUploadUrl, createDocumento, processDocumento } from "@/lib/documentos.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  condominioId: string;
  hasReadyDocs: boolean;
  conversaId: string | null;
  onConversaCreated: (id: string) => void;
};

type ChatAttachment = {
  fileName: string;
  excerpt: string;
  classificacao: "ata" | "convencao" | "regimento" | "outro";
  file: File;
};

const TIPO_LABEL: Record<ChatAttachment["classificacao"], string> = {
  ata: "ata",
  convencao: "convenção",
  regimento: "regimento interno",
  outro: "documento",
};

export function ChatPanel({ condominioId, hasReadyDocs, conversaId, onConversaCreated }: Props) {
  const ensureConversa = useServerFn(createConversa);
  const fetchMensagens = useServerFn(listMensagens);
  const extractAttachment = useServerFn(extractAttachmentForChat);
  const getUrl = useServerFn(getUploadUrl);
  const createDoc = useServerFn(createDocumento);
  const processDoc = useServerFn(processDocumento);
  const [activeId, setActiveId] = useState<string | null>(conversaId);
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSentRef = useRef<string>("");
  const wasStreamingRef = useRef(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [savingAttachment, setSavingAttachment] = useState(false);

  const restoreInput = (text: string) => {
    const ta = formRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  useEffect(() => {
    setActiveId(conversaId);
    setAttachment(null);
    if (!conversaId) {
      setInitial([]);
      return;
    }
    fetchMensagens({ data: { conversaId } })
      .then((rows) => {
        const mapped: UIMessage[] = (rows as Array<{ id: string; papel: "user" | "assistant"; conteudo: string }>).map(
          (r) => ({
            id: r.id,
            role: r.papel,
            parts: [{ type: "text", text: r.conteudo }],
          }),
        );
        setInitial(mapped);
      })
      .catch(() => setInitial([]));
  }, [conversaId, fetchMensagens]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: (): Record<string, string> =>
          token ? { Authorization: `Bearer ${token}` } : {},
        body: () => ({
          condominioId,
          conversaId: activeId,
          attachmentContext: attachment?.excerpt ?? null,
          attachmentNome: attachment?.fileName ?? null,
        }),
      }),
    [token, condominioId, activeId, attachment],
  );

  const { messages, sendMessage, status } = useChat({
    id: activeId ?? "new",
    messages: initial,
    transport,
    onError: (e) => {
      toast.error(e?.message?.trim() ? e.message : "Falha na comunicação com a IA. Tente novamente.");
      if (lastSentRef.current) restoreInput(lastSentRef.current);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Detect empty assistant response after streaming completes
  useEffect(() => {
    if (isLoading) {
      wasStreamingRef.current = true;
      return;
    }
    if (!wasStreamingRef.current) return;
    wasStreamingRef.current = false;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const text = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim();
    if (!text) {
      toast.error("Não foi possível obter uma resposta. Tente novamente.");
      if (lastSentRef.current) restoreInput(lastSentRef.current);
    }
  }, [isLoading, messages]);

  const handleSubmit = async (message: { text?: string }) => {
    const text = message.text?.trim();
    if (!text) return;
    if (!hasReadyDocs && !attachment) {
      toast.error("Envie ao menos um documento processado para iniciar o chat.");
      return;
    }
    lastSentRef.current = text;
    let id = activeId;
    if (!id) {
      try {
        const conv = await ensureConversa({ data: { condominioId } });
        id = (conv as { id: string }).id;
        setActiveId(id);
        onConversaCreated(id);
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : "Falha ao criar conversa";
        toast.error(msg);
        restoreInput(text);
        return;
      }
    }
    try {
      await sendMessage({ text });
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Falha ao enviar mensagem";
      toast.error(msg);
      restoreInput(text);
    }
  };

  const readAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // result = "data:<mime>;base64,XXXX"
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });

  const handleAttachFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo excede 10 MB");
      return;
    }
    if (!/\.(pdf|docx|jpe?g|png|webp)$/i.test(file.name)) {
      toast.error("Formato não suportado. Use PDF, DOCX, JPG, PNG ou WEBP.");
      return;
    }
    setAttachLoading(true);
    const isImage = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (isImage) {
      toast.info(
        "Documento escaneado detectado. Processando conteúdo visual, isso pode levar alguns instantes...",
      );
    } else {
      toast.info("Lendo documento para esta conversa…");
    }
    try {
      const base64 = await readAsBase64(file);
      const res = (await extractAttachment({
        data: { fileName: file.name, base64 },
      })) as {
        excerpt: string;
        classificacao: ChatAttachment["classificacao"];
        fileName: string;
      };
      const att: ChatAttachment = { ...res, file };
      setAttachment(att);
      toast.success("Documento anexado à conversa");
      if (res.classificacao !== "outro") {
        setClassifyOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar documento");
    } finally {
      setAttachLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveAttachmentToCondo = async () => {
    if (!attachment) return;
    setSavingAttachment(true);
    try {
      const tipoMap: Record<ChatAttachment["classificacao"], "ata" | "convencao" | "regimento" | "outro"> = {
        ata: "ata",
        convencao: "convencao",
        regimento: "regimento",
        outro: "outro",
      };
      const { path, token: upToken } = (await getUrl({
        data: { condominioId, nomeArquivo: attachment.fileName },
      })) as { path: string; token: string };
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .uploadToSignedUrl(path, upToken, attachment.file);
      if (upErr) throw new Error(upErr.message);
      const created = (await createDoc({
        data: {
          condominioId,
          nomeArquivo: attachment.fileName,
          tipo: tipoMap[attachment.classificacao],
          storagePath: path,
        },
      })) as { id: string };
      toast.success("Salvando no cadastro do condomínio…");
      processDoc({ data: { id: created.id } })
        .then(() => toast.success("Documento salvo no cadastro do condomínio"))
        .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao processar"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar documento");
    } finally {
      setSavingAttachment(false);
      setClassifyOpen(false);
    }
  };

  // Index of the last assistant message (for single-disclaimer rendering)
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  const inputEnabled = hasReadyDocs || !!attachment;

  return (
    <div className="flex flex-col h-[70vh] min-h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Logo variant="principal" height={36} />}
              title="Pergunte ao assistente"
              description={
                inputEnabled
                  ? "Tire dúvidas sobre a convenção, regimento, atas e contratos do condomínio."
                  : "Envie um documento na aba Documentos ou anexe um arquivo nesta conversa para começar."
              }
            />
          ) : (
            messages.map((m, idx) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              if (m.role === "assistant") {
                const isLast = idx === lastAssistantIdx;
                return (
                  <Message key={m.id} from={m.role} className="max-w-full">
                    <div className="flex gap-3 items-start">
                      <img src={iconeAsset.url} alt="" className="h-7 w-7 rounded-md border border-border bg-card flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <MessageContent>
                          <MessageResponse>{text}</MessageResponse>
                        </MessageContent>
                        {isLast && !isLoading && (
                          <p className="mt-2 text-[12px] italic text-muted-foreground">
                            ⚖️ Esta orientação tem caráter de apoio técnico e não substitui consulta jurídica formal.
                          </p>
                        )}
                      </div>
                    </div>
                  </Message>
                );
              }
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                    {text}
                  </MessageContent>
                </Message>
              );
            })
          )}
          {isLoading && (
            <div className="px-4 py-2">
              <Shimmer>Pensando…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3 space-y-2" ref={formRef}>
        {attachment && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            <Paperclip className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="flex-1 truncate">
              <span className="font-medium">{attachment.fileName}</span>{" "}
              <span className="text-muted-foreground">
                — anexado a esta conversa ({TIPO_LABEL[attachment.classificacao]})
              </span>
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setAttachment(null)}
              title="Remover anexo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleAttachFile(e.target.files[0])}
        />
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={
              inputEnabled
                ? "Pergunte sobre a convenção, ata, contratos…"
                : "Envie documentos para habilitar o chat"
            }
            disabled={!inputEnabled}
          />
          <PromptInputFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachLoading}
              title="Anexar documento à conversa"
            >
              {attachLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Anexar</span>
            </Button>
            <PromptInputSubmit status={status} disabled={!inputEnabled || isLoading} />
          </PromptInputFooter>
        </PromptInput>
        <p className="text-[11px] italic text-muted-foreground text-center px-2 leading-relaxed">
          As respostas geradas pelo CondoIA têm caráter informativo e não substituem a orientação de profissional habilitado. Valide decisões formais com seu advogado.
        </p>
      </div>

      <AlertDialog open={classifyOpen} onOpenChange={setClassifyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar documento no condomínio?</AlertDialogTitle>
            <AlertDialogDescription>
              Este documento parece ser uma{" "}
              <strong>{attachment ? TIPO_LABEL[attachment.classificacao] : "documento"}</strong>.
              Deseja salvá-lo no cadastro do condomínio para uso permanente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAttachment}>
              Não, usar apenas nesta conversa
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingAttachment}
              onClick={(e) => {
                e.preventDefault();
                handleSaveAttachmentToCondo();
              }}
            >
              {savingAttachment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando…
                </>
              ) : (
                "Sim, salvar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}