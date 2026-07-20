import { Link } from "@tanstack/react-router";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./Reveal";

const ROWS: { situacao: string; entrega: string }[] = [
  {
    situacao: "Assembleia sensível",
    entrega: "Quórum, procedimento correto e minuta de edital",
  },
  {
    situacao: "Contrato de fornecedor para assinar",
    entrega: "Riscos, cláusulas de atenção e pontos de negociação",
  },
  {
    situacao: "Multa ou conflito com morador",
    entrega: "Orientação fundamentada e modelo de notificação",
  },
  {
    situacao: "Dúvida sobre regra do condomínio",
    entrega:
      "Resposta cruzando a lei com a convenção, o regimento e as atas do próprio condomínio",
  },
];

const SINTESE = [
  "Mais clareza para decidir antes de responder, assinar ou convocar assembleia",
  "Menos tempo procurando referências genéricas em fontes dispersas",
  "Mais consistência em notificações, atas, editais e orientações",
  "Respostas que consideram a legislação, a jurisprudência e os documentos do próprio condomínio",
];

export function AugustoNaPratica() {
  return (
    <section className="landing-cream-bg landing-section border-t border-landing-rule">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Augusto na prática"
          title="Quando a dúvida exige resposta, improviso não é uma opção."
          subtitle="Situações que chegam todos os dias à mesa de síndicos, administradoras e advogados — e o que Augusto entrega em cada uma."
        />

        {/* Grid de cenários */}
        <div className="mt-16 overflow-hidden rounded-[1.5rem] border border-landing-rule bg-landing-panel shadow-[var(--landing-shadow-card)]">
          {/* Header (desktop) */}
          <div className="hidden md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] md:gap-8 md:border-b md:border-landing-rule md:bg-augusto-cream/60 md:px-8 md:py-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
              Situação
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
              O que Augusto entrega
            </div>
          </div>

          <ul className="divide-y divide-landing-rule">
            {ROWS.map((row, i) => (
              <Reveal
                as="li"
                key={row.situacao}
                delay={i * 0.05}
                className="grid gap-3 px-6 py-6 transition-colors duration-200 hover:bg-augusto-cream/40 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] md:items-start md:gap-8 md:px-8 md:py-7"
              >
                <div>
                  <div className="md:hidden mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
                    Situação
                  </div>
                  <div className="font-serif text-augusto-green text-[20px] leading-[1.25] tracking-[-0.01em] md:text-[22px]">
                    {row.situacao}
                  </div>
                </div>
                <div>
                  <div className="md:hidden mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
                    O que Augusto entrega
                  </div>
                  <p className="text-[15.5px] leading-[1.65] text-augusto-slate">
                    {row.entrega}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        {/* Síntese */}
        <Reveal delay={0.08} className="mt-14 rounded-[1.5rem] border border-augusto-gold/25 bg-augusto-cream/50 p-8 md:p-10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
            Em síntese
          </div>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {SINTESE.map((b) => (
              <li
                key={b}
                className="flex gap-3 text-[15.5px] leading-[1.6] text-augusto-slate-dark"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-augusto-gold"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Fechamento + CTA */}
        <Reveal delay={0.12} className="mt-16 flex flex-col items-center text-center">
          <p className="max-w-[620px] font-serif italic text-augusto-slate text-[17px] leading-[1.7]">
            Sua próxima decisão pode começar com uma consulta bem fundamentada.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-augusto-green px-7 py-3.5 text-[14px] font-semibold uppercase tracking-[0.14em] text-augusto-cream shadow-[var(--landing-shadow-soft)] transition-all duration-200 hover:bg-augusto-green-dark hover:shadow-[var(--landing-shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold focus-visible:ring-offset-2 focus-visible:ring-offset-landing-surface active:scale-[0.98]"
          >
            Começar 7 dias grátis
          </Link>
          <span className="mt-3 text-[12px] text-augusto-slate">Sem cartão de crédito.</span>
        </Reveal>
      </div>
    </section>
  );
}

export default AugustoNaPratica;