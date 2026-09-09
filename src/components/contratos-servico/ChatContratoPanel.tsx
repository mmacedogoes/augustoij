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
  initialPrompt?: string | null;
  /** Chamado assim que o prompt inicial é enviado, para que o pai o limpe. */
  onInitialPromptEnviado?: () => void;
}

export function ChatContratoPanel({
  contratoId,
  condominioId,
  prestadorNome,
  initialPrompt,
  onInitialPromptEnviado,
}: ChatContratoPanelProps) {
  const [conversaId, setConversaId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const initialSentRef = useRef(false);

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

  // Envia o prompt inicial se fornecido
  useEffect(() => {
    if (conversaId && initialPrompt && !initialSentRef.current && !isLoading) {
      initialSentRef.current = true;
      (sendMessage as any)(initialPrompt);
      onInitialPromptEnviado?.();
    }
  }, [conversaId, initialPrompt, isLoading, sendMessage, onInitialPromptEnviado]);

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

  const acoesRapidas = [
    {
      titulo: "Notificar Descumprimento Contratual",
      descricao: "Gerar Notificação Extrajudicial para sanar falha ou vício no serviço",
      prompt: `Redija uma Notificação Extrajudicial formal para o prestador ${prestadorNome}, apontando descumprimento de obrigação contratual e fixando prazo de 5 (cinco) dias para regularização, sob pena de aplicação de multa rescisória e rescisão motivada.`,
    },
    {
      titulo: "Notificar Não Renovação / Rescisão",
      descricao: "Comunicação formal com aviso prévio tempestivo",
      prompt: `Redija uma Notificação Formal de Não Renovação e Término de Vigência para o prestador ${prestadorNome}, manifestando o desinteresse do condomínio na prorrogação automática e solicitando a transição organizada dos serviços.`,
    },
    {
      titulo: "Minuta de Termo Aditivo",
      descricao: "Aditivo de reajuste financeiro ou prorrogação de prazo",
      prompt: `Elabore uma minuta formal de Termo Aditivo ao Contrato de Prestação de Serviços com ${prestadorNome}, contemplando o reajuste anual pelo índice previsto e ratificando as demais cláusulas.`,
    },
    {
      titulo: "Cobrança de CNDs e Encargos Trabalhistas",
      descricao: "Exigir comprovantes de FGTS, INSS e folhas (Súmula 331 TST)",
      prompt: `Redija uma Notificação para ${prestadorNome} solicitando o envio imediato das guias de recolhimento de FGTS, INSS (DCTFWeb), folhas de ponto/pagamento e certidões negativas dos empregados alocados, sob pena de retenção cautelar do pagamento da fatura.`,
    },
  ];

  return (
    <div className="flex flex-col h-[650px] bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-augusto-gold/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-augusto-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Assistente de Gestão Contratual & IA</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Contexto do contrato: {prestadorNome}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-augusto-gold/10 flex items-center justify-center text-augusto-gold">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Como posso apoiar a gestão deste contrato?</p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Selecione uma ação rápida abaixo para minutar um documento jurídico instantâneo ou faça perguntas sobre cláusulas, prazos e obrigações.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left">
                {acoesRapidas.map((acao) => (
                  <button
                    key={acao.titulo}
                    type="button"
                    className="p-3 rounded-lg border border-border/70 bg-card hover:border-augusto-gold/50 hover:bg-augusto-gold/5 transition-all text-left flex flex-col justify-between group"
                    onClick={() => {
                      (sendMessage as any)(acao.prompt);
                    }}
                  >
                    <span className="text-xs font-semibold text-foreground group-hover:text-augusto-gold transition-colors">
                      {acao.titulo}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {acao.descricao}
                    </span>
                  </button>
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
