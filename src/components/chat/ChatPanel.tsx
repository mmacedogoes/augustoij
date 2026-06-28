import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { createConversa, listMensagens } from "@/lib/chat.functions";

type Props = {
  condominioId: string;
  hasReadyDocs: boolean;
  conversaId: string | null;
  onConversaCreated: (id: string) => void;
};

export function ChatPanel({ condominioId, hasReadyDocs, conversaId, onConversaCreated }: Props) {
  const ensureConversa = useServerFn(createConversa);
  const fetchMensagens = useServerFn(listMensagens);
  const [activeId, setActiveId] = useState<string | null>(conversaId);
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<string>("");
  const wasStreamingRef = useRef(false);

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
        body: () => ({ condominioId, conversaId: activeId }),
      }),
    [token, condominioId, activeId],
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
    if (!hasReadyDocs) {
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

  // Index of the last assistant message (for single-disclaimer rendering)
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <div className="flex flex-col h-[70vh] min-h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Logo variant="principal" height={36} />}
              title="Pergunte ao assistente"
              description={
                hasReadyDocs
                  ? "Tire dúvidas sobre a convenção, regimento, atas e contratos do condomínio."
                  : "Envie um documento na aba Documentos para começar."
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
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={
              hasReadyDocs
                ? "Pergunte sobre a convenção, ata, contratos…"
                : "Envie documentos para habilitar o chat"
            }
            disabled={!hasReadyDocs}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!hasReadyDocs || isLoading} />
          </PromptInputFooter>
        </PromptInput>
        <p className="text-[11px] italic text-muted-foreground text-center px-2 leading-relaxed">
          As respostas geradas pelo CondoIA têm caráter informativo e não substituem a orientação de profissional habilitado. Valide decisões formais com seu advogado.
        </p>
      </div>
    </div>
  );
}