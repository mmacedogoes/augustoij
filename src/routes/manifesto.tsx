import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { ManifestoFooter } from "@/components/landing/ManifestoFooter";
import { AugustoLogo } from "@/components/brand/AugustoLogo";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto — Augusto.IJ" },
      { name: "description", content: "Manifesto institucional do Augusto.IJ. Missão, visão e valores." },
    ],
  }),
  component: ManifestoPage,
});

const MANIFESTO = [
  "Acreditamos que toda decisão condominial merece um bom conselho jurídico.",
  "Acreditamos que a lei não pode ser privilégio de quem tem orçamento alto.",
  "Acreditamos que síndicos não deveriam decidir sozinhos, que administradores não deveriam escalar no improviso, que advogados não deveriam gastar suas melhores horas respondendo às mesmas perguntas.",
  "Acreditamos na solidez dos direitos. Na proteção dos investimentos. Na dignidade da convivência. Na boa relação entre pessoas e propriedades.",
  "Por isso construímos Augusto.IJ — para que, em cada condomínio do Brasil, exista alguém pronto a responder, fundamentar e orientar. Vinte e quatro horas por dia. Sete dias por semana. Dois mil anos de Direito ao alcance de uma pergunta.",
];

const VALORES = [
  { nome: "Solidez Técnica", desc: "Toda resposta ancorada em lei, doutrina e jurisprudência." },
  { nome: "Atualização Permanente", desc: "A legislação muda. Augusto acompanha, sem exceção." },
  { nome: "Dignidade da Convivência", desc: "Respeito às pessoas antes das regras — sempre." },
  { nome: "Sigilo Absoluto", desc: "Dados de condomínios e partes jamais são divulgados." },
  { nome: "Acessibilidade", desc: "Inteligência jurídica ao alcance de qualquer profissional." },
  { nome: "Verdade Antes da Conveniência", desc: "Augusto responde o certo, não o que soa melhor." },
  { nome: "Legado", desc: "Construímos para durar dois mil anos — como o Direito." },
];

function ManifestoPage() {
  return (
    <div className="min-h-screen bg-augusto-cream text-augusto-slate-dark">
      <Nav />

      {/* Hero — banda verde */}
      <section className="bg-augusto-green px-6 py-24 md:py-28 text-center">
        <div className="mx-auto max-w-[800px]">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
            Manifesto
          </div>
          <h1 className="mt-6 font-serif italic text-augusto-cream text-5xl md:text-7xl lg:text-[80px] leading-[1.1]">
            Dura lex, sed Augusto.
          </h1>
          <div className="mt-5 text-[13px] font-medium uppercase tracking-[0.24em] text-augusto-gold">
            A lei é dura — mas você tem Augusto.
          </div>
        </div>
      </section>

      {/* Credo — card branco sobre creme */}
      <section className="bg-augusto-cream px-6 py-24">
        <div className="mx-auto max-w-[760px] rounded-2xl bg-white border border-augusto-gold/30 shadow-[0_30px_80px_-30px_rgba(0,81,43,0.25)] p-8 md:p-14 space-y-6">
          {MANIFESTO.map((linha, i) => (
            <p
              key={i}
              className={
                i % 2 === 0
                  ? "border-l-4 border-augusto-gold pl-5 font-serif text-augusto-slate-dark text-[20px] leading-[1.7]"
                  : "font-serif text-augusto-slate-dark text-[20px] leading-[1.7] pl-5"
              }
            >
              {linha}
            </p>
          ))}
        </div>
      </section>

      {/* Missão / Visão — banda creme-dark */}
      <section className="bg-augusto-cream-dark px-6 py-24 border-y border-augusto-gold/20">
        <div className="mx-auto max-w-[800px]">
          <Bloco label="Missão">
            Democratizar o acesso à inteligência jurídica condominial, garantindo a solidez
            dos direitos, a proteção dos investimentos e a dignidade da convivência entre
            pessoas e propriedades.
          </Bloco>
          <div className="h-10" />
          <Bloco label="Visão">
            Ser, até 2030, a principal referência em inteligência jurídica condominial no
            Brasil — reconhecida por síndicos, administradores e advogados como o padrão de
            confiança em decisões condominiais.
          </Bloco>
        </div>
      </section>

      {/* Valores — cards brancos sobre creme */}
      <section className="bg-augusto-cream px-6 py-24">
        <div className="mx-auto max-w-[900px]">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
            Valores
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {VALORES.map((v) => (
              <div
                key={v.nome}
                className="border-l-4 border-augusto-gold bg-white px-5 py-4 rounded-r-md shadow-[0_10px_30px_-18px_rgba(0,81,43,0.25)]"
              >
                <div className="font-serif text-augusto-green text-[20px] leading-tight">
                  {v.nome}
                </div>
                <p className="mt-1 text-[15px] text-augusto-slate leading-[1.55]">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O símbolo — banda creme-dark */}
      <section className="bg-augusto-cream-dark px-6 py-24 border-y border-augusto-gold/20">
        <div className="mx-auto max-w-[1000px]">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold text-center">
            O símbolo
          </div>
          <h2 className="mt-4 font-serif text-augusto-green text-4xl md:text-5xl leading-tight text-center">
            Um aqueduto para o Direito.
          </h2>

          <div className="mt-14 grid gap-10 lg:grid-cols-[300px_1fr] items-center">
            <div className="mx-auto flex items-center justify-center rounded-2xl border border-augusto-gold/40 bg-augusto-cream p-10 shadow-[0_20px_60px_-30px_rgba(0,81,43,0.25)]">
              <AugustoLogo variant="icon-only" size={220} />
            </div>

            <div className="space-y-6">
              <p className="border-l-4 border-augusto-gold pl-5 font-serif text-augusto-slate-dark text-[18px] leading-[1.75]">
                O símbolo de Augusto.IJ é um aqueduto romano abstrato. Os três arcos
                representam a tríade fundamental prática do Direito: lei, doutrina e
                jurisprudência. A linha superior é o canal por onde a inteligência flui,
                sem início nem fim, em movimento contínuo. E o ponto dourado no centro é a
                centelha viva da inteligência, a alma de Augusto, que mora dentro da
                estrutura jurídica.
              </p>
              <p className="pl-5 text-[16px] text-augusto-slate leading-[1.7]">
                Engenharia civil romana — os aquedutos eram a obra-prima da infraestrutura
                imperial, levando recursos vitais a comunidades inteiras que antes não
                tinham.
              </p>
              <p className="pl-5 font-serif italic text-augusto-green text-[22px] leading-[1.5]">
                Os romanos levaram água a cada cidade. Augusto leva o Direito a cada
                condomínio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final — banda verde */}
      <section className="bg-augusto-green px-6 py-24 text-center">
        <p className="font-serif italic text-augusto-cream text-3xl md:text-4xl">
          Pergunte ao Augusto.
        </p>
        <Link
          to="/signup"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-augusto-gold px-6 py-3 text-sm font-semibold text-augusto-green hover:bg-augusto-gold-light active:scale-[0.98] transition-all duration-200"
        >
          Começar agora →
        </Link>
      </section>

      <ManifestoFooter />
    </div>
  );
}

function Bloco({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
        {label}
      </div>
      <p className="mt-3 font-serif text-augusto-green text-[26px] md:text-[30px] leading-snug">
        {children}
      </p>
    </div>
  );
}