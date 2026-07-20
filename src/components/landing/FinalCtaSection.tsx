import { Link } from "@tanstack/react-router";
import { Reveal } from "./Reveal";

export function FinalCtaSection() {
  return (
    <section className="relative isolate overflow-hidden landing-hero-bg border-t border-landing-rule">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-10 h-[26rem] w-[26rem] rounded-full bg-augusto-gold/15 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-[24rem] w-[24rem] rounded-full bg-augusto-cream/10 blur-3xl"
      />
      <div className="landing-container relative py-24 md:py-32">
        <Reveal className="mx-auto flex max-w-[820px] flex-col items-center text-center">
          <span className="inline-flex items-center gap-3 rounded-full border border-augusto-gold/35 bg-augusto-cream/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-augusto-gold-light shadow-[var(--landing-shadow-soft)] supports-[backdrop-filter]:backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-augusto-gold" aria-hidden="true" />
            Antes da próxima decisão
          </span>

          <h2 className="mt-8 font-serif text-augusto-cream text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.03em]">
            Toda decisão condominial merece respaldo antes de virar problema.
          </h2>

          <p className="mt-8 max-w-[640px] text-[17px] leading-[1.75] text-augusto-cream/80 sm:text-lg">
            Não decida no improviso quando a convenção, o contrato ou uma assembleia
            exigirem mais do que bom senso. Com Augusto, você consulta dúvidas, analisa
            documentos e prepara comunicações com fundamentação legal, jurisprudência
            citável e orientação prática para o próximo passo.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-full bg-augusto-gold px-8 py-4 text-[14px] font-semibold uppercase tracking-[0.14em] text-augusto-green-dark shadow-[var(--landing-shadow-card)] transition-all duration-200 hover:bg-augusto-gold-light hover:shadow-[var(--landing-shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-augusto-green active:scale-[0.98]"
            >
              Começar 7 dias grátis
            </Link>
            <span className="text-[12.5px] text-augusto-cream/70">
              Sem cartão de crédito. Especialista em Direito Condominial brasileiro.
            </span>
          </div>

          <span
            aria-hidden="true"
            className="mt-14 block h-px w-24 bg-gradient-to-r from-transparent via-augusto-gold/70 to-transparent"
          />

          <p className="mt-8 font-serif italic text-augusto-cream text-[18px] leading-[1.5] md:text-[20px]">
            <span className="text-augusto-gold-light">Dura Lex, sed Augusto.</span>{" "}
            <span className="text-augusto-cream/80">
              A lei é dura, mas você tem Augusto.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export default FinalCtaSection;