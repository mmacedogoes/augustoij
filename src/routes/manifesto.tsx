import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { ManifestoFooter } from "@/components/landing/ManifestoFooter";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";
import { Reveal } from "@/components/landing/Reveal";
import { Icon } from "@iconify/react";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto, Augusto.IJ" },
      { name: "description", content: "Manifesto institucional do Augusto.IJ. Missão, visão e valores." },
      { property: "og:title", content: "Manifesto, Augusto.IJ" },
      { property: "og:description", content: "Manifesto institucional do Augusto.IJ. Missão, visão e valores." },
      { property: "og:url", content: "https://augustoij.com.br/manifesto" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://augustoij.com.br/manifesto" }],
  }),
  component: ManifestoPage,
});

const MANIFESTO = [
  "Acreditamos que toda decisão condominial merece um bom conselho jurídico.",
  "Acreditamos que a lei não pode ser privilégio de quem tem orçamento alto.",
  "Acreditamos que síndicos não deveriam decidir sozinhos, que administradores não deveriam escalar no improviso, que advogados não deveriam gastar suas melhores horas respondendo às mesmas perguntas.",
  "Acreditamos na solidez dos direitos. Na proteção dos investimentos. Na dignidade da convivência. Na boa relação entre pessoas e propriedades.",
  "Por isso construímos Augusto.IJ, para que, em cada condomínio do Brasil, exista alguém pronto a responder, fundamentar e orientar. Vinte e quatro horas por dia. Sete dias por semana. Dois mil anos de Direito ao alcance de uma pergunta.",
];

const VALORES = [
  { nome: "Solidez Técnica", desc: "Toda resposta ancorada em lei, doutrina e jurisprudência." },
  { nome: "Atualização Permanente", desc: "A legislação muda. Augusto acompanha, sem exceção." },
  { nome: "Dignidade da Convivência", desc: "Respeito às pessoas antes das regras, sempre." },
  { nome: "Sigilo Absoluto", desc: "Dados de condomínios e partes jamais são divulgados." },
  { nome: "Acessibilidade", desc: "Inteligência jurídica ao alcance de qualquer profissional." },
  { nome: "Verdade Antes da Conveniência", desc: "Augusto responde o certo, não o que soa melhor." },
  { nome: "Legado", desc: "Construímos para durar dois mil anos, como o Direito." },
];

function ManifestoPage() {
  return (
    <div className="min-h-screen bg-cream text-grafite">
      <Nav />

      {/* Hero, banda verde */}
      <section
        className="bg-verde-profundo px-6 text-center"
        style={{ paddingTop: "clamp(120px, 14vw, 168px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
      >
        <Reveal className="mx-auto flex max-w-[800px] flex-col items-center">
          <SectionLabel tone="light">Manifesto</SectionLabel>
          <h1 className="t-display mt-5 italic text-cream">
            Dura lex, sed Augusto.
          </h1>
          <ArcoAugusto width={60} color="hsl(33 40% 54%)" opacity={0.7} className="mt-8" />
          <div className="mt-6 t-label text-dourado">
            A lei é dura, mas você tem Augusto.
          </div>
        </Reveal>
      </section>

      {/* Credo, card branco sobre creme */}
      <section
        className="bg-cream px-6"
        style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
      >
        <Reveal className="mx-auto max-w-[760px] rounded-2xl bg-papel border border-borda p-8 md:p-14 space-y-6">
          {MANIFESTO.map((linha, i) => (
            <p
              key={i}
              className={
                i % 2 === 0
                  ? "border-l-4 border-dourado pl-5 t-h4 text-grafite"
                  : "pl-5 t-h4 text-grafite"
              }
            >
              {linha}
            </p>
          ))}
        </Reveal>
      </section>

      {/* Missão / Visão, banda creme-dark */}
      <section
        className="bg-bege px-6 border-y border-borda"
        style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
      >
        <div className="mx-auto max-w-[800px]">
          <Bloco label="Missão">
            Democratizar o acesso à inteligência jurídica condominial, garantindo a solidez
            dos direitos, a proteção dos investimentos e a dignidade da convivência entre
            pessoas e propriedades.
          </Bloco>
          <div className="h-10" />
          <Bloco label="Visão">
            Ser, até 2030, a principal referência em inteligência jurídica condominial no
            Brasil, reconhecida por síndicos, administradores e advogados como o padrão de
            confiança em decisões condominiais.
          </Bloco>
        </div>
      </section>

      {/* Valores, cards brancos sobre creme */}
      <section
        className="bg-cream px-6"
        style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
      >
        <div className="mx-auto max-w-[900px]">
          <Reveal>
            <SectionLabel tone="dark">Valores</SectionLabel>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {VALORES.map((v, i) => (
              <Reveal
                key={v.nome}
                delay={i * 60}
                className="border-l-4 border-dourado bg-papel px-5 py-4 rounded-r-md transition-colors duration-200 hover:bg-papel/80"
              >
                <div className="t-h4 text-verde">{v.nome}</div>
                <p className="mt-2 t-body-sm text-ardosia">{v.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* O símbolo, banda creme-dark */}
      <section
        className="bg-bege px-6 border-y border-borda"
        style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
      >
        <div className="mx-auto max-w-[1000px]">
          <Reveal className="flex flex-col items-center text-center">
            <SectionLabel tone="dark">O símbolo</SectionLabel>
            <h2 className="t-h2 mt-5 text-verde">Um aqueduto para o Direito.</h2>
            <ArcoAugusto width={52} color="hsl(33 40% 54%)" opacity={0.55} className="mt-6" />
          </Reveal>

          <Reveal delay={80} className="mt-14 grid gap-10 lg:grid-cols-[300px_1fr] items-center">
            <div className="mx-auto flex items-center justify-center rounded-2xl border border-borda bg-cream p-10">
              <AugustoLogo variant="icon-only" size={220} />
            </div>

            <div className="space-y-6">
              <p className="border-l-4 border-dourado pl-5 t-body text-grafite">
                O símbolo de Augusto.IJ é um aqueduto romano abstrato. Os três arcos
                representam a tríade fundamental prática do Direito: lei, doutrina e
                jurisprudência. A linha superior é o canal por onde a inteligência flui,
                sem início nem fim, em movimento contínuo. E o ponto dourado no centro é a
                centelha viva da inteligência, a alma de Augusto, que mora dentro da
                estrutura jurídica.
              </p>
              <p className="pl-5 t-body-sm text-ardosia">
                Engenharia civil romana, os aquedutos eram a obra-prima da infraestrutura
                imperial, levando recursos vitais a comunidades inteiras que antes não
                tinham.
              </p>
              <p className="pl-5 t-quote text-verde">
                Os romanos levaram água a cada cidade. Augusto leva o Direito a cada
                condomínio.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final, banda verde */}
      <section
        className="bg-verde-profundo px-6 text-center"
        style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
      >
        <Reveal className="mx-auto max-w-[720px]">
          <p className="t-h2 italic text-cream">Pergunte ao Augusto.</p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-dourado px-7 py-3.5 t-button text-[hsl(30_60%_9%)] transition-colors duration-200 hover:bg-[hsl(33_40%_47%)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-verde-profundo"
          >
            Começar agora
            <Icon icon="ph:arrow-right" width={18} />
          </Link>
        </Reveal>
      </section>

      <ManifestoFooter />
    </div>
  );
}

function Bloco({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <SectionLabel tone="dark">{label}</SectionLabel>
      <p className="mt-4 t-h3 text-verde">{children}</p>
    </Reveal>
  );
}