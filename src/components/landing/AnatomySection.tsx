import { SectionHeader } from "./SectionHeader";

type PartId = "pergunta" | "resposta" | "fundamento" | "jurisprudencia" | "pratica" | "atencao";

const CALLOUTS: Record<PartId, string> = {
  pergunta: "Pergunta do usuário",
  resposta: "Resposta direta e conclusiva",
  fundamento: "Fundamentação legal citável",
  jurisprudencia: "Precedente do STJ",
  pratica: "Orientação prática",
  atencao: "Ressalvas e exceções",
};

export function AnatomySection() {
  return (
    <section
      id="anatomia"
      className="bg-augusto-cream-dark border-t border-augusto-gold/20 py-24 px-6"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Como Augusto trabalha"
          title="Anatomia de uma resposta."
          subtitle="Cada resposta de Augusto segue um método jurídico estruturado — claro, fundamentado e citável."
        />

        <div className="mt-20 relative lg:grid lg:grid-cols-[220px_minmax(0,720px)_220px] lg:gap-10 lg:items-start">
          {/* Callouts esquerdos — desktop */}
          <div className="hidden lg:flex flex-col gap-16 pt-6 text-right">
            <Callout label={CALLOUTS.pergunta} side="left" />
            <Callout label={CALLOUTS.fundamento} side="left" />
            <Callout label={CALLOUTS.pratica} side="left" />
          </div>

          {/* Card central */}
          <div className="mx-auto w-full max-w-[720px] rounded-2xl bg-white border border-augusto-gold/30 shadow-[0_30px_80px_-30px_rgba(0,81,43,0.35)] p-8 md:p-12 space-y-6">
            {/* Pergunta */}
            <Part id="pergunta">
              <div className="rounded-md bg-augusto-cream/70 px-4 py-3 text-[15px] text-augusto-slate">
                <span className="font-semibold text-augusto-slate-dark">Pergunta:</span>{" "}
                O fundo de reserva pode ser usado para pintura externa do prédio?
              </div>
            </Part>

            {/* Resposta direta */}
            <Part id="resposta">
              <div className="rounded-r-md bg-augusto-gold/10 border-l-4 border-augusto-gold px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-gold mb-1">
                  Resposta direta
                </div>
                <p className="text-augusto-slate-dark text-[15px]">
                  <strong>Não, como regra.</strong> A pintura externa é despesa ordinária de
                  manutenção predial. O fundo de reserva destina-se a despesas extraordinárias.
                </p>
              </div>
            </Part>

            {/* Fundamentação */}
            <Part id="fundamento">
              <h3 className="font-serif text-augusto-green text-[20px]">Fundamentação</h3>
              <p className="mt-2 text-[15px] text-augusto-slate leading-[1.65]">
                Conforme a Lei 4.591/64, art. 22, §1º, &ldquo;g&rdquo;, o fundo de reserva
                visa cobrir gastos extraordinários do condomínio. Pintura periódica é despesa
                ordinária — prevista no orçamento anual.
              </p>
            </Part>

            {/* Jurisprudência */}
            <Part id="jurisprudencia">
              <h3 className="font-serif text-augusto-green text-[20px]">Jurisprudência</h3>
              <div className="mt-2 rounded-r-md bg-augusto-gold/5 border-l-4 border-augusto-gold px-3 py-2.5 text-[14px] text-augusto-slate-dark">
                STJ, REsp 1.704.498/SP, Rel. Min. Nancy Andrighi, Terceira Turma, julgado em
                17/04/2018.
              </div>
            </Part>

            {/* Na prática */}
            <Part id="pratica">
              <h3 className="font-serif text-augusto-green text-[20px]">Na prática</h3>
              <p className="mt-2 text-[15px] text-augusto-slate leading-[1.65]">
                Inclua a pintura no orçamento ordinário do próximo exercício. Se for
                restauração urgente decorrente de evento extraordinário, aí sim cabe o fundo
                de reserva.
              </p>
            </Part>

            {/* Atenção a */}
            <Part id="atencao">
              <h3 className="font-serif text-augusto-green text-[20px]">Atenção a</h3>
              <p className="mt-2 text-[15px] text-augusto-slate leading-[1.65]">
                A assembleia pode autorizar uso excepcional do fundo, desde que ratificado
                pelo quórum exigido na convenção.
              </p>
            </Part>
          </div>

          {/* Callouts direitos — desktop */}
          <div className="hidden lg:flex flex-col gap-16 pt-32 text-left">
            <Callout label={CALLOUTS.resposta} side="right" />
            <Callout label={CALLOUTS.jurisprudencia} side="right" />
            <Callout label={CALLOUTS.atencao} side="right" />
          </div>
        </div>

        <p className="mt-16 text-center font-serif italic text-augusto-slate text-[15px]">
          Toda resposta é estruturada assim — para que você possa confiar, verificar e agir.
        </p>
      </div>
    </section>
  );
}

function Part({ id, children }: { id: PartId; children: React.ReactNode }) {
  return (
    <div id={`anatomia-${id}`} className="relative">
      {/* Mobile inline label */}
      <div className="lg:hidden mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-augusto-gold">
        {CALLOUTS[id]}
      </div>
      {children}
    </div>
  );
}

function Callout({ label, side }: { label: string; side: "left" | "right" }) {
  return (
    <div className="relative flex items-center gap-3 text-[13px] font-serif italic text-augusto-gold">
      {side === "left" ? (
        <>
          <span className="flex-1 leading-snug">{label}</span>
          <Arrow direction="right" />
        </>
      ) : (
        <>
          <Arrow direction="left" />
          <span className="flex-1 leading-snug">{label}</span>
        </>
      )}
    </div>
  );
}

function Arrow({ direction }: { direction: "left" | "right" }) {
  // Slim hand-drawn-ish curved arrow via SVG
  const flip = direction === "left" ? "scale(-1 1) translate(-72 0)" : undefined;
  return (
    <svg
      width="72"
      height="18"
      viewBox="0 0 72 18"
      fill="none"
      className="shrink-0 text-augusto-gold"
      aria-hidden="true"
    >
      <g transform={flip}>
        <path
          d="M2 9 C 20 2, 40 16, 66 9"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M60 4 L 68 9 L 60 14"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

export default AnatomySection;