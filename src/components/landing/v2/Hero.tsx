import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { PrimaryButton } from "@/components/landing/PrimaryButton";
import { DemoChatWidget, type Persona } from "@/components/landing/DemoChatWidget";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";

const PERFIS: { id: Persona; label: string }[] = [
  { id: "sindico", label: "Sou síndico" },
  { id: "adm", label: "Sou administrador" },
  { id: "advogado", label: "Sou advogado" },
];

export function Hero() {
  const [persona, setPersona] = useState<Persona>("sindico");

  return (
    <section
      id="hero"
      className="relative isolate w-full overflow-hidden bg-verde-profundo text-cream"
      style={{
        backgroundImage:
          "radial-gradient(60% 55% at 78% 40%, hsl(150 94% 14%) 0%, transparent 65%)",
      }}
    >
      {/* Ornamento decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 hidden md:block"
      >
        <ArcoAugusto width={340} color="hsl(33 40% 54%)" opacity={0.12} strokeWidth={1.5} />
      </div>

      <div className="relative mx-auto grid w-full max-w-[var(--container-container)] items-center gap-12 px-6 pb-[clamp(64px,8vw,96px)] pt-[clamp(96px,12vw,128px)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14 md:pb-[clamp(80px,10vw,120px)] md:pt-[clamp(112px,13vw,144px)]">
        {/* Coluna esquerda */}
        <Reveal className="max-w-[620px]">
          <SectionLabel tone="light">
            Inteligência jurídica especializada em Direito Condominial
          </SectionLabel>

          <h1 className="t-display mt-6 text-cream">
            Augusto.IJ conhece a lei. E conhece{" "}
            <em className="italic text-dourado-claro">o seu condomínio.</em>
          </h1>

          <p className="t-lead mt-6 text-off/80" style={{ maxWidth: "48ch" }}>
            O Augusto.IJ cruza a legislação, a jurisprudência e a doutrina com a
            convenção, o regimento interno e as atas de assembleia do seu
            condomínio. Consulte dúvidas, analise contratos e prepare
            assembleias com respostas que consideram as regras que valem no seu
            prédio, e as decisões que a sua assembleia já tomou.
          </p>

          {/* Chips de perfil */}
          <div className="mt-8 flex flex-wrap gap-2">
            {PERFIS.map((p) => {
              const active = p.id === persona;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersona(p.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center rounded-full px-4 py-2 font-body text-[13px] font-medium transition-colors duration-200 active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-verde-profundo",
                    active
                      ? "bg-dourado text-[hsl(30_60%_9%)]"
                      : "border border-off/30 text-off/80 hover:border-off/60 hover:text-off",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Ações */}
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link to="/signup" className="w-full sm:w-auto">
              <PrimaryButton className="w-full sm:w-auto">
                Começar 7 dias grátis
                <Icon icon="ph:arrow-right" className="h-4 w-4" />
              </PrimaryButton>
            </Link>
          </div>

          {/* Microcópia */}
          <p className="t-micro mt-4 text-off/55">
            Sem cartão de crédito. Já no plano gratuito você envia a convenção e um contrato.
          </p>

          {/* Assinatura */}
          <p className="mt-8 font-heading text-[15px] italic text-off/65">
            O Augusto.IJ não substitui. Potencializa.
          </p>
        </Reveal>

        {/* Coluna direita */}
        <Reveal delay={120} className="self-stretch">
          <DemoChatWidget persona={persona} />
        </Reveal>
      </div>

      {/* Ficha técnica na base */}
      <div className="relative mx-auto w-full max-w-[var(--container-container)] px-6 pb-8">
        <div className="border-t border-off/15" />
        <ul className="mt-5 flex flex-col gap-2 font-body text-[11px] font-medium uppercase text-off/55 sm:flex-row sm:items-center sm:justify-between sm:gap-6" style={{ letterSpacing: "0.15em" }}>
          <li>3 perguntas grátis, sem cadastro</li>
          <li className="hidden sm:block" aria-hidden="true">·</li>
          <li>Resposta com lei, julgado e a sua convenção</li>
          <li className="hidden sm:block" aria-hidden="true">·</li>
          <li>24h disponível</li>
        </ul>
      </div>
    </section>
  );
}

export default Hero;