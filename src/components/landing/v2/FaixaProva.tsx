import { Reveal } from "@/components/landing/Reveal";

/**
 * Faixa fina de prova social logo abaixo do Hero.
 */
export function FaixaProva() {
  return (
    <section
      id="faixa-prova"
      aria-label="Depoimento"
      className="w-full border-b border-borda bg-cream py-6 md:py-5"
    >
      <Reveal className="mx-auto flex w-full max-w-[var(--container-container)] flex-col items-center gap-3 px-6 text-center md:flex-row md:justify-center md:gap-6 md:text-left">
        <blockquote className="t-quote text-verde">
          &ldquo;Ela não encontrou a cláusula de barulho rapidamente. O Augusto.IJ encontrou na hora.&rdquo;
        </blockquote>
        <cite className="t-label not-italic text-ardosia">
          Lucilene Melo · Síndica · Campina Grande, PB
        </cite>
      </Reveal>
    </section>
  );
}

export default FaixaProva;