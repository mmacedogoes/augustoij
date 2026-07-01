import { Link } from "@tanstack/react-router";
import { AugustoLogo } from "@/components/brand/AugustoLogo";

export function FounderStorySection() {
  return (
    <section className="bg-augusto-cream border-t border-augusto-gold/15 py-24 px-6">
      <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-5">
        {/* Coluna esquerda (2/5) */}
        <div className="lg:col-span-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
            A história fundadora
          </div>
          <h2 className="mt-5 font-serif text-augusto-green text-4xl md:text-[44px] leading-[1.15]">
            Augusto não nasceu em uma startup.
            <br />
            Nasceu em um escritório de advocacia.
          </h2>
          <span
            className="mt-8 block h-px w-[60px] bg-augusto-gold"
            aria-hidden="true"
          />
          <div className="mt-6 font-serif italic text-augusto-slate text-sm">
            Augusto Macêdo Góes — Fundador
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
            className="mt-10 inline-flex items-center gap-2 text-[15px] font-medium text-augusto-green hover:underline"
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