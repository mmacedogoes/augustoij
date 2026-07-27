/**
 * Faixa fina de prova social logo abaixo do Hero.
 * Sem título, sem cartão, sem CTA, sem ícone, sem animação.
 */
export function FaixaProva() {
  return (
    <section
      id="faixa-prova"
      aria-label="Depoimento"
      className="w-full border-b border-borda bg-cream py-[22px] md:py-[18px]"
    >
      <div className="mx-auto flex w-full max-w-[var(--container-container)] flex-col items-center gap-2 px-6 text-center md:flex-row md:justify-center md:gap-4 md:text-left">
        <blockquote className="font-heading text-[17px] italic leading-[1.35] text-verde">
          &ldquo;Ela não encontrou a cláusula de barulho rapidamente. O Augusto.IJ encontrou na hora.&rdquo;
        </blockquote>
        <cite className="font-body text-[12px] not-italic leading-[1.5] text-ardosia">
          Lucilene Melo · Síndica profissional e gerente condominial · Campina Grande, PB
        </cite>
      </div>
    </section>
  );
}

export default FaixaProva;