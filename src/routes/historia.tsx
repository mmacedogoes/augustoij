import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { ManifestoFooter } from "@/components/landing/ManifestoFooter";

export const Route = createFileRoute("/historia")({
  head: () => ({
    meta: [
      { title: "A História — Augusto.IJ" },
      { name: "description", content: "A história fundadora do Augusto.IJ — inteligência jurídica para condomínios." },
    ],
  }),
  component: HistoriaPage,
});

function HistoriaPage() {
  return (
    <div className="min-h-screen bg-augusto-cream text-augusto-slate-dark">
      <Nav />

      <article className="mx-auto max-w-[720px] px-6 py-24">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
          A história fundadora
        </div>
        <h1 className="mt-6 font-serif text-augusto-green text-5xl md:text-[68px] leading-[1.05]">
          Augusto não nasceu em uma startup.
          <br />
          Nasceu em um escritório de advocacia.
        </h1>
        <p className="mt-6 font-serif italic text-augusto-slate text-[22px] leading-snug">
          A história por trás da inteligência jurídica que está redefinindo o direito
          condominial brasileiro.
        </p>

        <div className="my-12 h-px w-[60px] bg-augusto-gold" aria-hidden="true" />

        <Section title="A inquietação">
          <p className="text-[17px] leading-[1.75] text-augusto-slate-dark text-justify">
            <span className="float-left font-serif text-augusto-gold text-[72px] leading-none pr-3 pt-1">
              T
            </span>
            oda grande marca nasce de uma inquietação. Por anos, atendendo síndicos,
            administradoras e clientes em consultas condominiais, percebi que dúvidas
            aparentemente simples exigiam interpretação técnica jurídica de documentos —
            algo que um leigo dificilmente poderia responder com segurança.
          </p>
        </Section>

        <PullQuote>
          Faltava alguém entre o Direito e o cotidiano do condomínio. Faltava uma figura.
        </PullQuote>

        <Section title="A percepção">
          <p className="text-[17px] leading-[1.75] text-augusto-slate-dark text-justify">
            Consultar a convenção e o regimento nunca é suficiente. Há determinações legais,
            infralegais, jurisprudência, doutrina e toda a técnica hermenêutica necessária
            para transformar informação em resposta utilizável. Cada condomínio tem sua
            própria realidade documental — impossível memorizar tudo, ter ao alcance de um
            piscar de olhos.
          </p>
          <p className="mt-6 text-[17px] leading-[1.75] text-augusto-slate-dark text-justify">
            Síndicos decidiam sozinhos, no improviso. Administradoras escalavam sem
            padronização. Advogados gastavam suas melhores horas respondendo às mesmas
            perguntas, todos os dias.
          </p>
        </Section>

        <Section title="O nascimento do nome">
          <p className="text-[17px] leading-[1.75] text-augusto-slate-dark text-justify">
            O nome veio de dois lugares. De <em>Augustus</em>, título romano que evocava
            solidez, ordem e legado — a herança de dois mil anos de Direito. E do meu filho,
            Augusto, que ainda não fala, mas já me lembra todos os dias por que construir
            algo que dure importa.
          </p>
        </Section>

        <Section title="A missão">
          <p className="text-[17px] leading-[1.75] text-augusto-slate-dark text-justify">
            Democratizar o acesso à inteligência jurídica condominial. Fazer com que síndicos
            não precisem decidir sozinhos, que administradoras possam escalar sem perder
            qualidade e que advogados foquem no que exige raciocínio humano.
          </p>
        </Section>

        <Section title="A promessa">
          <p className="text-[17px] leading-[1.75] text-augusto-slate-dark text-justify">
            Augusto responde, fundamenta e cita. Trabalha 24 horas por dia, sete dias por
            semana. Não substitui o profissional — potencializa cada decisão condominial
            com base em lei, doutrina e jurisprudência.
          </p>
          <p className="mt-8 font-serif italic text-augusto-green text-[28px]">
            Dura lex, sed Augusto.
          </p>
        </Section>

        <div className="mt-16 font-serif italic text-augusto-slate text-base">
          Augusto Macêdo Góes
          <div className="not-italic text-[13px] uppercase tracking-[0.18em] text-augusto-gold mt-2 font-sans font-medium">
            Fundador — Augusto.IJ
          </div>
        </div>

        <div className="mt-20 rounded-lg border-t-2 border-augusto-gold bg-white p-10 text-center shadow-sm">
          <p className="font-serif text-augusto-green text-2xl">
            Conheceu a história. Agora experimente.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-augusto-green px-5 py-3 text-sm font-medium text-augusto-cream hover:bg-augusto-green-dark transition-colors"
          >
            Pergunte ao Augusto →
          </Link>
        </div>
      </article>

      <ManifestoFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="font-serif text-augusto-green text-[32px] leading-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="my-10 border-l-4 border-augusto-gold bg-augusto-gold/5 px-6 py-5 font-serif italic text-augusto-green text-[24px] leading-snug">
      {children}
    </blockquote>
  );
}