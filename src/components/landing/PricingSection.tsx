import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SectionHeader } from "./SectionHeader";
import { PricingCard } from "./PricingCard";
import { cn } from "@/lib/utils";

type Mode = "pf" | "pj";

export function PricingSection() {
  const [mode, setMode] = useState<Mode>("pf");
  const navigate = useNavigate();
  const toSignup = () => navigate({ to: "/signup" });
  const toContact = () => navigate({ to: "/signup" });

  const pf = [
    {
      name: "Conhecer",
      price: "Grátis",
      sublabel: "para experimentar Augusto",
      bullets: ["10 consultas/mês", "1 condomínio", "Acesso à base pública"],
      cta: { label: "Começar grátis", onClick: toSignup, variant: "outline" as const },
    },
    {
      name: "Básico",
      price: "R$ 79",
      priceSuffix: "/mês",
      sublabel: "para síndicos e profissionais",
      bullets: [
        "100 consultas/mês",
        "Até 3 condomínios",
        "Modelos jurídicos",
        "Análise contratual básica",
      ],
      cta: { label: "Assinar Básico", onClick: toSignup },
      featured: true,
    },
    {
      name: "Pro",
      price: "R$ 189",
      priceSuffix: "/mês",
      sublabel: "para profissionais ativos",
      bullets: [
        "Consultas ilimitadas",
        "Até 10 condomínios",
        "Análise contratual avançada",
        "Citação completa de jurisprudência",
        "Suporte prioritário",
      ],
      cta: { label: "Assinar Pro", onClick: toSignup },
    },
    {
      name: "Empresarial",
      price: "Fale conosco",
      sublabel: "para administradoras e escritórios",
      bullets: [
        "Tudo do Pro",
        "Condomínios ilimitados",
        "Equipe multiusuário",
        "API + integrações",
        "Treinamento dedicado",
      ],
      cta: { label: "Agendar conversa →", onClick: toContact, variant: "outline" as const },
    },
  ];

  const pj = [
    {
      name: "Starter",
      price: "Fale conosco",
      sublabel: "para administradoras iniciantes",
      bullets: [
        "Até 20 condomínios",
        "Equipe até 3 usuários",
        "Modelos jurídicos",
        "Onboarding assistido",
      ],
      cta: { label: "Agendar conversa →", onClick: toContact, variant: "outline" as const },
    },
    {
      name: "Enterprise",
      price: "Fale conosco",
      sublabel: "para administradoras estabelecidas",
      bullets: [
        "Até 100 condomínios",
        "Equipe até 10 usuários",
        "API + webhooks",
        "Treinamento personalizado",
        "SLA garantido",
      ],
      cta: { label: "Agendar conversa →", onClick: toContact },
      featured: true,
    },
    {
      name: "Ilimitado",
      price: "Fale conosco",
      sublabel: "para grandes operações e escritórios",
      bullets: [
        "Condomínios ilimitados",
        "Usuários ilimitados",
        "White label opcional",
        "Consultor jurídico dedicado",
        "Suporte 24/7",
      ],
      cta: { label: "Agendar conversa →", onClick: toContact, variant: "outline" as const },
    },
  ];

  const cards = mode === "pf" ? pf : pj;

  return (
    <section id="pricing" className="bg-augusto-cream border-t border-augusto-gold/15 py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Planos"
          title="Inteligência jurídica ao alcance."
          subtitle="Para profissionais individuais ou empresas com escala. Comece grátis. Cresça quando precisar."
        />

        {/* Toggle PF/PJ */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/60 p-1">
            {(["pf", "pj"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                className={cn(
                  "relative rounded-full px-5 py-2 text-sm font-medium transition-colors",
                  mode === v
                    ? "bg-augusto-green text-augusto-cream"
                    : "text-augusto-green hover:bg-augusto-green/5",
                )}
              >
                {v === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                {mode === v && (
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-px w-8 bg-augusto-gold" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          key={mode}
          className={cn(
            "mt-12 grid gap-6 animate-in fade-in duration-300",
            mode === "pf" ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {cards.map((c) => (
            <PricingCard key={c.name} {...c} />
          ))}
        </div>

        <p className="mt-12 text-center font-serif italic text-augusto-slate text-[15px]">
          Sem fidelidade. Cancele quando quiser. Suporte sempre humano.
        </p>
      </div>
    </section>
  );
}

export default PricingSection;