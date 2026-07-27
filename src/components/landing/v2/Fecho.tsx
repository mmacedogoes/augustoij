import { Link } from "@tanstack/react-router";
import { Icon } from "@iconify/react";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";
import { Reveal } from "@/components/landing/Reveal";

export function Fecho() {
  return (
    <section
      id="fecho"
      className="relative w-full overflow-hidden bg-verde-profundo px-6 text-cream"
      style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 0%, hsl(33 40% 54% / 0.16), transparent 45%), radial-gradient(circle at 85% 100%, hsl(150 61% 26% / 0.35), transparent 55%)",
        }}
      />

      <Reveal className="relative mx-auto flex w-full max-w-[820px] flex-col items-center text-center">
        <SectionLabel tone="light">O convite</SectionLabel>

        <h2 className="t-display mt-6 italic text-cream sm:whitespace-nowrap">
          Dura lex, sed Augusto.
        </h2>
        <p className="mt-4 t-label text-dourado">A lei é dura, mas você tem Augusto.</p>

        <ArcoAugusto width={64} color="hsl(33 40% 54%)" opacity={0.7} className="mt-8" />

        <p className="mt-8 t-lead mx-auto text-cream/85">
          Sete dias para experimentar o Augusto na sua gestão. Sem cartão de crédito.
          Sem promessas mirabolantes. Só decisões mais bem fundamentadas — a partir de hoje.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-dourado px-7 py-3.5 t-button font-medium text-[hsl(30_60%_9%)] transition-colors duration-200 hover:bg-[hsl(33_40%_47%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-verde-profundo"
          >
            Começar grátis por 7 dias
            <Icon icon="ph:arrow-right" width={20} />
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-cream/25 px-7 py-3.5 t-button text-cream transition-colors duration-200 hover:bg-cream/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-verde-profundo"
          >
            Ver planos e preços
          </a>
        </div>

        <p className="mt-8 t-micro text-cream/60">
          Não substituímos o advogado do condomínio. Aceleramos a consulta jurídica condominial
          com fundamentação, contexto e prática.
        </p>
      </Reveal>
    </section>
  );
}

export default Fecho;