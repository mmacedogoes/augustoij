import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Loader2, Send, Sparkles } from "lucide-react";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { PillTab } from "./PillTab";

type Persona = "sindico" | "adm" | "advogado";

const CONVERSAS: Record<Persona, {
  question: string;
  answer: string;
  citation: { label: string; source: string };
}> = {
  sindico: {
    question: "O síndico pode votar em assembleia?",
    answer:
      "Pode — desde que seja condômino e esteja adimplente. Fundamento: art. 1.335, III, do Código Civil. Se o síndico for profissional contratado (não condômino), ele preside ou conduz, mas não vota.",
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
        "STJ, REsp 1.483.930/DF, Rel. Min. Luis Felipe Salomão, 2ª Seção, j. 23/11/2016 — Tema 949 dos repetitivos",
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

export function HeroSection() {
  const [persona, setPersona] = useState<Persona>("sindico");
  const navigate = useNavigate();
  const conversa = CONVERSAS[persona];
  const [input, setInput] = useState("");
  const [live, setLive] = useState<LiveMsg[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
          description: "Crie sua conta para continuar conversando com Augusto.",
          action: { label: "Criar conta", onClick: () => navigate({ to: "/signup" }) },
        });
        setLive((prev) => [
          ...prev,
          { role: "augusto", content: json.error ?? "Limite atingido." },
        ]);
        return;
      }
      if (!res.ok || !json.answer) {
        toast.error(json.error ?? "Não foi possível gerar a resposta.");
        setLive((prev) => prev.slice(0, -1)); // remove the user message
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
    <section className="bg-augusto-cream">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28 grid gap-14 lg:grid-cols-2 items-center min-h-[90vh]">
        {/* Coluna esquerda */}
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
            Inteligência Jurídica para Condomínios
          </div>
          <h1 className="mt-6 font-serif text-augusto-green leading-[1.05] text-5xl md:text-6xl lg:text-[80px]">
            Augusto não substitui.
            <br />
            Potencializa.
          </h1>
          <p className="mt-6 max-w-[520px] text-lg text-augusto-slate leading-relaxed">
            Não substitui o síndico. Não substitui o administrador. Não substitui o advogado.
            Augusto potencializa cada um deles — com fundamentação, jurisprudência e clareza jurídica.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <PillTab active={persona === "sindico"} onClick={() => setPersona("sindico")}>
              Sou Síndico
            </PillTab>
            <PillTab active={persona === "adm"} onClick={() => setPersona("adm")}>
              Sou Administrador
            </PillTab>
            <PillTab active={persona === "advogado"} onClick={() => setPersona("advogado")}>
              Sou Advogado
            </PillTab>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate({ to: "/signup" })}
              className="inline-flex items-center gap-2 rounded-md bg-augusto-green px-5 py-3 text-sm font-semibold text-augusto-cream hover:bg-augusto-green-dark active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
            >
              Pergunte ao Augusto <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo("anatomia")}
              className="text-sm font-medium text-augusto-green hover:text-augusto-green-dark hover:underline underline-offset-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold rounded-sm"
            >
              Ver como funciona
            </button>
          </div>

          <p className="mt-6 font-serif italic text-augusto-gold text-sm">
            Dura lex, sed Augusto.
          </p>
        </div>

        {/* Coluna direita — chat card */}
        <div>
          <div
            className="rounded-xl bg-white border border-augusto-gold/30 shadow-[0_20px_60px_-20px_rgba(0,81,43,0.25)] p-7 md:p-8 min-h-[560px] flex flex-col"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-augusto-gold/15">
              <AugustoLogo variant="icon-only" size={28} />
              <div className="flex-1">
                <div className="text-sm font-medium text-augusto-green">
                  Conversando com Augusto
                </div>
                <div className="text-[11px] text-augusto-slate">
                  {limitReached
                    ? "Limite gratuito atingido"
                    : remaining === null
                      ? "3 perguntas grátis por visitante"
                      : `${remaining} pergunta${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}`}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-augusto-slate">
                <span className="h-2 w-2 rounded-full bg-augusto-gold animate-pulse" />
                Online
              </div>
            </div>

            <div
              ref={scrollRef}
              className="pt-5 space-y-4 flex-1 overflow-y-auto max-h-[380px] pr-1"
            >
              {!showLive ? (
                <div key={persona} className="animate-in fade-in duration-300 space-y-4">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-augusto-cream text-augusto-slate-dark px-4 py-2.5 text-[14px]">
                      {conversa.question}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-lg bg-augusto-green text-augusto-cream px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line">
                      {conversa.answer}
                    </div>
                  </div>
                  <div className="rounded-r-md border-l-4 border-augusto-gold bg-augusto-gold/5 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
                      {conversa.citation.label}
                    </div>
                    <div className="mt-1 text-[13px] text-augusto-slate-dark">
                      {conversa.citation.source}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-augusto-slate italic pt-2">
                    <Sparkles className="h-3 w-3 text-augusto-gold" />
                    Exemplo. Faça sua própria pergunta abaixo — 3 grátis por visitante.
                  </div>
                </div>
              ) : (
                live.map((m, i) => (
                  <div
                    key={i}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-lg bg-augusto-cream text-augusto-slate-dark px-4 py-2.5 text-[14px]"
                          : "max-w-[92%] rounded-lg bg-augusto-green text-augusto-cream px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-augusto-green/90 text-augusto-cream px-4 py-3 text-[14px] inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Augusto está pensando…
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (limitReached) {
                  navigate({ to: "/signup" });
                  return;
                }
                askAugusto(input);
              }}
              className="mt-5 flex items-center gap-2 rounded-lg border border-augusto-gold/30 bg-augusto-cream/60 focus-within:border-augusto-green focus-within:ring-2 focus-within:ring-augusto-green/20 transition-all duration-200 px-3 py-2"
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
                className="flex-1 bg-transparent text-[14px] text-augusto-slate-dark placeholder:text-augusto-slate outline-none disabled:opacity-60"
                aria-label="Pergunte a Augusto"
              />
              <button
                type="submit"
                aria-label={limitReached ? "Criar conta" : "Enviar"}
                disabled={loading || (!limitReached && input.trim().length < 3)}
                className="rounded-md bg-augusto-green p-2 text-augusto-cream hover:bg-augusto-green-dark disabled:opacity-50 disabled:hover:bg-augusto-green active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>

          {/* Chips */}
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
                className="rounded-full border border-augusto-gold/40 px-3 py-1 text-sm text-augusto-green hover:bg-augusto-gold/10 hover:border-augusto-gold active:scale-[0.98] disabled:opacity-50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;