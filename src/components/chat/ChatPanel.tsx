import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Paperclip,
  X,
  Loader2,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  ArrowUp,
  Copy,
  Megaphone,
  PawPrint,
  CalendarDays,
  FileSearch,
} from "lucide-react";
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
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { createConversa, listMensagens, extractAttachmentForChat } from "@/lib/chat.functions";
import { getUploadUrl, createDocumento, processDocumento } from "@/lib/documentos.functions";
import { getUsoAtual } from "@/lib/uso.functions";
import { avaliarLimite } from "@/lib/uso-limits";
import { UpgradeDialog } from "@/components/chat/UpgradeDialog";
import { usePlanContext } from "@/hooks/usePlanContext";
import { gateMessages } from "@/lib/plan-gates";
import { DocumentoDownload } from "@/components/chat/DocumentoDownload";
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
import {
  PerguntaEstruturada,
  tryParsePerguntaEstruturada,
} from "@/components/chat/PerguntaEstruturada";
import { VoiceControls, type VoiceControlsHandle } from "@/components/chat/VoiceControls";

type Props = {
  condominioId: string;
  hasReadyDocs: boolean;
  /** ID de conversa para carregar do histórico. Lido apenas no mount.
   * Para trocar de conversa, o pai DEVE remontar este componente via `key`. */
  initialConversaId?: string | null;
  onConversaCreated?: (id: string) => void;
  /** Modo visualizador (admin): exibe mensagens mas bloqueia envios/anexos. */
  readOnly?: boolean;
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

/** Sugestões do estado vazio — apenas preenchem o campo, não enviam nada. */
const SUGESTOES = [
  { icon: Megaphone, texto: "Redigir notificação por barulho fora do horário" },
  { icon: PawPrint, texto: "O que diz a convenção sobre animais?" },
  { icon: CalendarDays, texto: "Modelo de convocação de assembleia extraordinária" },
  { icon: FileSearch, texto: "Analisar risco de um contrato de portaria" },
] as const;

/** Botão de copiar resposta (aparece no hover; sempre visível no toque). */
function CopiarResposta({ texto }: { texto: string }) {
  return (
    <button
      type="button"
      aria-label="Copiar resposta"
      title="Copiar resposta"
      onClick={() => {
        navigator.clipboard
          .writeText(texto)
          .then(() => toast.success("Resposta copiada"))
          .catch(() => toast.error("Não foi possível copiar"));
      }}
      className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-50 transition-opacity duration-200 hover:bg-muted/60 hover:text-foreground md:opacity-0 md:group-hover/msg:opacity-100"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * Bloco 10 — perguntas estruturadas.
 * A IA pode emitir um bloco fenced ```pergunta-estruturada\n{json}\n```
 * com { "pergunta": "...", "opcoes": ["...", "..."] }.
 * Removemos o bloco do texto visível e renderizamos as opções como botões.
 */
function extractStructuredQuestion(text: string): {
  visible: string;
  pergunta: string | null;
  opcoes: string[];
} {
  const fence = /```pergunta-estruturada\s*([\s\S]*?)```/i;
  const m = text.match(fence);
  if (!m) return { visible: text, pergunta: null, opcoes: [] };
  let pergunta: string | null = null;
  let opcoes: string[] = [];
  try {
    const parsed = JSON.parse(m[1].trim()) as {
      pergunta?: string;
      opcoes?: unknown;
    };
    pergunta = parsed.pergunta ?? null;
    if (Array.isArray(parsed.opcoes)) {
      opcoes = parsed.opcoes.filter((o): o is string => typeof o === "string").slice(0, 6);
    }
  } catch {
    return { visible: text, pergunta: null, opcoes: [] };
  }
  return { visible: text.replace(fence, "").trim(), pergunta, opcoes };
}

/**
 * Detecta se o texto parece o INÍCIO de uma resposta estruturada
 * (JSON em andamento, possivelmente dentro de fence ```json). Evita
 * que o usuário veja JSON cru durante o streaming até ser parseável.
 */
function pareceJsonEstruturadoParcial(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Pode vir como ```json{... ou direto como {...
  const semFence = t.replace(/^```(?:json)?\s*/i, "");
  if (!semFence.startsWith("{")) return false;
  return /"\s*tipo\s*"\s*:\s*"\s*pergunta_estruturada/i.test(semFence)
    || /pergunta_estruturada/i.test(semFence);
}

const RE_DOC_MARCADOR = /\[\[DOCUMENTO:\s*([^\]]{1,120}?)\s*\]\]/i;
const RE_DOC_HEURISTICA =
  /(CL[ÁA]USULA\s+(PRIMEIRA|1)|NOTIFICA[ÇC][ÃA]O\s+EXTRAJUDICIAL|^PARECER\b|COMUNICADO\s+AOS\s+CONDÔMINOS|Pelo presente instrumento)/im;

/** O usuário pediu explicitamente o arquivo? (ex.: "me manda em docx") */
const RE_PEDIDO_ARQUIVO =
  /\b(pdf|docx?|word|arquivo|documento em anexo|baixar|download|exportar?|gera(r)?\s+o\s+(arquivo|documento))\b/i;

/**
 * Resposta longa e estruturada (título em markdown + seções/numeração) —
 * cobre guias práticos, roteiros, checklists e manuais, que também são
 * conteúdo exportável mesmo sem cara de peça jurídica.
 */
function pareceConteudoEstruturado(t: string): boolean {
  if (t.length < 600) return false;
  const temTitulo = /^#{1,3}\s+\S/m.test(t);
  const secoes = (t.match(/^(#{2,4}\s+\S|\d+[.)]\s+\S|[-*]\s+\S)/gm) ?? []).length;
  return temTitulo && secoes >= 3;
}

/**
 * Identifica se a mensagem do assistente contém uma minuta de documento
 * passível de exportação. Só oferece o download quando o streaming acabou.
 */
function detectarDocumento(
  text: string,
  aindaStreaming: boolean,
  pedidoExplicito = false,
): { titulo: string; conteudo: string; limparVisivel: (s: string) => string } | null {
  if (aindaStreaming) return null;
  const t = (text ?? "").trim();
  if (t.length < 300) return null;
  const m = t.match(RE_DOC_MARCADOR);
  if (
    !m &&
    !RE_DOC_HEURISTICA.test(t) &&
    !pareceConteudoEstruturado(t) &&
    !pedidoExplicito
  ) {
    return null;
  }

  const limpar = (s: string) =>
    s.replace(RE_DOC_MARCADOR, "").replace(/\n{3,}/g, "\n\n").trim();

  let titulo = m?.[1]?.trim() ?? "";
  if (!titulo) {
    const primeira = limpar(t)
      .split("\n")
      .map((l) => l.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim())
      .find((l) => l.length > 3);
    titulo = primeira ?? "Documento";
  }
  return { titulo, conteudo: limpar(t), limparVisivel: limpar };
}

export function ChatPanel({
  condominioId,
  hasReadyDocs,
  initialConversaId = null,
  onConversaCreated,
  readOnly = false,
}: Props) {
  const ensureConversa = useServerFn(createConversa);
  const fetchMensagens = useServerFn(listMensagens);
  const extractAttachment = useServerFn(extractAttachmentForChat);
  const getUrl = useServerFn(getUploadUrl);
  const createDoc = useServerFn(createDocumento);
  const processDoc = useServerFn(processDocumento);
  // useChat `id` deve ser ESTÁVEL pela vida do componente.
  // Trocar `id` reseta o store interno do hook e descarta a mensagem
  // recém-enviada (raiz do bug "primeira mensagem some").
  const sessionKeyRef = useRef<string>(
    initialConversaId ?? `new-${Math.random().toString(36).slice(2)}`,
  );
  const [historyLoaded, setHistoryLoaded] = useState(!initialConversaId);
  const [historyError, setHistoryError] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSentRef = useRef<string>("");
  const wasStreamingRef = useRef(false);
  // ID da conversa "em curso". Atualizado por ref para que o transport
  // leia o valor mais recente sem disparar reset do useChat.
  const activeIdRef = useRef<string | null>(initialConversaId);
  const tokenRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef<VoiceControlsHandle | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [savingAttachment, setSavingAttachment] = useState(false);

  const attachmentRef = useRef<ChatAttachment | null>(null);
  useEffect(() => {
    attachmentRef.current = attachment;
  }, [attachment]);

  // Uso atual de mensagens (mês/dia) — usado para bloqueio + rodapé
  const fetchUso = useServerFn(getUsoAtual);
  const usoQuery = useQuery({
    queryKey: ["uso-atual"],
    queryFn: () => fetchUso(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const uso = usoQuery.data;
  const limiteStatus = uso ? avaliarLimite(uso) : { bloqueado: false as const };
  const bloqueadoPorLimite = limiteStatus.bloqueado;
  const { data: planCtx } = usePlanContext();
  const uploadPermitidoPeloPlano = planCtx?.recursos.uploadDocumentos ?? true;
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Ao ficar bloqueado, abre o modal automaticamente uma vez
  const openedForBlockRef = useRef(false);
  useEffect(() => {
    if (bloqueadoPorLimite && !openedForBlockRef.current) {
      openedForBlockRef.current = true;
      setUpgradeOpen(true);
    }
    if (!bloqueadoPorLimite) {
      openedForBlockRef.current = false;
    }
  }, [bloqueadoPorLimite]);

  // Lista adicional de anexos (multi-upload). O `attachment` acima
  // permanece como "principal" para compatibilidade com o diálogo
  // de classificação. Todos os anexos contribuem com `excerpt` ao body.
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const focusInput = () => {
    const ta = formRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;
    ta?.focus();
  };

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
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      setToken(t);
      tokenRef.current = t;
    });
  }, []);


  // Transport é estável — lê tudo via refs, eliminando race condition
  // (state recém-setado ainda não propagou quando sendMessage roda).
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: (): Record<string, string> =>
          tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        body: () => ({
          condominioId,
          conversaId: activeIdRef.current,
          attachmentContext:
            attachmentsRef.current.length > 0
              ? attachmentsRef.current
                  .map((a) => `# ${a.fileName}\n${a.excerpt}`)
                  .join("\n\n---\n\n")
              : null,
          attachmentNome:
            attachmentsRef.current.length > 0
              ? attachmentsRef.current.map((a) => a.fileName).join(", ")
              : null,
        }),
      }),
    [condominioId],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: sessionKeyRef.current,
    messages: [],
    transport,
    onError: (e) => {
      console.error("[chat] erro na resposta da IA:", e);
      // Se o servidor devolveu 429 com JSON { error: "limit_reached", ... },
      // o AI SDK propaga a mensagem crua. Detecta e força o modal em vez de toast.
      const raw = e?.message ?? "";
      let handledLimit = false;
      try {
        const parsed = JSON.parse(raw) as { error?: string; message?: string };
        if (parsed?.error === "limit_reached") {
          usoQuery.refetch();
          setUpgradeOpen(true);
          toast.error(parsed.message ?? "Limite de mensagens atingido.");
          handledLimit = true;
        }
      } catch {
        /* not JSON */
      }
      if (!handledLimit) {
        toast.error(raw.trim() ? raw : "Falha na comunicação com a IA. Tente novamente.");
      }
      if (lastSentRef.current) restoreInput(lastSentRef.current);
    },
  });

  // Atualiza o contador de uso ao terminar cada resposta da IA
  useEffect(() => {
    if (status === "ready" || status === "error") {
      usoQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Carrega histórico via setMessages (useChat ignora prop `messages` após mount).
  useEffect(() => {
    if (!initialConversaId) {
      // Seed: mensagem inicial do assistente injetada por outra tela
      // (ex.: análise do contrato → "Conversar sobre este contrato").
      // Chave: `chat-seed-assistant-${condominioId}`.
      let seeded: UIMessage[] = [];
      try {
        const key = `chat-seed-assistant-${condominioId}`;
        const raw = sessionStorage.getItem(key);
        if (raw) {
          sessionStorage.removeItem(key);
          seeded = [
            {
              id: `seed-${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              parts: [{ type: "text", text: raw }],
            },
          ];
        }
      } catch { /* ignora */ }
      setMessages(seeded);
      setHistoryLoaded(true);
      return;
    }
    setHistoryLoaded(false);
    setHistoryError(false);
    console.log("[chat] carregando histórico da conversa:", initialConversaId);
    fetchMensagens({ data: { conversaId: initialConversaId } })
      .then((rows) => {
        console.log("[chat] mensagens recebidas:", (rows as unknown[])?.length ?? 0);
        const mapped: UIMessage[] = (
          rows as Array<{ id: string; papel: "user" | "assistant"; conteudo: string }>
        ).map((r) => ({
          id: r.id,
          role: r.papel,
          parts: [{ type: "text", text: r.conteudo }],
        }));
        setMessages(mapped);
        setTimeout(() => {
          const container = document.querySelector("[data-chat-scroll]") as HTMLElement | null;
          if (container) container.scrollTop = container.scrollHeight;
        }, 100);
      })
      .catch((e) => {
        console.error("[chat] falha ao carregar histórico:", e);
        setHistoryError(true);
        toast.error("Não foi possível carregar a conversa.");
      })
      .finally(() => setHistoryLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversaId]);

  const isLoading = status === "submitted" || status === "streaming";

  // Timeout de segurança: se a IA não terminar em 90s, aborta e
  // libera o botão para o usuário tentar de novo.
  useEffect(() => {
    if (isLoading) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        try {
          stop();
        } catch (e) {
          console.error("[chat] falha ao abortar timeout:", e);
        }
        toast.error("A IA demorou para responder. Tente novamente.");
        if (lastSentRef.current) restoreInput(lastSentRef.current);
      }, 90_000);
    } else if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      // Após terminar (sucesso ou abort), devolve o foco ao input.
      focusInput();
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, stop]);

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
      return;
    }
    // Leitura automática por voz, se o usuário ativou.
    if (voiceRef.current?.autoSpeak && !spokenIdsRef.current.has(last.id)) {
      spokenIdsRef.current.add(last.id);
      // Remove blocos técnicos (```json / ```pergunta-estruturada) antes de falar
      const paraFalar = text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (paraFalar) {
        voiceRef.current.speak(paraFalar).catch((e) => console.error("[voz] auto", e));
      }
    }
  }, [isLoading, messages]);

  const handleSubmit = async (message: { text?: string }) => {
    const text = message.text?.trim();
    if (!text) return;
    if (!historyLoaded) return; // não enviar enquanto histórico carrega
    if (!hasReadyDocs && attachments.length === 0) {
      toast.error("Envie ao menos um documento processado para iniciar o chat.");
      return;
    }
    // Garante token disponível antes do envio (evita 1ª mensagem
    // falhar quando supabase.auth.getSession ainda não retornou).
    if (!tokenRef.current) {
      try {
        const { data } = await supabase.auth.getSession();
        const t = data.session?.access_token ?? null;
        tokenRef.current = t;
        setToken(t);
      } catch (e) {
        console.error("[chat] falha ao obter sessão:", e);
      }
    }
    lastSentRef.current = text;
    let id = activeIdRef.current;
    if (!id) {
      try {
        const conv = await ensureConversa({ data: { condominioId } });
        id = (conv as { id: string }).id;
        // Atualiza ref ANTES do sendMessage (transport lê de ref).
        // NÃO mexer no `id` do useChat — isso causaria reset e perda da msg.
        activeIdRef.current = id;
        onConversaCreated?.(id);
      } catch (e) {
        console.error("[chat] falha ao criar conversa:", e);
        const msg = e instanceof Error && e.message ? e.message : "Falha ao criar conversa";
        toast.error(msg);
        restoreInput(text);
        return;
      }
    }
    try {
      await sendMessage({ text });
    } catch (e) {
      console.error("[chat] falha em sendMessage:", e);
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

  const handleAttachFiles = async (files: File[]) => {
    const MAX_ATT = 5;
    const livres = MAX_ATT - attachments.length;
    if (livres <= 0) {
      toast.error(`Máximo de ${MAX_ATT} anexos por conversa.`);
      return;
    }
    const lote = files.slice(0, livres);
    setAttachLoading(true);
    let primeiroRelevante: ChatAttachment | null = null;
    for (const file of lote) {
      try {
        await handleAttachFile(file, (att) => {
          if (!primeiroRelevante && att.classificacao !== "outro") {
            primeiroRelevante = att;
          }
        });
      } catch (e) {
        console.error("[chat] falha em anexo:", e);
      }
    }
    setAttachLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (primeiroRelevante) {
      setAttachment(primeiroRelevante);
      setClassifyOpen(true);
    }
  };

  const handleAttachFile = async (
    file: File,
    onAdded?: (att: ChatAttachment) => void,
  ) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo excede 10 MB");
      return;
    }
    if (!/\.(pdf|docx|jpe?g|png|webp)$/i.test(file.name)) {
      toast.error("Formato não suportado. Use PDF, DOCX, JPG, PNG ou WEBP.");
      return;
    }
    const isImage = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (isImage) {
      toast.info(
        `Lendo imagem "${file.name}" (visão da IA)…`,
      );
    } else {
      toast.info(`Lendo "${file.name}"…`);
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
      setAttachments((prev) => [...prev, att]);
      toast.success(`"${file.name}" anexado`);
      onAdded?.(att);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar documento");
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

  const inputEnabled =
    (hasReadyDocs || attachments.length > 0) && historyLoaded && !bloqueadoPorLimite;

  return (
    <div className="flex flex-col h-full min-h-[520px] border border-border rounded-lg overflow-hidden bg-card">
      <Conversation className="flex-1">
        <ConversationContent className="gap-7 px-4 pb-2 sm:px-6">
          {!historyLoaded ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Carregando conversa…</p>
            </div>
          ) : historyError ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <AlertTriangle className="h-6 w-6" />
              <p className="text-sm">Não foi possível carregar esta conversa.</p>
            </div>
          ) : messages.length === 0 ? (
            <ConversationEmptyState className="gap-5">
              <AugustoLogo variant="icon-only" theme="light" size={64} />
              <div className="space-y-1.5">
                <h3 className="app-section-title">Pergunte ao assistente</h3>
                <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                  {inputEnabled
                    ? "Tire dúvidas sobre a convenção, regimento, atas e contratos do condomínio."
                    : "Envie um documento na aba Documentos ou anexe um arquivo nesta conversa para começar."}
                </p>
              </div>
              <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGESTOES.map(({ icon: Icone, texto }) => (
                  <button
                    key={texto}
                    type="button"
                    onClick={() => restoreInput(texto)}
                    className="app-card app-card-interactive flex items-start gap-2.5 p-[14px] text-left text-[13px] leading-snug text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
                  >
                    <Icone className="mt-px h-4 w-4 shrink-0 text-augusto-gold" strokeWidth={1.75} />
                    <span>{texto}</span>
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m, idx) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              if (m.role === "assistant") {
                const isUltima = idx === messages.length - 1;
                // Se a pergunta anterior pedia o arquivo, oferecemos o
                // download mesmo que o modelo esqueça o marcador.
                const anterior = messages[idx - 1];
                const pedidoExplicito =
                  anterior?.role === "user" &&
                  RE_PEDIDO_ARQUIVO.test(
                    anterior.parts
                      .map((p) => (p.type === "text" ? p.text : ""))
                      .join(""),
                  );
                const doc = detectarDocumento(
                  text,
                  isUltima && isLoading,
                  Boolean(pedidoExplicito),
                );
                const estruturada = tryParsePerguntaEstruturada(text);
                const isLast = idx === messages.length - 1;
                const parcialEstruturado =
                  !estruturada && isLoading && isLast && pareceJsonEstruturadoParcial(text);
                const sq = estruturada || parcialEstruturado ? null : extractStructuredQuestion(text);
                if (estruturada) {
                  return (
                    <Message key={m.id} from={m.role} className="app-enter max-w-full">
                      <div className="chat-assistant w-full">
                        <div className="min-w-0">
                          <PerguntaEstruturada
                            dados={estruturada}
                            disabled={!isLast || isLoading}
                            onResponder={(t) => handleSubmit({ text: t })}
                          />
                        </div>
                      </div>
                    </Message>
                  );
                }
                if (parcialEstruturado) {
                  return (
                    <Message key={m.id} from={m.role} className="app-enter max-w-full">
                      <div className="chat-assistant w-full">
                        <div className="min-w-0 text-sm italic text-muted-foreground">
                          Preparando opções…
                        </div>
                      </div>
                    </Message>
                  );
                }
                return (
                  <Message key={m.id} from={m.role} className="app-enter max-w-full">
                    <div className="chat-assistant group/msg relative w-full">
                      <CopiarResposta texto={doc ? doc.limparVisivel(sq!.visible) : sq!.visible} />
                      <div className="min-w-0 pr-8">
                        <MessageContent className="bg-transparent p-0 text-foreground">
                          <MessageResponse>
                            {doc ? doc.limparVisivel(sq!.visible) : sq!.visible}
                          </MessageResponse>
                        </MessageContent>
                        {doc && (
                          <DocumentoDownload
                            conteudo={doc.conteudo}
                            titulo={doc.titulo}
                            condominioId={condominioId}
                          />
                        )}
                        {isLast && !isLoading && sq!.opcoes.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {sq!.pergunta && (
                              <p className="text-xs font-medium text-muted-foreground">
                                {sq!.pergunta}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {sq!.opcoes.map((op) => (
                                <Button
                                  key={op}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSubmit({ text: op })}
                                  disabled={isLoading}
                                >
                                  {op}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Message>
                );
              }
              return (
                <Message key={m.id} from={m.role} className="app-enter max-w-full">
                  <div className="chat-user-bubble whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {text}
                  </div>
                </Message>
              );
            })
          )}
          {isLoading && (
            <div className="chat-assistant flex items-center gap-1.5 py-1" aria-label="Augusto.IJ está escrevendo">
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" style={{ animationDelay: "160ms" }} />
              <span className="chat-typing-dot" style={{ animationDelay: "320ms" }} />
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton className="h-9 w-9" />
      </Conversation>

      <div className="chat-composer space-y-2 p-3" ref={formRef}>
        {attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map((att, i) => (
              <div
                key={`${att.fileName}-${i}`}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs"
              >
                <Paperclip className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="flex-1 truncate">
                  <span className="font-medium">{att.fileName}</span>{" "}
                  <span className="text-muted-foreground">
                    — {TIPO_LABEL[att.classificacao]}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  title="Remover anexo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {readOnly ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200 text-center">
            Modo visualizador — envio de mensagens e anexos desabilitados.
          </div>
        ) : (
          <>
            {bloqueadoPorLimite && uso && (
              <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs leading-relaxed text-foreground/90">
                  <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                  <span>{limiteStatus.bloqueado ? limiteStatus.mensagem : ""}</span>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="w-full gap-1 transition-transform duration-200 active:scale-[0.98] sm:w-auto"
                  onClick={() => setUpgradeOpen(true)}
                >
                  Ver planos <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) =>
                e.target.files?.length && handleAttachFiles(Array.from(e.target.files))
              }
            />
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputTextarea
                autoFocus
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
                  disabled={attachLoading || bloqueadoPorLimite || !uploadPermitidoPeloPlano}
                  title={
                    !uploadPermitidoPeloPlano && planCtx
                      ? gateMessages.uploadDesabilitado(planCtx.planoNome)
                      : "Anexar documento à conversa"
                  }
                >
                  {attachLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Anexar</span>
                </Button>
                <div className="flex items-center gap-1">
                  <VoiceControls
                    disabled={!inputEnabled || isLoading}
                    onTranscribed={(text) => restoreInput(text)}
                    onReady={(h) => {
                      voiceRef.current = h;
                    }}
                  />
                  <PromptInputSubmit status={status} disabled={!inputEnabled || isLoading} />
                </div>
              </PromptInputFooter>
            </PromptInput>
            <div className="space-y-1.5 px-2">
              {uso && <UsageFooter uso={uso} />}
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80">
                As respostas são geradas por IA e devem ser verificadas para casos críticos.
              </p>
            </div>
          </>
        )}
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

      {uso && (
        <UpgradeDialog
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          planoAtual={uso.planoId}
          motivo={limiteStatus.bloqueado ? limiteStatus.motivo : "mensal"}
        />
      )}
    </div>
  );
}