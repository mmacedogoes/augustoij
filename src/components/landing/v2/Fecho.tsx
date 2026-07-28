import { Link } from "@tanstack/react-router";
import { Icon } from "@iconify/react";
import { SectionLabel } from "@/components/landing/SectionLabel";
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

      <Reveal className="relative mx-auto flex w-full max-w-[640px] flex-col items-center text-center">
        <SectionLabel tone="light">ANTES DA PRÓXIMA DECISÃO</SectionLabel>

        <h2
          className="mt-6"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 500,
            color: "#F7F5F1",
            fontSize: "clamp(28px, 4vw, 44px)",
            lineHeight: 1.15,
          }}
        >
          Toda decisão condominial merece respaldo antes de virar problema.
        </h2>

        <p
          className="mt-6 t-lead"
          style={{
            fontFamily: '"Inter", system-ui, sans-serif',
            color: "hsl(var(--off) / 0.78)",
          }}
        >
          Não decida no improviso quando a convenção, o contrato ou uma assembleia exigirem mais do que bom senso. Com o Augusto.IJ, você consulta dúvidas, analisa documentos e prepara comunicações com fundamentação legal, jurisprudência citável, orientação prática e as regras e decisões do seu próprio condomínio.
        </p>

        <Link
          to="/signup"
          className="mt-10 inline-flex items-center gap-2 rounded-lg px-7 py-3.5 t-button font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-verde-profundo"
          style={{ backgroundColor: "#B8935A", color: "#241A0C" }}
        >
          Começar 7 dias grátis
          <Icon icon="ph:arrow-right" width={20} />
        </Link>

        <p className="mt-4 t-micro text-cream/60">
          Sem cartão de crédito. Envie sua convenção e um contrato já no plano gratuito.
        </p>

        <a
          href="#pricing"
          className="mt-3 t-micro underline underline-offset-4"
          style={{ color: "hsl(var(--off) / 0.70)", fontFamily: '"Inter", system-ui, sans-serif' }}
        >
          Ver planos e preços
        </a>

        <div
          aria-hidden="true"
          className="mt-10"
          style={{ width: "80px", height: "1px", background: "hsl(var(--off) / 0.14)" }}
        />

        <blockquote
          className="mt-10"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: "italic",
            color: "hsl(var(--off) / 0.85)",
            fontSize: "clamp(18px, 2.2vw, 22px)",
            lineHeight: 1.5,
          }}
        >
          Síndicos não têm orçamento para um advogado de plantão. Administradores não têm escala para repetir cada orientação. Advogados não têm tempo para responder o mesmo, todos os dias.
        </blockquote>

        <p
          className="mt-4"
          style={{
            fontSize: "10.5px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "hsl(33 55% 68%)",
            fontFamily: '"Inter", system-ui, sans-serif',
          }}
        >
          DO MANIFESTO AUGUSTO.IJ
        </p>

        <Link
          to="/manifesto"
          className="mt-6"
          style={{
            fontSize: "11px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "hsl(var(--off) / 0.70)",
            fontFamily: '"Inter", system-ui, sans-serif',
          }}
        >
          LER O MANIFESTO COMPLETO
        </Link>

        <p
          className="mt-10"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: "italic",
            color: "hsl(33 55% 68%)",
            fontSize: "clamp(24px, 3vw, 32px)",
          }}
        >
          Dura lex, sed Augusto.
        </p>
        <p
          className="mt-2"
          style={{
            fontSize: "10.5px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "hsl(var(--off) / 0.60)",
            fontFamily: '"Inter", system-ui, sans-serif',
          }}
        >
          A LEI É DURA, MAS VOCÊ TEM O AUGUSTO.IJ
        </p>
      </Reveal>
    </section>
  );
}

export default Fecho;