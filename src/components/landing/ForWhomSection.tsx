import { Link } from "@tanstack/react-router";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./Reveal";

type Card = {
  label: string;
  title: string;
  body: string;
  bullets: string[];
  ctaLabel: string;
  href: string;
  featured?: boolean;
};

const CARDS: Card[] = [
  {
    label: "Síndicos",
    title: "Para quem decide sozinho às 22h.",
    body:
      "Você não foi eleito para decorar leis, calcular quóruns ou descobrir cláusulas de risco em um contrato tarde da noite. Augusto ajuda você a responder moradores, preparar assembleias e analisar documentos com a segurança de quem consultou a lei — e a convenção do próprio condomínio.",
    bullets: [
      "Dúvidas respondidas com fundamentação legal e orientação prática",
      "Notificações, editais, atas e comunicados prontos para adaptar",
      "Quórum e procedimento conferidos antes de cada assembleia",
      "Contratos analisados antes de assinar em nome do condomínio",
    ],
    ctaLabel: "Conhecer Augusto para síndicos",
    href: "/signup?public=sindico",
    featured: true,
  },
  {
    label: "Administradoras",
    title: "Escala sem respostas genéricas.",
    body:
      "Sua equipe recebe as mesmas dúvidas em condomínios diferentes todos os dias. Augusto organiza a primeira camada de orientação jurídica respeitando os documentos de cada cliente — cada condomínio tem sua base privada, com sua convenção e suas atas.",
    bullets: [
      "Orientações padronizadas com base legal e linguagem clara",
      "Consulta aos documentos específicos de cada condomínio da carteira",
      "Menos tempo gasto em dúvidas recorrentes",
      "Mais respaldo técnico para síndicos e conselhos",
    ],
    ctaLabel: "Conhecer Augusto para administradoras",
    href: "/signup?public=administradora",
  },
  {
    label: "Advogados",
    title: "O parecerista que cabe no seu dia.",
    body:
      "Augusto apoia a pesquisa, a estruturação de minutas e a análise documental no Direito Condominial, com jurisprudência citável e doutrina curada por profissionais da área. Você preserva o julgamento técnico e acelera o trabalho operacional.",
    bullets: [
      "Consultas estruturadas com fundamentação e jurisprudência citável",
      "Comparação de contratos com apontamento de riscos",
      "Minutas de notificações, editais, atas e regimentos",
      "Análise organizada dos documentos de cada condomínio",
    ],
    ctaLabel: "Conhecer Augusto para advogados",
    href: "/signup?public=advogado",
  },
];

export function ForWhomSection() {
  const featured = CARDS.find((c) => c.featured)!;
  const rest = CARDS.filter((c) => !c.featured);

  return (
    <section
      id="features"
      className="landing-section bg-landing-surface border-t border-landing-rule"
    >
      <div className="landing-container">
        <SectionHeader
          eyebrow="Para quem Augusto existe"
          title="Quem administra um condomínio não deveria decidir no escuro."
          subtitle="Augusto adapta o tom e a profundidade técnica ao seu interlocutor. Selecione o seu perfil e veja como ele atua no seu dia a dia."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {/* Featured card spans 3 cols on lg, more prominent visually */}
          <Reveal className="lg:col-span-3">
            <FeaturedCard card={featured} />
          </Reveal>

          {rest.map((c, i) => (
            <Reveal key={c.label} delay={0.06 + i * 0.06} className="lg:col-span-1 flex">
              <StandardCard card={c} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-20 flex flex-col items-center text-center">
          <p className="max-w-[640px] font-serif italic text-augusto-slate text-[17px] leading-[1.7]">
            Uma mesma especialidade. Aplicações diferentes para quem precisa decidir melhor
            no condomínio.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-augusto-green px-7 py-3.5 text-[14px] font-semibold uppercase tracking-[0.14em] text-augusto-cream shadow-[var(--landing-shadow-soft)] transition-all duration-200 hover:bg-augusto-green-dark hover:shadow-[var(--landing-shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold focus-visible:ring-offset-2 focus-visible:ring-offset-landing-surface active:scale-[0.98]"
          >
            Começar 7 dias grátis
          </Link>
          <span className="mt-3 text-[12px] text-augusto-slate">
            Sem cartão de crédito. Documentos em ambiente privado.
          </span>
        </Reveal>
      </div>
    </section>
  );
}

function FeaturedCard({ card }: { card: Card }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-augusto-gold/35 bg-[var(--landing-gradient-card)] p-8 shadow-[var(--landing-shadow-card)] transition-all duration-300 hover:shadow-[var(--landing-shadow-card-hover)] md:p-12 lg:p-14">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-augusto-gold to-transparent"
      />
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="lg:w-[42%]">
          <div className="inline-flex items-center gap-2 rounded-full bg-augusto-gold/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-augusto-gold" aria-hidden="true" />
            Público principal · {card.label}
          </div>
          <h3 className="mt-6 font-serif text-augusto-green text-[clamp(1.85rem,3.2vw,2.6rem)] leading-[1.08] tracking-[-0.02em]">
            {card.title}
          </h3>
          <p className="mt-6 text-[16.5px] leading-[1.7] text-augusto-slate">{card.body}</p>
          <Link
            to={card.href}
            className="mt-8 inline-flex items-center gap-2 rounded-sm text-[14px] font-semibold uppercase tracking-[0.14em] text-augusto-green transition-colors duration-200 hover:text-augusto-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
          >
            {card.ctaLabel}
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </div>
        <ul className="grid flex-1 gap-3 sm:grid-cols-2">
          {card.bullets.map((b) => (
            <li
              key={b}
              className="flex gap-3 rounded-xl border border-augusto-gold/20 bg-augusto-cream/60 px-4 py-3.5 text-[14.5px] leading-[1.55] text-augusto-slate-dark"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-augusto-gold"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StandardCard({ card }: { card: Card }) {
  return (
    <div className="landing-panel landing-card-hover flex w-full flex-col rounded-2xl border-t-2 border-t-augusto-gold p-8 lg:p-9">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
        {card.label}
      </div>
      <h3 className="mt-3 font-serif text-augusto-green text-[26px] leading-tight tracking-[-0.01em]">
        {card.title}
      </h3>
      <p className="mt-4 text-[15.5px] leading-[1.65] text-augusto-slate">{card.body}</p>
      <ul className="mt-6 space-y-2.5">
        {card.bullets.map((b) => (
          <li key={b} className="flex gap-2.5 text-[14.5px] leading-[1.55] text-augusto-slate">
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-augusto-gold"
            />
            {b}
          </li>
        ))}
      </ul>
      <Link
        to={card.href}
        className="mt-8 inline-flex items-center gap-1.5 rounded-sm text-[13.5px] font-semibold uppercase tracking-[0.14em] text-augusto-green transition-colors duration-200 hover:text-augusto-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
      >
        {card.ctaLabel} →
      </Link>
    </div>
  );
}

export default ForWhomSection;