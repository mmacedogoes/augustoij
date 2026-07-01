import { Link } from "@tanstack/react-router";
import { AugustoLogo } from "@/components/brand/AugustoLogo";

export function FounderStorySection() {
  return (
    <section className="relative bg-augusto-cream border-t border-augusto-gold/20 py-24 px-6 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-augusto-gold/60 to-transparent"
      />
      <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-5 items-start">
        {/* Coluna esquerda (2/5) — retrato tipográfico */}
        <div className="lg:col-span-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
            A história fundadora
          </div>
          <h2 className="mt-5 font-serif text-augusto-green text-4xl md:text-[44px] leading-[1.15]">
            Augusto não nasceu em uma startup.
            <br />
            Nasceu em um escritório de advocacia.
          </h2>

          <div className="mt-10 rounded-2xl bg-white border-2 border-augusto-gold/40 shadow-[0_20px_60px_-25px_rgba(0,81,43,0.35)] p-8 flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-augusto-green flex items-center justify-center font-serif text-augusto-gold text-[42px] leading-none">
              MG
            </div>
            <div className="mt-5 font-serif text-augusto-green text-[22px] leading-tight">
              Matheus Macêdo Góes
            </div>
            <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
              Fundador — Augusto.IJ
            </div>
            <span
              className="mt-4 block h-px w-[48px] bg-augusto-gold"
              aria-hidden="true"
            />
            <p className="mt-4 font-serif italic text-augusto-slate text-sm">
              &ldquo;Faltava alguém entre o Direito e o cotidiano do condomínio.&rdquo;
            </p>
          </div>
        </div>

        {/* Coluna direita (3/5) */}
        <div className="lg:col-span-3 max-w-[560px]">
          <p className="text-[17px] leading-[1.75] text-augusto-slate-dark">
            <span className="float-left font-serif text-augusto-gold text-[72px] leading-none pr-3 pt-1">
              T
            </span>
            oda grande marca nasce de uma inquietação. Por anos, recebi ligações de síndicos,
            administradoras e clientes sobre dúvidas aparentemente simples — mas que a
            interpretação técnica jurídica de documentos condominiais não permitia a um leigo
            responder com segurança.
          </p>
          <p className="mt-6 text-[17px] leading-[1.75] text-augusto-slate-dark">
            Não basta consultar a convenção e o regimento. Há determinações legais,
            infralegais, jurisprudência, doutrina e toda a técnica hermenêutica necessária
            para transformar isso em uma resposta utilizável. E cada condomínio tem sua
            própria realidade documental — impossível memorizar tudo, ter ao alcance de um
            piscar de olhos.
          </p>
          <p className="mt-6 text-[17px] leading-[1.75] text-augusto-slate-dark">
            Faltava alguém entre o Direito e o cotidiano do condomínio. Faltava uma figura.
          </p>
          <p className="mt-8 font-serif italic text-augusto-green text-[28px] leading-tight">
            Faltava o Augusto.
          </p>

          <Link
            to="/historia"
            className="mt-10 inline-flex items-center gap-2 text-[15px] font-medium text-augusto-green hover:text-augusto-green-dark hover:underline underline-offset-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold rounded-sm"
          >
            <AugustoLogo variant="icon-only" size={20} />
            Continuar lendo a história completa →
          </Link>
        </div>
      </div>
    </section>
  );
}

export default FounderStorySection;