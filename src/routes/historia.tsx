import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { ManifestoFooter } from "@/components/landing/ManifestoFooter";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";
import { Reveal } from "@/components/landing/Reveal";
import { Icon } from "@iconify/react";

export const Route = createFileRoute("/historia")({
  head: () => ({
    meta: [
      { title: "A História, Augusto.IJ" },
      { name: "description", content: "A história fundadora do Augusto.IJ, inteligência jurídica para condomínios." },
      { property: "og:title", content: "A História, Augusto.IJ" },
      { property: "og:description", content: "A história fundadora do Augusto.IJ, inteligência jurídica para condomínios." },
      { property: "og:url", content: "https://augustoij.com.br/historia" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://augustoij.com.br/historia" }],
  }),
  component: HistoriaPage,
});

function HistoriaPage() {
  return (
    <div className="min-h-screen bg-cream text-grafite">
      <Nav />

      <article
        className="mx-auto max-w-[720px] px-6"
        style={{ paddingTop: "clamp(112px, 13vw, 144px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
      >
        <Reveal className="flex flex-col items-start">
          <SectionLabel tone="dark">A história fundadora</SectionLabel>
          <h1 className="t-display mt-5 text-verde">
            Augusto não nasceu em uma startup.
            <br />
            Nasceu em um escritório de advocacia.
          </h1>
          <ArcoAugusto width={52} color="hsl(33 40% 54%)" opacity={0.55} className="mt-8" />
          <p className="t-lead mt-6 italic text-ardosia">
            A história por trás da inteligência jurídica que está redefinindo o direito
            condominial brasileiro.
          </p>
        </Reveal>

        <Section title="A inquietação">
          <p className="t-body text-grafite text-justify">
            <span className="float-left font-heading text-dourado text-[72px] leading-none pr-3 pt-1">
              T
            </span>
            oda grande marca nasce de uma inquietação. Por anos, atendendo síndicos,
            administradoras e clientes em consultas condominiais, percebi que dúvidas
            aparentemente simples exigiam interpretação técnica jurídica de documentos,
            algo que um leigo dificilmente poderia responder com segurança.
          </p>
        </Section>

        <PullQuote>
          Faltava alguém entre o Direito e o cotidiano do condomínio. Faltava uma figura.
        </PullQuote>

        <Section title="A percepção">
          <p className="t-body text-grafite text-justify">
            Consultar a convenção e o regimento nunca é suficiente. Há determinações legais,
            infralegais, jurisprudência, doutrina e toda a técnica hermenêutica necessária
            para transformar informação em resposta utilizável. Cada condomínio tem sua
            própria realidade documental, impossível memorizar tudo, ter ao alcance de um
            piscar de olhos.
          </p>
          <p className="t-body mt-6 text-grafite text-justify">
            Síndicos decidiam sozinhos, no improviso. Administradoras escalavam sem
            padronização. Advogados gastavam suas melhores horas respondendo às mesmas
            perguntas, todos os dias.
          </p>
        </Section>

        <Section title="O nascimento do nome">
          <p className="t-body text-grafite text-justify">
            O nome veio de dois lugares. De <em>Augustus</em>, título romano que evocava
            solidez, ordem e legado, a herança de dois mil anos de Direito. E do meu filho,
            Augusto, que ainda não fala, mas já me lembra todos os dias por que construir
            algo que dure importa.
          </p>
        </Section>

        <Section title="A missão">
          <p className="t-body text-grafite text-justify">
            Democratizar o acesso à inteligência jurídica condominial. Fazer com que síndicos
            não precisem decidir sozinhos, que administradoras possam escalar sem perder
            qualidade e que advogados foquem no que exige raciocínio humano.
          </p>
        </Section>

        <Section title="A promessa">
          <p className="t-body text-grafite text-justify">
            Augusto responde, fundamenta e cita. Trabalha 24 horas por dia, sete dias por
            semana. Não substitui o profissional, potencializa cada decisão condominial
            com base em lei, doutrina e jurisprudência.
          </p>
          <p className="mt-8 font-heading italic text-verde text-[28px] leading-tight">
            Dura lex, sed Augusto.
          </p>
        </Section>

        <Reveal className="mt-16 font-heading italic text-ardosia text-base">
          Matheus Macêdo Góes
          <div className="t-label not-italic text-dourado mt-2">
            Fundador, Augusto.IJ
          </div>
        </Reveal>

        <Reveal className="mt-20 rounded-2xl border border-borda bg-papel p-10 text-center">
          <p className="t-h3 text-verde">
            Conheceu a história. Agora experimente.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-verde px-6 py-3 t-button text-cream transition-colors duration-200 hover:bg-verde-profundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-papel"
          >
            Pergunte ao Augusto
            <Icon icon="ph:arrow-right" width={18} />
          </Link>
        </Reveal>
      </article>

      <ManifestoFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal as="section" className="mt-16">
      <h2 className="t-h2 text-verde">{title}</h2>
      <div className="mt-5">{children}</div>
    </Reveal>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <Reveal as="blockquote" className="my-12 border-l-4 border-dourado bg-dourado/5 px-6 py-5 t-quote text-verde">
      {children}
    </Reveal>
  );
}