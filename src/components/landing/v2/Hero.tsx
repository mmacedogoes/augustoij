import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { PrimaryButton } from "@/components/landing/PrimaryButton";
import { DemoChatWidget, type Persona } from "@/components/landing/DemoChatWidget";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";

const PERFIS: { id: Persona; label: string }[] = [
  { id: "sindico", label: "Sou síndico" },
  { id: "adm", label: "Sou administrador" },
  { id: "advogado", label: "Sou advogado" },
];

export function Hero() {
  const [persona, setPersona] = useState<Persona>("sindico");
  const revealRef = useScrollReveal<HTMLDivElement>();

  const scrollToChat = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById("hero-chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

      <div className="relative mx-auto grid w-full max-w-[var(--container-container)] items-center gap-14 px-6 pb-20 pt-[110px] md:grid-cols-[55fr_45fr] md:gap-12 md:pb-24 md:pt-[140px]">
        {/* Coluna esquerda */}
        <div className="max-w-[620px]">
          <SectionLabel tone="light">
            Inteligência jurídica especializada em Direito Condominial
          </SectionLabel>

          <h1
            className="mt-6 font-heading font-medium leading-[1.04] tracking-[-0.01em] text-[hsl(38_35%_96%)]"
            style={{ fontSize: "clamp(28px, 2.8vw, 46px)" }}
          >
            Augusto.IJ conhece a lei. E conhece{" "}
            <em className="italic text-[hsl(35_45%_74%)]">o seu condomínio.</em>
          </h1>

          <p className="mt-6 max-w-[40ch] font-body text-[15px] leading-[1.65] text-off/75 sm:text-[16px]">
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
                    "inline-flex items-center rounded-full px-4 py-2 font-body text-[13px] font-medium transition-colors duration-200",
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
            <a
              href="#hero-chat"
              onClick={scrollToChat}
              className="font-body text-[14px] text-off/80 underline decoration-off/40 underline-offset-4 transition-colors duration-200 hover:text-dourado-claro hover:decoration-dourado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-verde-profundo"
            >
              Ver como o Augusto.IJ responde
            </a>
          </div>

          {/* Microcópia */}
          <p className="mt-4 font-body text-[12px] leading-[1.55] text-off/55">
            Sem cartão de crédito. Já no plano gratuito você envia a convenção e um contrato.
          </p>

          {/* Assinatura */}
          <p className="mt-8 font-heading text-[14px] italic text-off/65">
            O Augusto.IJ não substitui. Potencializa.
          </p>
        </div>

        {/* Coluna direita */}
        <div
          ref={revealRef}
          className="opacity-0 translate-y-4 transition-[opacity,transform] duration-500 ease-out [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0 self-end"
        >
          <DemoChatWidget persona={persona} />
        </div>
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