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

const PART_SIDE: Record<PartId, "left" | "right"> = {
  pergunta: "left",
  resposta: "right",
  fundamento: "left",
  jurisprudencia: "right",
  pratica: "left",
  atencao: "right",
};

export function AnatomySection() {
  return (
    <section
      id="anatomia"
      className="landing-cream-bg landing-section border-t border-landing-rule"
    >
      <div className="landing-container">
        <SectionHeader
          eyebrow="Como Augusto trabalha"
          title="Uma resposta jurídica precisa fazer mais do que parecer correta."
          subtitle="No condomínio, uma orientação vaga não sustenta uma decisão. Por isso, Augusto segue um método estruturado e cruza duas camadas de conhecimento: um repositório de legislação, jurisprudência e doutrina alimentado e curado por profissionais jurídicos da área, e os documentos privados do seu condomínio — convenção, regimento interno e atas. Você pergunta como perguntaria a um especialista. Augusto responde considerando a lei e as regras específicas da sua gestão."
        />

        <div className="landing-panel mx-auto mt-20 w-full max-w-[1240px] space-y-8 rounded-[1.75rem] p-6 md:p-10 lg:p-12">
          <PartRow id="pergunta">
            <div className="rounded-md bg-augusto-cream/70 px-5 py-4 text-[16px] text-augusto-slate">
              <span className="font-semibold text-augusto-slate-dark">Pergunta:</span>{" "}
              O fundo de reserva pode ser usado para pintura externa do prédio?
            </div>
          </PartRow>

          <PartRow id="resposta">
            <div className="rounded-r-md bg-augusto-gold/10 border-l-4 border-augusto-gold px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-gold mb-1">
                Resposta direta
              </div>
              <p className="text-augusto-slate-dark text-[16px] leading-[1.65]">
                <strong>Não, como regra.</strong> A pintura externa é despesa ordinária de
                manutenção predial. O fundo de reserva destina-se a despesas extraordinárias.
              </p>
            </div>
          </PartRow>

          <PartRow id="fundamento">
            <div>
              <h3 className="font-serif text-augusto-green text-[22px]">Fundamentação</h3>
              <p className="mt-2 text-[16px] text-augusto-slate leading-[1.7]">
                Conforme a Lei 4.591/64, art. 22, §1º, &ldquo;g&rdquo;, o fundo de reserva
                visa cobrir gastos extraordinários do condomínio. Pintura periódica é despesa
                ordinária, prevista no orçamento anual.
              </p>
            </div>
          </PartRow>

          <PartRow id="jurisprudencia">
            <div>
              <h3 className="font-serif text-augusto-green text-[22px]">Jurisprudência</h3>
              <div className="mt-2 rounded-r-md bg-augusto-gold/5 border-l-4 border-augusto-gold px-4 py-3 text-[16px] text-augusto-slate-dark leading-[1.65]">
                STJ, REsp 1.704.498/SP, Rel. Min. Nancy Andrighi, Terceira Turma, julgado em
                17/04/2018.
              </div>
            </div>
          </PartRow>

          <PartRow id="pratica">
            <div>
              <h3 className="font-serif text-augusto-green text-[22px]">Na prática</h3>
              <p className="mt-2 text-[16px] text-augusto-slate leading-[1.7]">
                Inclua a pintura no orçamento ordinário do próximo exercício. Se for
                restauração urgente decorrente de evento extraordinário, aí sim cabe o fundo
                de reserva.
              </p>
            </div>
          </PartRow>

          <PartRow id="atencao">
            <div>
              <h3 className="font-serif text-augusto-green text-[22px]">Atenção a</h3>
              <p className="mt-2 text-[16px] text-augusto-slate leading-[1.7]">
                A assembleia pode autorizar uso excepcional do fundo, desde que ratificado
                pelo quórum exigido na convenção. Quando os documentos do seu condomínio
                estão na base privada, Augusto verifica se a convenção prevê regra própria
                para o caso.
              </p>
            </div>
          </PartRow>
        </div>

        <p className="mt-16 text-center font-serif italic text-augusto-slate text-[15px]">
          Toda resposta é estruturada assim, para que você possa confiar, verificar e agir.
        </p>
      </div>
    </section>
  );
}

function PartRow({ id, children }: { id: PartId; children: React.ReactNode }) {
  const side = PART_SIDE[id];
  const label = CALLOUTS[id];
  return (
    <div
      id={`anatomia-${id}`}
      className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)_240px] lg:gap-8 lg:items-center"
    >
      {/* Mobile inline label */}
      <div className="lg:hidden mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-augusto-gold">
        {label}
      </div>

      {/* Left callout slot */}
      <div className="hidden lg:flex justify-end">
        {side === "left" ? <Callout label={label} side="left" /> : null}
      </div>

      {/* Content */}
      <div>{children}</div>

      {/* Right callout slot */}
      <div className="hidden lg:flex justify-start">
        {side === "right" ? <Callout label={label} side="right" /> : null}
      </div>
    </div>
  );
}

function Callout({ label, side }: { label: string; side: "left" | "right" }) {
  return (
    <div className="relative flex items-center gap-3 text-[15px] font-serif italic text-augusto-gold max-w-[240px]">
      {side === "left" ? (
        <>
          <span className="flex-1 leading-snug text-right">{label}</span>
          <Arrow direction="right" />
        </>
      ) : (
        <>
          <Arrow direction="left" />
          <span className="flex-1 leading-snug text-left">{label}</span>
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