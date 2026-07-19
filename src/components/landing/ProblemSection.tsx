import { Reveal } from "./Reveal";

const STATS = [
  { number: "350.000+", label: "Condomínios no Brasil" },
  { number: "12 milhões", label: "Unidades habitacionais" },
  { number: "24h/7d", label: "Augusto disponível" },
  { number: "Zero", label: "Advogados de plantão" },
];

export function ProblemSection() {
  return (
    <section className="landing-cream-bg landing-section border-t border-landing-rule">
      <div className="landing-container text-center">
        <div className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
          <span className="h-px w-8 bg-augusto-gold/55" aria-hidden="true" />
          O estado atual do direito condominial
          <span className="h-px w-8 bg-augusto-gold/55" aria-hidden="true" />
        </div>
        <h2 className="mt-6 font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.96] tracking-[-0.035em] text-augusto-green">
          Um mercado decidindo no improviso.
        </h2>
        <p className="mx-auto mt-6 max-w-[600px] text-[17px] leading-[1.75] text-augusto-slate sm:text-lg">
          O Brasil tem leis condominiais robustas. O que falta é acesso à inteligência jurídica
          que as compreenda, e esteja disponível quando você precisa.
        </p>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal
              key={s.label}
              delay={i * 0.08}
              className="landing-panel landing-card-hover group flex flex-col items-center rounded-2xl px-6 py-10"
            >
              <div className="font-serif text-augusto-green text-5xl md:text-[64px] leading-none">
                {s.number}
              </div>
              <span
                className="mt-5 block h-px w-[48px] bg-augusto-gold group-hover:w-[72px] transition-all duration-300"
                aria-hidden="true"
              />
              <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-slate">
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal
          delay={0.1}
          className="relative mx-auto mt-20 max-w-[820px] overflow-hidden rounded-[1.75rem] bg-augusto-green px-8 py-14 text-augusto-cream shadow-[var(--landing-shadow-deep)] md:px-14"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-6 top-2 font-serif text-augusto-gold/70 text-[140px] leading-none select-none"
          >
            &ldquo;
          </span>
          <blockquote className="relative font-serif italic text-augusto-cream text-2xl md:text-[28px] leading-snug">
            Síndicos não têm orçamento para um advogado de plantão. Administradores não têm
            escala para repetir cada orientação. Advogados não têm tempo para responder o
            mesmo, todos os dias.
          </blockquote>
          <div className="mt-6 text-[11px] font-medium uppercase tracking-[0.24em] text-augusto-gold">
            Do manifesto Augusto.IJ
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default ProblemSection;