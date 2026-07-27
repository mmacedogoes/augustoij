import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Icon } from "@iconify/react";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { cn } from "@/lib/utils";

/**
 * Widget de demonstração pública: 3 perguntas grátis por visitante.
 * A lógica é a mesma do hero antigo — só a casca é nova (papel, borda dourada).
 */

export type Persona = "sindico" | "adm" | "advogado";

const CONVERSAS: Record<Persona, {
  question: string;
  answer: string;
  citation: { label: string; source: string };
}> = {
  sindico: {
    question: "O síndico pode votar em assembleia?",
    answer:
      "Pode, desde que seja condômino e esteja adimplente. Fundamento: art. 1.335, III, do Código Civil. Se o síndico for profissional contratado (não condômino), ele preside ou conduz, mas não vota.",
    citation: { label: "Citação", source: "CC, art. 1.335, III" },
  },
  adm: {
    question: "Como padronizar o processo de convocação de assembleia em 30 condomínios?",
    answer:
      "Recomendo três documentos-padrão: (1) edital de convocação com quórum, ordem do dia e local; (2) lista de presença com espaço para procurações; (3) modelo de ata com campos obrigatórios pré-configurados. Posso gerar os três com base na convenção de cada condomínio.",
    citation: { label: "Fundamentos", source: "CC, art. 1.354 · Lei 14.309/2022 (assembleias virtuais)" },
  },
  advogado: {
    question: "Qual o termo inicial da prescrição de cotas condominiais segundo o STJ?",
    answer:
      "Termo inicial: data de vencimento de cada parcela individualmente. Prazo quinquenal do art. 206, §5º, I, do CC. Aplicação indistinta a cotas ordinárias e extraordinárias.",
    citation: {
      label: "Precedente",
      source:
        "STJ, REsp 1.483.930/DF, Rel. Min. Luis Felipe Salomão, 2ª Seção, j. 23/11/2016, Tema 949 dos repetitivos",
    },
  },
};

const CHIPS = [
  "Quórum para mudança de convenção?",
  "Modelo de notificação por inadimplência",
  "Análise de contrato de portaria",
];

type LiveMsg =
  | { role: "user"; content: string }
  | { role: "augusto"; content: string };

