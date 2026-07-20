import { Link } from "@tanstack/react-router";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./Reveal";

const BLOCKS = [
  {
    numeral: "I",
    title: "Especialização exclusiva",
    body:
      "Augusto não tenta responder sobre tudo. Ele foi concebido para o cotidiano condominial brasileiro: quórum, convenção, regimento, inadimplência, contratos, assembleias, notificações e manutenção predial.",
  },
  {
    numeral: "II",
    title: "Repositório curado por juristas",
    body:
      "A base de legislação, jurisprudência e doutrina é alimentada e revisada por profissionais jurídicos especializados em Direito Condominial. Você não depende de conteúdo genérico da internet.",
  },
  {
    numeral: "III",
    title: "Base privada do seu condomínio",
    body:
      "Cada condomínio tem regras próprias. Envie a convenção, o regimento interno, as atas e os contratos: as respostas passam a considerar tanto a lei quanto as regras específicas da sua gestão.",
  },
  {
    numeral: "IV",
    title: "Sigilo dos documentos",
    body:
      "Documentos condominiais contêm informações sensíveis. Augusto opera em ambiente seguro, com acesso via HTTPS e dados armazenados no Brasil. Os documentos enviados permanecem na base privada do condomínio cadastrado.",
  },
];

export function TrustSection() {
  return (
    <section className="landing-section bg-landing-surface border-t border-landing-rule">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Por que confiar no Augusto"
          title="No Direito Condominial, uma resposta precisa ser verificável."
          subtitle="Decisões sobre contratos, multas, assembleias e documentos não podem depender de opinião de grupo, busca genérica ou modelos copiados sem contexto."
        />

        {/* Quatro blocos de prova */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {BLOCKS.map((b, i) => (
            <Reveal
              key={b.title}
              delay={(i % 2) * 0.08}
              className="landing-panel landing-card-hover group relative overflow-hidden rounded-2xl border-t-2 border-t-augusto-gold/60 p-8 lg:p-9"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-6 top-5 font-serif italic text-augusto-gold/25 text-[36px] leading-none transition-colors duration-200 group-hover:text-augusto-gold/55"
              >
                {b.numeral}
              </span>
              <h3 className="mt-1 font-serif text-augusto-green text-[24px] leading-tight tracking-[-0.01em]">
                {b.title}
              </h3>
              <p className="mt-3 text-[15.5px] leading-[1.65] text-augusto-slate">{b.body}</p>
              <span
                aria-hidden="true"
                className="mt-6 block h-px w-8 bg-augusto-gold/60 transition-all duration-200 group-hover:w-12 group-hover:bg-augusto-gold"
              />
            </Reveal>
          ))}
        </div>

        {/* Bloco compacto do fundador */}
        <Reveal
          delay={0.1}
          className="mt-16 grid gap-8 rounded-[1.75rem] border border-augusto-gold/30 bg-[var(--landing-gradient-card)] p-8 shadow-[var(--landing-shadow-card)] md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-12 md:p-10"
        >
          <div className="flex justify-center md:justify-start">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-augusto-green font-serif text-[38px] leading-none text-augusto-gold shadow-[var(--landing-shadow-soft)]">
              MG
            </div>
          </div>
          <div>
            <blockquote className="font-serif italic text-augusto-green text-[22px] leading-[1.35] md:text-[24px]">
              &ldquo;Faltava alguém entre o Direito e o cotidiano do condomínio.&rdquo;
            </blockquote>
            <p className="mt-4 text-[15.5px] leading-[1.65] text-augusto-slate">
              Augusto nasceu em um escritório de advocacia que atendia síndicos,
              administradoras e condomínios diante das mesmas dúvidas urgentes, muitas vezes
              fora do horário comercial.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-augusto-green">
                Matheus Macêdo Góes
              </div>
              <span className="hidden h-1 w-1 rounded-full bg-augusto-gold sm:inline-block" aria-hidden="true" />
              <div className="text-[12px] uppercase tracking-[0.16em] text-augusto-slate">
                Fundador do Augusto.IJ
              </div>
            </div>
            <Link
              to="/historia"
              className="mt-5 inline-flex items-center gap-1.5 rounded-sm text-[13.5px] font-semibold uppercase tracking-[0.14em] text-augusto-green transition-colors duration-200 hover:text-augusto-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
            >
              Ler a história completa →
            </Link>
          </div>
        </Reveal>

        {/* Fechamento + CTA */}
        <Reveal delay={0.14} className="mt-16 flex flex-col items-center text-center">
          <p className="max-w-[640px] font-serif italic text-augusto-slate text-[17px] leading-[1.7]">
            Antes de enviar uma notificação, aprovar uma decisão ou assinar um contrato,
            tenha uma orientação estruturada.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-augusto-green px-7 py-3.5 text-[14px] font-semibold uppercase tracking-[0.14em] text-augusto-cream shadow-[var(--landing-shadow-soft)] transition-all duration-200 hover:bg-augusto-green-dark hover:shadow-[var(--landing-shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold focus-visible:ring-offset-2 focus-visible:ring-offset-landing-surface active:scale-[0.98]"
          >
            Começar 7 dias grátis
          </Link>
          <span className="mt-3 text-[12px] text-augusto-slate">
            Sem cartão de crédito. Especialista em Direito Condominial brasileiro.
          </span>
        </Reveal>
      </div>
    </section>
  );
}

export default TrustSection;