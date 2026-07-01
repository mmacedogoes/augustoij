import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Paperclip, Send } from "lucide-react";
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

export function HeroSection() {
  const [persona, setPersona] = useState<Persona>("sindico");
  const navigate = useNavigate();
  const conversa = CONVERSAS[persona];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
              className="inline-flex items-center gap-2 rounded-md bg-augusto-green px-5 py-3 text-sm font-medium text-augusto-cream hover:bg-augusto-green-dark transition-colors"
            >
              Pergunte ao Augusto <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo("anatomia")}
              className="text-sm font-medium text-augusto-green hover:underline"
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
            key={persona}
            className="animate-in fade-in duration-300 rounded-lg bg-white border border-augusto-gold/30 shadow-lg p-6"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-augusto-gold/15">
              <AugustoLogo variant="icon-only" size={24} />
              <div className="flex-1">
                <div className="text-sm font-medium text-augusto-green">
                  Conversando com Augusto
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-augusto-slate">
                <span className="h-2 w-2 rounded-full bg-augusto-gold animate-pulse" />
                Online
              </div>
            </div>

            <div className="pt-5 space-y-4">
              {/* User */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-augusto-cream text-augusto-slate-dark px-4 py-2.5 text-[14px]">
                  {conversa.question}
                </div>
              </div>
              {/* Augusto */}
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-lg bg-augusto-green text-augusto-cream px-4 py-3 text-[14px] leading-relaxed">
                  {conversa.answer}
                </div>
              </div>
              {/* Citação */}
              <div className="rounded-r-md border-l-4 border-augusto-gold bg-augusto-gold/5 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
                  {conversa.citation.label}
                </div>
                <div className="mt-1 text-[13px] text-augusto-slate-dark">
                  {conversa.citation.source}
                </div>
              </div>
            </div>

            {/* Input area */}
            <div className="mt-6 flex items-center gap-2 rounded-md border border-augusto-gold/20 bg-augusto-cream/50 px-3 py-2">
              <Paperclip className="h-4 w-4 text-augusto-slate" />
              <div className="flex-1 text-[13px] text-augusto-slate">
                Pergunte sobre convenção, ata, contratos…
              </div>
              <button
                type="button"
                aria-label="Enviar"
                className="rounded-md bg-augusto-green p-1.5 text-augusto-cream"
                onClick={() =>
                  toast("Cadastre-se para conversar com Augusto", {
                    action: {
                      label: "Começar",
                      onClick: () => navigate({ to: "/signup" }),
                    },
                  })
                }
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() =>
                  toast("Cadastre-se para conversar com Augusto", {
                    action: {
                      label: "Começar",
                      onClick: () => navigate({ to: "/signup" }),
                    },
                  })
                }
                className="rounded-full border border-augusto-gold/40 px-3 py-1 text-sm text-augusto-green hover:bg-augusto-gold/10 transition-colors"
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