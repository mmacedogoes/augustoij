import { SectionHeader } from "./SectionHeader";

export function AnatomySection() {
  return (
    <section id="anatomia" className="bg-augusto-cream border-t border-augusto-gold/15 py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          eyebrow="Como Augusto trabalha"
          title="Anatomia de uma resposta."
          subtitle="Cada resposta de Augusto segue um método jurídico estruturado — claro, fundamentado e citável."
        />

        <div className="mt-16 relative">
          <div className="mx-auto max-w-[720px] rounded-lg bg-white border border-augusto-gold/30 shadow-lg p-8 md:p-12">
            {/* Pergunta */}
            <div className="rounded-md bg-augusto-cream/70 px-4 py-3 text-[15px] text-augusto-slate">
              <span className="font-semibold text-augusto-slate-dark">Pergunta:</span>{" "}
              O fundo de reserva pode ser usado para pintura externa do prédio?
            </div>

            {/* Resposta direta */}
            <div className="mt-6 rounded-r-md bg-augusto-gold/10 border-l-4 border-augusto-gold px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-gold mb-1">
                Resposta direta
              </div>
              <p className="text-augusto-slate-dark text-[15px]">
                <strong>Não, como regra.</strong> A pintura externa é despesa ordinária de
                manutenção predial. O fundo de reserva destina-se a despesas extraordinárias.
              </p>
            </div>

            {/* Fundamentação */}
            <div className="mt-6">
              <h3 className="font-serif text-augusto-green text-[20px]">Fundamentação</h3>
              <p className="mt-2 text-[15px] text-augusto-slate leading-[1.65]">
                Conforme a Lei 4.591/64, art. 22, §1º, &ldquo;g&rdquo;, o fundo de reserva
                visa cobrir gastos extraordinários do condomínio. Pintura periódica é despesa
                ordinária — prevista no orçamento anual.
              </p>
            </div>

            {/* Jurisprudência */}
            <div className="mt-6">
              <h3 className="font-serif text-augusto-green text-[20px]">Jurisprudência</h3>
              <div className="mt-2 rounded-r-md bg-augusto-gold/5 border-l-4 border-augusto-gold px-3 py-2.5 text-[14px] text-augusto-slate-dark">
                STJ, REsp 1.704.498/SP, Rel. Min. Nancy Andrighi, Terceira Turma, julgado em
                17/04/2018.
              </div>
            </div>

            {/* Na prática */}
            <div className="mt-6">
              <h3 className="font-serif text-augusto-green text-[20px]">Na prática</h3>
              <p className="mt-2 text-[15px] text-augusto-slate leading-[1.65]">
                Inclua a pintura no orçamento ordinário do próximo exercício. Se for
                restauração urgente decorrente de evento extraordinário, aí sim cabe o fundo
                de reserva.
              </p>
            </div>

            {/* Atenção a */}
            <div className="mt-6">
              <h3 className="font-serif text-augusto-green text-[20px]">Atenção a</h3>
              <p className="mt-2 text-[15px] text-augusto-slate leading-[1.65]">
                A assembleia pode autorizar uso excepcional do fundo, desde que ratificado
                pelo quórum exigido na convenção.
              </p>
            </div>
          </div>

          <p className="mt-12 text-center font-serif italic text-augusto-slate text-[15px]">
            Toda resposta é estruturada assim — para que você possa confiar, verificar e agir.
          </p>
        </div>
      </div>
    </section>
  );
}

export default AnatomySection;