import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Loader2, Send, Sparkles } from "lucide-react";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <section className="relative isolate overflow-hidden bg-augusto-green text-augusto-cream">
      <div className="landing-hero-bg absolute inset-0" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-20 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-augusto-gold/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-4 h-[30rem] w-[30rem] rounded-full bg-augusto-cream/10 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)] lg:gap-14 lg:px-8 lg:py-24">
        {/* Coluna esquerda */}
        <div className="max-w-[680px]">
          <div className="inline-flex items-center gap-3 rounded-full border border-augusto-gold/35 bg-augusto-cream/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-augusto-gold-light shadow-[var(--landing-shadow-soft)] supports-[backdrop-filter]:backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-augusto-gold" aria-hidden="true" />
            Inteligência jurídica especializada em Direito Condominial
          </div>
          <h1 className="mt-8 max-w-[760px] font-serif text-[clamp(2.75rem,6.4vw,5.25rem)] leading-[0.98] tracking-[-0.035em] text-augusto-cream">
            A inteligência jurídica que dá{" "}
            <span className="text-augusto-gold-light">segurança</span> às
            decisões do seu condomínio.
          </h1>
          <p className="mt-8 max-w-[580px] text-[17px] leading-[1.75] text-augusto-cream/80 sm:text-lg">
            Consulte dúvidas, revise contratos, elabore notificações e prepare
            assembleias com respostas personalizadas: Augusto cruza a lei, a
            jurisprudência e a doutrina com a convenção, o regimento e as atas
            do seu condomínio.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
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

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col items-start gap-1.5 sm:items-start">
              <Button
                type="button"
                onClick={() => navigate({ to: "/signup" })}
                variant="augusto-gold"
                size="xl"
                className="w-full sm:w-auto"
              >
                Começar 7 dias grátis <ArrowRight className="h-4 w-4" />
              </Button>
              <span className="text-[12px] font-medium tracking-[0.02em] text-augusto-cream/65">
                Sem cartão de crédito.
              </span>
            </div>
            <Button
              type="button"
              onClick={() => scrollTo("anatomia")}
              variant="augusto-ghost"
              size="xl"
              className="w-full text-augusto-cream hover:bg-augusto-cream/10 hover:text-augusto-gold-light sm:w-auto"
            >
              Ver como Augusto responde
            </Button>
          </div>

          <p className="mt-8 font-serif text-[17px] italic text-augusto-gold-light sm:text-[19px]">
            Augusto não substitui. <span className="text-augusto-cream/90">Potencializa.</span>
          </p>

          <div className="mt-10 grid max-w-[560px] grid-cols-3 overflow-hidden rounded-2xl border border-augusto-gold/25 bg-augusto-cream/10 shadow-[var(--landing-shadow-soft)] supports-[backdrop-filter]:backdrop-blur-md">
            {[
              ["3", "perguntas grátis"],
              ["24h", "disponível"],
              ["IJ", "foco jurídico"],
            ].map(([value, label]) => (
              <div key={label} className="border-r border-augusto-gold/20 px-4 py-4 last:border-r-0">
                <div className="font-serif text-2xl leading-none text-augusto-gold-light">{value}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-cream/70">
                  {label}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-7 font-serif text-sm italic text-augusto-gold-light">
            Dura lex, sed Augusto.
          </p>
        </div>

        {/* Coluna direita, chat card */}
        <div className="relative lg:pl-4">
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-[2rem] border border-augusto-gold/20 bg-augusto-cream/6 shadow-[var(--landing-shadow-deep)]"
          />
          <div
            className="relative flex min-h-[560px] flex-col rounded-[1.5rem] border border-augusto-gold/35 bg-landing-panel p-5 text-landing-ink shadow-[var(--landing-shadow-deep)] sm:p-7 md:p-8"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-landing-rule pb-5">
              <div className="flex min-w-0 items-center gap-3">
              <AugustoLogo variant="icon-only" size={28} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-augusto-green">
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
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-augusto-green/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-green">
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
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-landing-panel-muted px-4 py-3 text-[14px] text-augusto-slate-dark shadow-sm">
                      {conversa.question}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-augusto-green px-4 py-3 text-[14px] leading-relaxed text-augusto-cream shadow-[var(--landing-shadow-soft)] whitespace-pre-line">
                      {conversa.answer}
                    </div>
                  </div>
                  <div className="rounded-r-xl border-l-4 border-augusto-gold bg-augusto-gold/10 px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
                      {conversa.citation.label}
                    </div>
                    <div className="mt-1 text-[13px] text-augusto-slate-dark">
                      {conversa.citation.source}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 text-[11px] italic text-augusto-slate">
                    <Sparkles className="h-3 w-3 text-augusto-gold" />
                    Exemplo. Faça sua própria pergunta abaixo, 3 grátis por visitante.
                  </div>
                </div>
              ) : (
                live.map((m, i) => (
                  <div
                    key={i}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={cn(
                        "text-[14px] shadow-sm",
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-landing-panel-muted px-4 py-3 text-augusto-slate-dark"
                          : "max-w-[92%] rounded-2xl rounded-bl-md bg-augusto-green px-4 py-3 leading-relaxed text-augusto-cream whitespace-pre-line",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-augusto-green/90 px-4 py-3 text-[14px] text-augusto-cream">
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
              className="mt-5 flex items-center gap-2 rounded-2xl border border-augusto-gold/30 bg-landing-panel-muted/80 px-3 py-2 transition-all duration-200 focus-within:border-augusto-green focus-within:ring-2 focus-within:ring-augusto-gold/30"
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
                className="min-w-0 flex-1 bg-transparent text-[14px] text-augusto-slate-dark outline-none placeholder:text-augusto-slate disabled:opacity-60"
                aria-label="Pergunte a Augusto"
              />
              <button
                type="submit"
                aria-label={limitReached ? "Criar conta" : "Enviar"}
                disabled={loading || (!limitReached && input.trim().length < 3)}
                className="rounded-xl bg-augusto-green p-2.5 text-augusto-cream transition-all duration-200 hover:bg-augusto-green-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-augusto-green"
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
          <div className="relative mt-4 flex flex-wrap gap-2">
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
                className="rounded-full border border-augusto-gold/35 bg-augusto-cream/10 px-3 py-1.5 text-sm text-augusto-cream transition-all duration-200 hover:border-augusto-gold hover:bg-augusto-gold/15 hover:text-augusto-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold active:scale-[0.98] disabled:opacity-50"
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