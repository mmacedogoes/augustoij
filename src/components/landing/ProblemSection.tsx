const STATS = [
  { number: "350.000+", label: "Condomínios no Brasil" },
  { number: "12 milhões", label: "Unidades habitacionais" },
  { number: "24h/7d", label: "Augusto disponível" },
  { number: "Zero", label: "Advogados de plantão" },
];

export function ProblemSection() {
  return (
    <section className="bg-augusto-cream border-t border-augusto-gold/15 py-24 px-6">
      <div className="mx-auto max-w-6xl text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
          O estado atual do direito condominial
        </div>
        <h2 className="mt-5 font-serif text-augusto-green text-4xl md:text-5xl leading-[1.1]">
          Um mercado decidindo no improviso.
        </h2>
        <p className="mt-5 mx-auto max-w-[600px] text-lg text-augusto-slate leading-relaxed">
          O Brasil tem leis condominiais robustas. O que falta é acesso à inteligência jurídica
          que as compreenda — e esteja disponível quando você precisa.
        </p>

        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <div className="font-serif text-augusto-green text-6xl md:text-[72px] leading-none">
                {s.number}
              </div>
              <span
                className="mt-4 block h-px w-[60px] bg-augusto-gold"
                aria-hidden="true"
              />
              <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-slate">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <blockquote className="mt-20 mx-auto max-w-[700px] font-serif italic text-augusto-green text-2xl leading-snug">
          &ldquo;Síndicos não têm orçamento para um advogado de plantão. Administradores não têm
          escala para repetir cada orientação. Advogados não têm tempo para responder o mesmo,
          todos os dias.&rdquo;
        </blockquote>
        <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
          Do manifesto Augusto.IJ
        </div>
      </div>
    </section>
  );
}

export default ProblemSection;