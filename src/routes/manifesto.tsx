import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { ManifestoFooter } from "@/components/landing/ManifestoFooter";

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

      <article className="mx-auto max-w-[800px] px-6 py-24">
        <div className="text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
            Manifesto
          </div>
          <h1 className="mt-6 font-serif italic text-augusto-green text-5xl md:text-7xl lg:text-[80px] leading-[1.1]">
            Dura lex, sed Augusto.
          </h1>
          <div className="mt-5 text-[13px] font-medium uppercase tracking-[0.24em] text-augusto-gold">
            A lei é dura — mas você tem Augusto.
          </div>
        </div>

        <div className="mt-20 mx-auto max-w-[640px] space-y-8 text-center">
          {MANIFESTO.map((linha, i) => (
            <p key={i} className="font-serif text-augusto-slate-dark text-[20px] leading-[1.7]">
              {linha}
            </p>
          ))}
        </div>

        <div className="my-20 mx-auto h-px w-[80px] bg-augusto-gold" aria-hidden="true" />

        <Bloco label="Missão">
          Democratizar o acesso à inteligência jurídica condominial, garantindo a solidez
          dos direitos, a proteção dos investimentos e a dignidade da convivência entre
          pessoas e propriedades.
        </Bloco>

        <Bloco label="Visão">
          Ser, até 2030, a principal referência em inteligência jurídica condominial no
          Brasil — reconhecida por síndicos, administradores e advogados como o padrão de
          confiança em decisões condominiais.
        </Bloco>

        <div className="mt-16">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
            Valores
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {VALORES.map((v) => (
              <div
                key={v.nome}
                className="border-l-4 border-augusto-gold bg-white/70 px-5 py-4 rounded-r-md"
              >
                <div className="font-serif text-augusto-green text-[20px] leading-tight">
                  {v.nome}
                </div>
                <p className="mt-1 text-[15px] text-augusto-slate leading-[1.55]">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 text-center">
          <p className="font-serif text-augusto-green text-2xl">Pergunte ao Augusto.</p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-augusto-green px-5 py-3 text-sm font-medium text-augusto-cream hover:bg-augusto-green-dark transition-colors"
          >
            Começar agora →
          </Link>
        </div>
      </article>

      <ManifestoFooter />
    </div>
  );
}

function Bloco({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-12">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
        {label}
      </div>
      <p className="mt-3 font-serif text-augusto-green text-[26px] leading-snug">{children}</p>
    </div>
  );
}