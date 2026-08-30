import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Sparkles, AlertCircle, Download, FileText } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DOC_MARKER_RE, gerarPdf, gerarDocx, validarConteudo } from "@/lib/documento-export";

interface ChatContratoPanelProps {
  contratoId: string;
  condominioId: string;
  prestadorNome: string;
}

export function ChatContratoPanel({
  contratoId,
  condominioId,
  prestadorNome,
}: ChatContratoPanelProps) {
  const [conversaId, setConversaId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token ?? null;
    });
  }, []);

  const { data: conversa, isLoading: loadingConversa } = useQuery({
    queryKey: ["chat-contrato", contratoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversas")
        .select("id")
        .eq("condominio_id", condominioId)
        .contains("metadata", { contrato_id: contratoId, tipo: "contrato" })
        .maybeSingle();

      if (data) return data;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Sessão expirada. Faça login novamente.");

      const { data: newConv, error: createError } = await supabase
        .from("conversas")
        .insert({
          condominio_id: condominioId,
          user_id: userId,
          titulo: `Análise: ${prestadorNome}`,
          metadata: { contrato_id: contratoId, tipo: "contrato" },
        })
        .select("id")
        .single();

      if (createError) throw createError;
      return newConv;
    },
  });

  useEffect(() => {
    if (conversa?.id) setConversaId(conversa.id);
  }, [conversa]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: (): Record<string, string> =>
          tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        body: () => ({
          condominioId,
          conversaId,
          contratoId,
        }),
      }),
    [condominioId, conversaId, contratoId],
  );

  const { messages, sendMessage, status } = useChat({
    id: conversaId ?? undefined,
    transport: transport as any,
    onError: (err: Error) => {
      console.error("Chat error:", err);
      toast.error("Ocorreu um erro na comunicação com a IA.");
    }
  });

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const handleExport = async (content: string, type: 'pdf' | 'docx') => {
    const error = validarConteudo(content);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      if (type === 'pdf') await gerarPdf(content, "DOCUMENTO");
      else await gerarDocx(content, "DOCUMENTO");
      toast.success("Documento gerado com sucesso.");
    } catch (e) {
      console.error("Export error:", e);
      toast.error("Falha ao gerar o arquivo.");
    }
  };

  if (loadingConversa) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-augusto-gold" />
        <p className="text-sm text-muted-foreground">Iniciando ambiente de análise...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-augusto-gold/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-augusto-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Perguntar à IJ</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Contexto isolado: {prestadorNome}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Como posso ajudar com este contrato?</p>
                <p className="text-xs text-muted-foreground px-8">
                  Você pode perguntar sobre prazos, reajustes, obrigações do prestador ou pedir para redigir um aditivo.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                {[
                  "Quais as principais obrigações?",
                  "Quando é o próximo reajuste?",
                  "Resuma as regras de rescisão"
                ].map((sug) => (
                  <Button 
                    key={sug}
                    variant="outline" 
                    size="sm" 
                    className="text-[11px] h-8 justify-start font-normal"
                    onClick={() => {
                      (sendMessage as any)(sug);
                    }}
                  >
                    {sug}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m: any) => {
            // No V4 do AI SDK, as partes estão em m.parts.
            // Tentamos extrair o texto de forma segura.
            const content = m.content || (m.parts ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') : "");
            const hasDocMarker = DOC_MARKER_RE.test(content);
            DOC_MARKER_RE.lastIndex = 0;

            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col gap-2 animate-in fade-in duration-300",
                  m.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user"
                      ? "bg-augusto-gold text-white rounded-tr-none"
                      : "bg-muted text-foreground rounded-tl-none border border-border"
                  )}
                >
                  <div 
                    className={cn(
                      "prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed",
                      "prose-headings:text-foreground prose-a:text-augusto-gold hover:prose-a:underline"
                    )}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </div>

                  {m.role === "assistant" && hasDocMarker && !isLoading && (
                    <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] gap-2 bg-background"
                        onClick={() => handleExport(content, 'pdf')}
                      >
                        <Download className="w-3 h-3" />
                        Baixar PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] gap-2 bg-background"
                        onClick={() => handleExport(content, 'docx')}
                      >
                        <FileText className="w-3 h-3" />
                        Baixar Word
                      </Button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground px-1 uppercase tracking-tighter font-medium">
                  {m.role === "user" ? "Você" : "Augusto.IJ"}
                </span>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-2 animate-pulse">
              <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3 border border-border">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-augusto-gold/40 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-augusto-gold/40 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-augusto-gold/40 animate-bounce"></span>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>Falha na conexão. Verifique sua internet.</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-muted/30 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!conversaId || !input.trim()) return;
            (sendMessage as any)(input);
            setInput('');
          }}
          className="relative max-w-3xl mx-auto"
        >
          <input
            className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-augusto-gold/20 transition-all placeholder:text-muted-foreground/60"
            placeholder="Digite sua dúvida sobre este contrato..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !conversaId}
          />
          <Button
            size="icon"
            type="submit"
            disabled={!input.trim() || isLoading || !conversaId}
            className={cn(
              "absolute right-1.5 top-1.5 h-8 w-8 rounded-lg transition-all",
              input.trim() ? "bg-augusto-gold hover:bg-augusto-gold/90 text-white" : "bg-muted text-muted-foreground"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Pressione Enter para enviar. Augusto.IJ pode cometer erros.
        </p>
      </div>
    </div>
  );
}
