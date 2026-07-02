const STATS = [
  { number: "350.000+", label: "Condomínios no Brasil" },
  { number: "12 milhões", label: "Unidades habitacionais" },
  { number: "24h/7d", label: "Augusto disponível" },
  { number: "Zero", label: "Advogados de plantão" },
];

export function ProblemSection() {
  return (
    <section className="bg-augusto-cream-dark border-t border-augusto-gold/20 py-24 px-6">
      <div className="mx-auto max-w-6xl text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
          O estado atual do direito condominial
        </div>
        <h2 className="mt-5 font-serif text-augusto-green text-4xl md:text-5xl leading-[1.1]">
          Um mercado decidindo no improviso.
        </h2>
        <p className="mt-5 mx-auto max-w-[600px] text-lg text-augusto-slate leading-relaxed">
          O Brasil tem leis condominiais robustas. O que falta é acesso à inteligência jurídica
          que as compreenda, e esteja disponível quando você precisa.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="group flex flex-col items-center rounded-xl bg-white border border-augusto-gold/25 shadow-sm px-6 py-10 hover:-translate-y-1 hover:shadow-md hover:border-augusto-gold transition-all duration-200"
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
            </div>
          ))}
        </div>

        <div className="mt-20 mx-auto max-w-[820px] rounded-2xl bg-augusto-green text-augusto-cream px-8 md:px-14 py-14 shadow-[0_30px_80px_-30px_rgba(0,81,43,0.5)] relative overflow-hidden">
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
        </div>
      </div>
    </section>
  );
}

export default ProblemSection;