import { BookOpenText, Gavel, FileText, Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";

const ITEMS = [
  {
    icon: Gavel,
    label: "Especialista exclusivo em Direito Condominial brasileiro",
  },
  {
    icon: BookOpenText,
    label: "Fundamentação legal e jurisprudência citáveis",
  },
  {
    icon: FileText,
    label:
      "Respostas que consideram a convenção, o regimento e as atas do seu condomínio",
  },
  {
    icon: Sparkles,
    label: "7 dias grátis, sem cartão de crédito",
  },
] as const;

export function TrustBand() {
  return (
    <section
      aria-label="Pilares de confiança"
      className="border-y border-landing-rule bg-landing-surface-alt/60"
    >
      <div className="landing-container px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {ITEMS.map((item, i) => (
            <Reveal
              key={item.label}
              direction="up"
              delay={i * 0.06}
              className="flex items-start gap-3 sm:gap-4"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-augusto-gold/35 bg-augusto-cream text-augusto-green shadow-[var(--landing-shadow-soft)] transition-colors duration-200 sm:h-11 sm:w-11"
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
              </span>
              <p className="text-[14px] leading-[1.55] text-augusto-slate-dark sm:text-[15px]">
                {item.label}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default TrustBand;