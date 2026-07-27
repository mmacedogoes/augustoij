import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Icon } from "@iconify/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";
import { cn } from "@/lib/utils";
import { PLANOS, type PlanoId } from "@/config/planos";

type Billing = "monthly" | "annual";
type PlanId = PlanoId;

type Feature = { label: string; state: "included" | "excluded" | "strikethrough" };
type Plan = {
  id: PlanId;
  name: string;
  sublabel: string;
  monthly: number | null;
  annualPerMonth: number | null;
  annualTotal: number | null;
  features: Feature[];
  ctaLabel: string;
  ctaKind: "signup" | "contact";
  featured?: boolean;
  badge?: string;
  fixedPrice?: string;
  microcopy?: string;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

// Copy das features por plano — na ordem exata definida pelo produto.
// Os preços e limites numéricos vêm de `PLANOS` (fonte única de verdade).
const FEATURES: Record<PlanId, Feature[]> = {
  gratuito: [
    { label: "10 mensagens por dia", state: "included" },
    { label: "1 condomínio", state: "included" },
    { label: "Envio da convenção do seu condomínio", state: "included" },
    { label: "Envio de 1 contrato para análise", state: "included" },
    { label: "1 análise de contrato com semáforo de risco", state: "included" },
    { label: "Legislação, jurisprudência e doutrina completas", state: "included" },
    { label: "Regimento, atas e documentos ilimitados", state: "excluded" },
    { label: "Modelos e minutas", state: "excluded" },
    { label: "Gestão contínua de contratos", state: "excluded" },
    { label: "Histórico além de 7 dias", state: "excluded" },
  ],
  essencial: [
    { label: "100 mensagens por mês", state: "included" },
    { label: "Até 2 condomínios", state: "included" },
    { label: "Convenção, regimento, atas e contratos ilimitados", state: "included" },
    { label: "Legislação, jurisprudência e doutrina completas", state: "included" },
    { label: "Análise de contratos ilimitada", state: "included" },
    { label: "Gestão contínua de até 3 contratos", state: "included" },
    { label: "Modelos básicos de notificação", state: "included" },
    { label: "Histórico de 30 dias", state: "included" },
    { label: "Minutas de ata e convenção", state: "excluded" },
    { label: "Painel consolidado da carteira", state: "excluded" },
  ],
  profissional: [
    { label: "400 mensagens por mês", state: "included" },
    { label: "Até 8 condomínios", state: "included" },
    { label: "Documentos ilimitados", state: "included" },
    { label: "Legislação, jurisprudência e doutrina completas", state: "included" },
    { label: "Análise de contratos ilimitada", state: "included" },
    { label: "Gestão contínua de até 15 contratos", state: "included" },
    { label: "Todos os modelos, minutas de ata e convenção", state: "included" },
    { label: "Histórico ilimitado", state: "included" },
    { label: "2 usuários", state: "included" },
    { label: "Painel consolidado da carteira", state: "excluded" },
  ],
  gestao: [
    { label: "900 mensagens por mês", state: "included" },
    { label: "Até 20 condomínios", state: "included" },
    { label: "Documentos ilimitados", state: "included" },
    { label: "Gestão contínua de até 40 contratos", state: "included" },
    { label: "Painel consolidado da carteira", state: "included" },
    { label: "3 usuários inclusos", state: "included" },
    { label: "Relatórios por condomínio", state: "included" },
    { label: "Suporte prioritário por e-mail", state: "included" },
    { label: "Tudo do plano Profissional", state: "included" },
  ],
  administradora: [
    { label: "Mensagens ilimitadas (uso razoável)", state: "included" },
    { label: "Até 50 condomínios", state: "included" },
    { label: "Documentos ilimitados", state: "included" },
    { label: "Gestão contínua de contratos ilimitada", state: "included" },
    { label: "Painel consolidado da carteira", state: "included" },
    { label: "10 usuários", state: "included" },
    { label: "Relatórios por condomínio", state: "included" },
    { label: "Tudo do plano Gestão", state: "included" },
  ],
  personalizado: [
    { label: "Tudo do plano Administradora", state: "included" },
    { label: "Condomínios ilimitados", state: "included" },
    { label: "White-label disponível", state: "included" },
    { label: "Treinamento da equipe incluso", state: "included" },
    { label: "Suporte dedicado com gerente de conta", state: "included" },
    { label: "Integrações personalizadas", state: "included" },
    { label: "Contrato e SLA negociados", state: "included" },
  ],
};

const CTA_LABEL: Record<PlanId, string> = {
  gratuito: "Experimentar grátis",
  essencial: "Assinar Essencial",
  profissional: "Assinar Profissional",
  gestao: "Assinar Gestão",
  administradora: "Assinar Administradora",
  personalizado: "Falar com nossa equipe",
};

const ORDER: PlanId[] = [
  "gratuito",
  "essencial",
  "profissional",
  "gestao",
  "administradora",
  "personalizado",
];

const MICROCOPY: Partial<Record<PlanId, string>> = {
  gratuito:
    "Envie a convenção e veja a resposta mudar. É a diferença entre uma orientação genérica e uma orientação sobre o seu condomínio.",
};

const PLANS: Plan[] = ORDER.map((id) => {
  const p = PLANOS[id] as import("@/config/planos").Plano;
  const mensal = p.precoMensal;
  const anual = p.precoAnual;
  const semPreco = mensal === null || anual === null;
  return {
    id,
    name: p.nome,
    sublabel: p.publico,
    monthly: mensal,
    annualPerMonth: !semPreco ? Math.round(anual / 12) : null,
    annualTotal: anual,
    fixedPrice: semPreco ? "Sob consulta" : mensal === 0 ? "R$ 0" : undefined,
    features: FEATURES[id],
    ctaLabel: CTA_LABEL[id],
    ctaKind: id === "personalizado" ? "contact" : "signup",
    featured: p.destaque,
    badge: p.badge,
    microcopy: MICROCOPY[id],
  };
});

const FAQ = [
  {
    q: "O Augusto.IJ substitui o advogado do condomínio?",
    a: "Não. Augusto.IJ organiza e acelera a consulta jurídica condominial, com fundamentação e orientação prática. Casos estratégicos, litigiosos ou de alta complexidade devem ser conduzidos por advogado habilitado.",
  },
  {
    q: "As respostas consideram as regras do meu condomínio?",
    a: "Sim. Você pode enviar a convenção, o regimento interno, as atas e os contratos para a base privada do seu condomínio. As respostas passam a cruzar a legislação e a jurisprudência com as regras específicas da sua gestão.",
  },
  {
    q: "As respostas têm base legal e jurisprudência?",
    a: "Sim. Quando aplicável, o Augusto.IJ estrutura a resposta com fundamentação legal, precedentes e orientação prática, a partir de um repositório de legislação, jurisprudência e doutrina curado por profissionais jurídicos da área.",
  },
  {
    q: "Meus documentos ficam protegidos?",
    a: "Sim. Os documentos enviados permanecem em uma base privada, vinculada ao condomínio cadastrado, em ambiente seguro com acesso via HTTPS e dados armazenados no Brasil.",
  },
  {
    q: "Preciso saber usar inteligência artificial?",
    a: "Não. Você pergunta como perguntaria a um especialista: qual é o quórum, esse contrato tem risco, como notificar este morador.",
  },
  {
    q: "O teste gratuito exige cartão de crédito?",
    a: "Não. O teste de 7 dias começa sem cartão de crédito.",
  },
  {
    q: "O que acontece depois dos 7 dias?",
    a: "Você escolhe se deseja continuar em um dos planos. Se não escolher, não há cobrança automática.",
  },
  {
    q: "Qual plano é mais indicado para mim?",
    a: "O Essencial atende síndicos moradores. O Profissional é indicado para síndicos profissionais e advogados. Para carteiras maiores, os planos Gestão e Administradora oferecem mais condomínios, usuários e capacidade.",
  },
];

function PlanCard({
  plan,
  price,
  priceSuffix,
  priceNote,
  onCta,
}: {
  plan: Plan;
  price: string;
  priceSuffix?: string;
  priceNote?: string;
  onCta: () => void;
}) {
  return (
    <div
      id={`plan-${plan.id}`}
      className={cn(
        "relative flex flex-col rounded-2xl bg-papel p-6 md:p-7 transition-transform duration-200",
        plan.featured ? "border-2 border-dourado" : "border border-borda",
        "hover:-translate-y-0.5",
      )}
    >
      {plan.badge && (
        <span
          className="absolute -top-3 left-6 rounded-md bg-verde px-2.5 py-1 font-body text-[11px] font-medium uppercase text-cream"
          style={{ letterSpacing: "2.5px" }}
        >
          {plan.badge}
        </span>
      )}
      <h3 className="t-h4 text-verde">{plan.name}</h3>
      <p className="mt-1 t-micro text-ardosia">{plan.sublabel}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span
          className="font-heading font-medium text-verde"
          style={{ fontSize: 44, lineHeight: 1 }}
        >
          {price}
        </span>
        {priceSuffix && <span className="t-body-sm text-ardosia">{priceSuffix}</span>}
      </div>
      <p className="mt-1 min-h-[20px] t-micro text-ardosia/80">{priceNote ?? ""}</p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((f) => {
          if (f.state === "strikethrough") {
            return (
              <li key={f.label} className="flex gap-2 t-body-sm text-ardosia/50 line-through">
                <Icon icon="ph:check" width={22} className="mt-0.5 shrink-0 text-ardosia/30" />
                <span>{f.label}</span>
              </li>
            );
          }
          const inc = f.state === "included";
          return (
            <li
              key={f.label}
              className={cn("flex gap-2 t-body-sm", inc ? "text-grafite" : "text-ardosia/60")}
            >
              <Icon
                icon={inc ? "ph:check" : "ph:x"}
                width={22}
                className={cn("mt-0.5 shrink-0", inc ? "text-verde" : "text-ardosia/50")}
              />
              <span>{f.label}</span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onCta}
        className={cn(
          "mt-7 inline-flex w-full items-center justify-center rounded-lg transition-colors duration-200",
          "t-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-bege",
          "px-7 py-3.5",
          plan.featured
            ? "bg-dourado text-[hsl(30_60%_9%)] hover:bg-[hsl(33_40%_47%)]"
            : "border border-dourado bg-transparent text-dourado-texto hover:bg-dourado/10",
        )}
      >
        {plan.ctaLabel}
      </button>
    </div>
  );
}

export function PlanosFaq() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [highlighted, setHighlighted] = useState<PlanId | null>(null);
  const timerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const PROFILES: { id: PlanId; label: string; price: string }[] = [
    {
      id: "essencial",
      label: "Sou síndico morador",
      price: `a partir de ${fmtBRL(PLANOS.essencial.precoMensal ?? 0)}/mês`,
    },
    {
      id: "profissional",
      label: "Sou síndico profissional ou advogado",
      price: `a partir de ${fmtBRL(PLANOS.profissional.precoMensal ?? 0)}/mês`,
    },
    {
      id: "administradora",
      label: "Sou administradora",
      price: `a partir de ${fmtBRL(PLANOS.administradora.precoMensal ?? 0)}/mês`,
    },
  ];

  const highlightPlan = (id: PlanId) => {
    const el = document.getElementById(`plan-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(id);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setHighlighted(null), 2400);
  };

  const handleCta = async (plan: Plan) => {
    if (plan.ctaKind === "contact") {
      navigate({ to: "/contato" } as never);
      return;
    }
    const ciclo = billing === "annual" ? "anual" : "mensal";
    if (plan.id === "gratuito") {
      navigate({ to: "/signup", search: { plano: plan.id, ciclo } } as never);
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate({ to: "/app/assinatura", search: { plano: plan.id, ciclo } } as never);
        return;
      }
    } catch {
      /* fallback */
    }
    navigate({ to: "/signup", search: { plano: plan.id, ciclo } } as never);
  };

  const resolvePrice = (plan: Plan) => {
    if (plan.fixedPrice) return { price: plan.fixedPrice, priceSuffix: undefined, priceNote: undefined };
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
    <section
      id="pricing"
      className="relative w-full bg-bege px-6"
      style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
    >
      <div className="mx-auto w-full max-w-[var(--container-container)]">
        {/* Cabeçalho */}
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <SectionLabel tone="dark">Planos</SectionLabel>
          <h2 className="t-h2 mt-5 text-verde">
            Escolha o nível de apoio jurídico que sua gestão precisa.
          </h2>
          <ArcoAugusto width={52} color="hsl(33 40% 54%)" opacity={0.55} className="mt-6" />
          <p className="t-lead mt-5 text-ardosia">
            Comece gratuitamente e avance conforme o volume de consultas, documentos e condomínios da sua rotina.
          </p>
        </div>

        {/* Seletor de perfil */}
        <div className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-3">
          {PROFILES.map((p) => {
            const active = highlighted === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => highlightPlan(p.id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start rounded-2xl border bg-papel p-5 text-left transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-bege",
                  active ? "border-dourado bg-dourado/5" : "border-borda hover:border-dourado/60",
                )}
              >
                <span className="t-body-sm font-medium text-verde">{p.label}</span>
                <span className="mt-1 t-micro text-ardosia">{p.price}</span>
              </button>
            );
          })}
        </div>

        {/* Billing toggle */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div
            role="tablist"
            aria-label="Ciclo de cobrança"
            className="inline-flex items-center gap-1 rounded-full border border-borda bg-papel p-1"
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
                    "rounded-full px-5 py-2 t-body-sm font-medium transition-colors duration-200",
                    active ? "bg-verde text-cream" : "text-verde hover:bg-verde/5",
                  )}
                >
                  {v === "monthly" ? "Mensal" : "Anual"}
                </button>
              );
            })}
          </div>
          {billing === "annual" && (
            <span className="t-micro rounded-full bg-verde/10 px-3 py-1 font-medium text-verde">
              2 meses grátis
            </span>
          )}
        </div>

        {/* Grade de planos */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const priced = resolvePrice(plan);
            const isH = highlighted === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "scroll-mt-28 rounded-2xl transition-shadow duration-300",
                  isH && "ring-2 ring-dourado ring-offset-4 ring-offset-bege",
                )}
              >
                <PlanCard {...priced} plan={plan} onCta={() => handleCta(plan)} />
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center t-micro text-ardosia">
          Todos os planos incluem acesso seguro via HTTPS, dados armazenados no Brasil e suporte por e-mail.
          Preços em reais. Plano anual cobrado à vista.
        </p>

        {/* FAQ */}
        <div className="mt-24 md:mt-32">
          <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
            <SectionLabel tone="dark">Perguntas frequentes</SectionLabel>
            <h2 className="t-h2 mt-5 text-verde">
              As dúvidas que separam você da primeira consulta.
            </h2>
            <ArcoAugusto width={52} color="hsl(33 40% 54%)" opacity={0.55} className="mt-6" />
          </div>

          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-borda bg-papel">
            <Accordion type="single" collapsible>
              {FAQ.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={`faq-${i}`}
                  className="border-b border-borda last:border-b-0"
                >
                  <AccordionTrigger className="items-start gap-6 px-6 py-5 text-left t-h4 text-grafite transition-colors duration-200 hover:bg-bege/50 hover:no-underline focus-visible:ring-2 focus-visible:ring-dourado md:px-7 [&>svg]:mt-1 [&>svg]:text-dourado [&>svg]:transition-transform [&>svg]:duration-200">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 t-body text-ardosia md:px-7">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PlanosFaq;