import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "./SectionHeader";
import { PricingCard, type PricingBadge, type PricingFeature } from "./PricingCard";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "annual";

type PlanId =
  | "gratuito"
  | "essencial"
  | "profissional"
  | "gestao"
  | "administradora"
  | "personalizado";

type Plan = {
  id: PlanId;
  name: string;
  sublabel: string;
  monthly: number | null;
  annualPerMonth: number | null;
  annualTotal: number | null;
  features: PricingFeature[];
  ctaLabel: string;
  ctaVariant?: "solid" | "outline";
  ctaKind: "signup" | "contact";
  featured?: boolean;
  badge?: PricingBadge;
  fixedPrice?: string;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const PLANS: Plan[] = [
  {
    id: "gratuito",
    name: "Gratuito",
    sublabel: "Teste por 7 dias, sem cartão de crédito",
    monthly: null,
    annualPerMonth: null,
    annualTotal: null,
    fixedPrice: "R$ 0",
    features: [
      { label: "10 mensagens por dia", state: "included" },
      { label: "1 condomínio", state: "included" },
      { label: "Base jurídica pública", state: "included" },
      { label: "Upload de documentos", state: "excluded" },
      { label: "Análise de contratos", state: "excluded" },
      { label: "Modelos de documentos", state: "excluded" },
      { label: "Histórico além de 7 dias", state: "excluded" },
    ],
    ctaLabel: "Experimentar grátis",
    ctaVariant: "outline",
    ctaKind: "signup",
    badge: { label: "7 dias grátis", tone: "success" },
  },
  {
    id: "essencial",
    name: "Essencial",
    sublabel: "Para síndicos moradores",
    monthly: 89,
    annualPerMonth: 74,
    annualTotal: 888,
    features: [
      { label: "100 mensagens por mês", state: "included" },
      { label: "Até 2 condomínios", state: "included" },
      { label: "Upload de até 10 documentos", state: "included" },
      { label: "Análise de contratos e documentos", state: "included" },
      { label: "Modelos básicos de notificação", state: "included" },
      { label: "Histórico de 30 dias", state: "included" },
      { label: "Jurisprudência completa", state: "strikethrough" },
      { label: "Minutas de ata e convenção", state: "excluded" },
      { label: "Múltiplos usuários", state: "excluded" },
    ],
    ctaLabel: "Assinar Essencial",
    ctaVariant: "outline",
    ctaKind: "signup",
  },
  {
    id: "profissional",
    name: "Profissional",
    sublabel: "Para síndicos profissionais e advogados",
    monthly: 197,
    annualPerMonth: 164,
    annualTotal: 1968,
    features: [
      { label: "400 mensagens por mês", state: "included" },
      { label: "Até 8 condomínios", state: "included" },
      { label: "Documentos ilimitados", state: "included" },
      { label: "Análise de contratos e documentos", state: "included" },
      { label: "Todos os modelos + minutas de ata e convenção", state: "included" },
      { label: "Jurisprudência completa", state: "included" },
      { label: "Histórico ilimitado", state: "included" },
      { label: "1 usuário adicional incluso", state: "included" },
    ],
    ctaLabel: "Assinar Profissional",
    ctaVariant: "solid",
    ctaKind: "signup",
    featured: true,
    badge: { label: "Mais escolhido", tone: "primary" },
  },
  {
    id: "gestao",
    name: "Gestão",
    sublabel: "Para síndicos com carteira ampla",
    monthly: 347,
    annualPerMonth: 289,
    annualTotal: 3468,
    features: [
      { label: "900 mensagens por mês", state: "included" },
      { label: "Até 20 condomínios", state: "included" },
      { label: "Documentos ilimitados", state: "included" },
      { label: "Análise de contratos e documentos", state: "included" },
      { label: "Todos os modelos + minutas", state: "included" },
      { label: "Jurisprudência completa", state: "included" },
      { label: "Histórico ilimitado", state: "included" },
      { label: "Até 3 usuários inclusos", state: "included" },
      { label: "Relatórios por condomínio", state: "included" },
      { label: "Suporte prioritário por e-mail", state: "included" },
    ],
    ctaLabel: "Assinar Gestão",
    ctaVariant: "outline",
    ctaKind: "signup",
  },
  {
    id: "administradora",
    name: "Administradora",
    sublabel: "Para administradoras de condomínios",
    monthly: 697,
    annualPerMonth: 580,
    annualTotal: 6960,
    features: [
      { label: "Mensagens ilimitadas (uso razoável)", state: "included" },
      { label: "Até 50 condomínios", state: "included" },
      { label: "Documentos ilimitados", state: "included" },
      { label: "Análise de contratos e documentos", state: "included" },
      { label: "Todos os modelos + minutas", state: "included" },
      { label: "Jurisprudência completa", state: "included" },
      { label: "Histórico ilimitado", state: "included" },
      { label: "Usuários ilimitados", state: "included" },
      { label: "Relatórios por condomínio", state: "included" },
    ],
    ctaLabel: "Assinar Administradora",
    ctaVariant: "outline",
    ctaKind: "signup",
  },
  {
    id: "personalizado",
    name: "Personalizado",
    sublabel: "Para operações que precisam de mais",
    monthly: null,
    annualPerMonth: null,
    annualTotal: null,
    fixedPrice: "Sob consulta",
    features: [
      { label: "Tudo do plano Administradora", state: "included" },
      { label: "Condomínios ilimitados", state: "included" },
      { label: "White-label disponível", state: "included" },
      { label: "Treinamento da equipe incluso", state: "included" },
      { label: "Suporte dedicado com gerente de conta", state: "included" },
      { label: "Integrações personalizadas", state: "included" },
      { label: "Contrato e SLA negociados", state: "included" },
    ],
    ctaLabel: "Falar com nossa equipe",
    ctaVariant: "outline",
    ctaKind: "contact",
    badge: { label: "Sob medida", tone: "neutral" },
  },
];

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const navigate = useNavigate();

  const handleCta = async (plan: Plan) => {
    if (plan.ctaKind === "contact") {
      navigate({ to: "/contato" } as never);
      return;
    }
    const ciclo = billing === "annual" ? "anual" : "mensal";

    // Plano gratuito: sempre pelo signup.
    if (plan.id === "gratuito") {
      navigate({ to: "/signup", search: { plano: plan.id, ciclo } } as never);
      return;
    }

    // Planos pagos: se já estiver logado, pula o signup e vai direto ao checkout.
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate({ to: "/app/assinatura", search: { plano: plan.id, ciclo } } as never);
        return;
      }
    } catch {
      /* fallback abaixo */
    }
    navigate({
      to: "/signup",
      search: { plano: plan.id, ciclo },
    } as never);
  };

  const resolvePrice = (plan: Plan) => {
    if (plan.fixedPrice) {
      return { price: plan.fixedPrice, priceSuffix: undefined, priceNote: undefined };
    }
    if (billing === "annual" && plan.annualPerMonth && plan.annualTotal) {
      return {
        price: fmtBRL(plan.annualPerMonth),
        priceSuffix: "/mês",
        priceNote: `cobrado ${fmtBRL(plan.annualTotal)}/ano`,
      };
    }
    return {
      price: plan.monthly != null ? fmtBRL(plan.monthly) : "—",
      priceSuffix: "/mês",
      priceNote: undefined,
    };
  };

  return (
    <section id="pricing" className="bg-augusto-cream border-t border-augusto-gold/15 py-24 px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Planos"
          title="Inteligência jurídica ao alcance."
          subtitle="Do síndico morador à administradora com carteira ampla. Comece grátis por 7 dias."
        />

        {/* Billing toggle */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div
            role="tablist"
            aria-label="Ciclo de cobrança"
            className="inline-flex items-center gap-1 rounded-full border border-augusto-gold/25 bg-white p-1 shadow-sm"
          >
            {(["monthly", "annual"] as const).map((v) => {
              const active = billing === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setBilling(v)}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-green/60",
                    active
                      ? "bg-augusto-green text-augusto-cream shadow-sm"
                      : "text-augusto-green hover:bg-augusto-green/5",
                  )}
                >
                  {v === "monthly" ? "Mensal" : "Anual"}
                </button>
              );
            })}
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full bg-augusto-green-light/15 px-3 py-1 text-xs font-semibold text-augusto-green-dark ring-1 ring-augusto-green-light/30 transition-opacity duration-200",
              billing === "annual" ? "opacity-100" : "opacity-0 sm:opacity-50",
            )}
            aria-hidden={billing !== "annual"}
          >
            2 meses grátis
          </span>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const priced = resolvePrice(plan);
            return (
              <PricingCard
                key={plan.id}
                name={plan.name}
                price={priced.price}
                priceSuffix={priced.priceSuffix}
                priceNote={priced.priceNote}
                sublabel={plan.sublabel}
                features={plan.features}
                featured={plan.featured}
                badge={plan.badge}
                cta={{
                  label: plan.ctaLabel,
                  variant: plan.ctaVariant,
                  onClick: () => handleCta(plan),
                }}
              />
            );
          })}
        </div>

        <p className="mt-10 text-center text-[13px] text-augusto-slate">
          Todos os planos incluem acesso seguro via HTTPS, dados armazenados no Brasil e suporte por
          e-mail. Preços em reais. Plano anual cobrado à vista.
        </p>

        {/* Personalizado — detailed section */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-augusto-green/15 bg-white shadow-sm">
          <div className="grid gap-8 p-8 md:grid-cols-[1.2fr_1fr] md:p-12">
            <div>
              <span className="inline-flex items-center rounded-full bg-augusto-slate/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-augusto-slate-dark ring-1 ring-augusto-slate/20">
                Sob medida
              </span>
              <h3 className="mt-4 font-serif text-augusto-green text-3xl md:text-4xl leading-[1.1]">
                Precisa de uma solução sob medida?
              </h3>
              <p className="mt-4 max-w-xl text-augusto-slate text-[15px] leading-relaxed">
                Converse com a gente e montamos um plano para o seu volume e necessidades
                específicas.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/contato" } as never)}
                className={cn(
                  "mt-6 inline-flex items-center justify-center rounded-md bg-augusto-green px-5 py-2.5 text-sm font-medium text-augusto-cream shadow-sm transition-all duration-200",
                  "hover:bg-augusto-green-dark hover:shadow",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-green/60 focus-visible:ring-offset-2",
                  "active:scale-[0.98]",
                )}
              >
                Agendar conversa
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-2 self-center rounded-xl bg-augusto-cream/60 p-6 sm:grid-cols-2">
              {[
                "Tudo do Administradora",
                "Condomínios ilimitados",
                "White-label disponível",
                "Treinamento da equipe incluso",
                "Gerente de conta dedicado",
                "Integrações personalizadas",
                "Contrato e SLA negociados",
              ].map((f) => (
                <li
                  key={f}
                  className="flex gap-2 text-[13px] text-augusto-slate-dark"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-augusto-gold"
                    aria-hidden="true"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PricingSection;