export function DemoChatWidget({ persona = "sindico" }: { persona?: Persona }) {
  const navigate = useNavigate();
  const conversa = CONVERSAS[persona];
  const [input, setInput] = useState("");
  const [live, setLive] = useState<LiveMsg[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [live, loading]);

  async function askAugusto(question: string) {
    const q = question.trim();
    if (!q || loading || limitReached) return;
    setInput("");
    setLive((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/public/demo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = (await res.json()) as {
        answer?: string;
        error?: string;
        remaining?: number;
        limitReached?: boolean;
      };
      if (res.status === 429 && json.limitReached) {
        setLimitReached(true);
        setRemaining(0);
        toast.error("Você usou suas 3 perguntas gratuitas.", {
          description: "Crie sua conta para continuar conversando com o Augusto.IJ.",
          action: { label: "Criar conta", onClick: () => navigate({ to: "/signup" }) },
        });
        setLive((prev) => [...prev, { role: "augusto", content: json.error ?? "Limite atingido." }]);
        return;
      }
      if (!res.ok || !json.answer) {
        toast.error(json.error ?? "Não foi possível gerar a resposta.");
        setLive((prev) => prev.slice(0, -1));
        setInput(q);
        return;
      }
      setLive((prev) => [...prev, { role: "augusto", content: json.answer! }]);
      if (typeof json.remaining === "number") setRemaining(json.remaining);
    } catch {
      toast.error("Falha de rede. Tente novamente.");
      setLive((prev) => prev.slice(0, -1));
      setInput(q);
    } finally {
      setLoading(false);
    }
  }

  const showLive = live.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div
        id="hero-chat"
        className="relative flex h-[560px] flex-col overflow-hidden rounded-md border border-dourado/35 bg-papel text-grafite shadow-[0_24px_60px_-32px_hsl(151_93%_6%/0.55)] sm:h-[600px]"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4 border-b border-borda px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <AugustoLogo variant="icon-only" size={28} />
            <div className="min-w-0">
              <div className="truncate font-body text-[14px] font-semibold text-verde">
                Conversando com o Augusto.IJ
              </div>
              <div className="font-body text-[11px] text-ardosia">
                {limitReached
                  ? "Limite gratuito atingido"
                  : remaining === null
                    ? "3 perguntas grátis por visitante"
                    : `${remaining} pergunta${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-verde/10 px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-verde">
            <span className="h-2 w-2 rounded-full bg-dourado animate-pulse" />
            Online
          </div>
        </div>

        {/* Mensagens */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
        >
          {!showLive ? (
            <div key={persona} className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-md rounded-br-sm bg-bege px-4 py-3 font-body text-[14px] text-grafite">
                  {conversa.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[90%] whitespace-pre-line rounded-md rounded-bl-sm bg-verde px-4 py-3 font-body text-[14px] leading-relaxed text-cream">
                  {conversa.answer}
                </div>
              </div>
              <div className="rounded-r-md border-l-[3px] border-dourado bg-dourado/10 px-3 py-3">
                <div className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-dourado-texto">
                  {conversa.citation.label}
                </div>
                <div className="mt-1 font-body text-[13px] text-grafite">
                  {conversa.citation.source}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 font-heading text-[12px] italic text-ardosia">
                <Icon icon="ph:sparkle" className="h-3.5 w-3.5 text-dourado" />
                Exemplo. Faça sua própria pergunta abaixo, 3 grátis por visitante.
              </div>
            </div>
          ) : (
            live.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={cn(
                    "font-body text-[14px]",
                    m.role === "user"
                      ? "max-w-[85%] rounded-md rounded-br-sm bg-bege px-4 py-3 text-grafite"
                      : "max-w-[92%] whitespace-pre-line rounded-md rounded-bl-sm bg-verde px-4 py-3 leading-relaxed text-cream",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-md rounded-bl-sm bg-verde/90 px-4 py-3 font-body text-[14px] text-cream">
                <Icon icon="ph:circle-notch" className="h-4 w-4 animate-spin" />
                O Augusto.IJ está pensando…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (limitReached) {
              navigate({ to: "/signup" });
              return;
            }
            askAugusto(input);
          }}
          className="m-4 flex items-center gap-2 rounded-md border border-borda bg-off/60 px-3 py-2 transition-colors duration-200 focus-within:border-dourado focus-within:ring-2 focus-within:ring-dourado/25"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || limitReached}
            placeholder={
              limitReached
                ? "Crie sua conta para continuar…"
                : "Pergunte sobre convenção, ata, contratos…"
            }
            className="min-w-0 flex-1 bg-transparent font-body text-[14px] text-grafite outline-none placeholder:text-ardosia/70 disabled:opacity-60"
            aria-label="Pergunte ao Augusto.IJ"
          />
          <button
            type="submit"
            aria-label={limitReached ? "Criar conta" : "Enviar"}
            disabled={loading || (!limitReached && input.trim().length < 3)}
            className="rounded-sm bg-verde p-2.5 text-cream transition-colors duration-200 hover:bg-verde-medio focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado active:bg-verde-profundo disabled:opacity-50 disabled:hover:bg-verde"
          >
            {loading ? (
              <Icon icon="ph:circle-notch" className="h-4 w-4 animate-spin" />
            ) : (
              <Icon icon="ph:paper-plane-tilt" className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>

      {/* Sugestões */}
      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              if (limitReached) {
                navigate({ to: "/signup" });
                return;
              }
              setInput(chip);
            }}
            disabled={loading}
            className="rounded-full border border-dourado/40 bg-transparent px-3 py-1.5 font-body text-[13px] text-cream/85 transition-colors duration-200 hover:border-dourado hover:bg-dourado/10 hover:text-dourado-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DemoChatWidget;