import { SectionHeader } from "./SectionHeader";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { Reveal } from "./Reveal";

const FEATURES = [
  {
    title: "Consulta Jurídica Especializada",
    body: "Respostas fundamentadas em lei, doutrina e jurisprudência. Cita sempre as fontes.",
    latim: "Iuris prudentia.",
  },
  {
    title: "Análise Contratual",
    body: "Compara contratos com modelos validados. Aponta riscos, sugere redações, atualiza legislações.",
    latim: "Pacta sunt servanda.",
  },
  {
    title: "Redação de Peças",
    body: "Notificações, atas, editais, regimentos. Modelos prontos com fundamentação correta.",
    latim: "Verba volant, scripta manent.",
  },
  {
    title: "Apoio em Assembleias",
    body: "Revisão de atas, orientação sobre quórum, procedimentos de votação e deliberações.",
    latim: "Audi alteram partem.",
  },
  {
    title: "Base de Conhecimento Privada",
    body: "Treine Augusto com a convenção, regimento e contratos do seu condomínio. Respostas contextualizadas.",
    latim: "Suum cuique.",
  },
  {
    title: "Sigilo Absoluto",
    body: "Dados de condomínios, partes e documentos jamais são divulgados. Apenas fundamentação jurídica.",
    latim: "Sub rosa.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="landing-section bg-landing-surface border-t border-landing-rule">
      <div className="landing-container">
        <SectionHeader
          eyebrow="O que Augusto faz"
          title="Seis capacidades. Uma especialidade."
          subtitle="Direito Condominial brasileiro, nada mais. Faz uma coisa só e faz com excelência."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const numeral = ["I", "II", "III", "IV", "V", "VI"][i] ?? String(i + 1);
            return (
              <Reveal
                key={f.title}
                direction="up"
                delay={(i % 3) * 0.08}
                className="landing-panel landing-card-hover group relative overflow-hidden rounded-2xl border-t-2 border-t-augusto-gold/60 p-8"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-5 top-5 font-serif italic text-augusto-gold/25 text-[28px] leading-none tracking-tight transition-colors duration-200 group-hover:text-augusto-gold/55"
                >
                  {numeral}
                </span>
                <AugustoLogo variant="icon-only" size={28} />
                <h3 className="mt-4 font-serif text-augusto-green text-[22px] leading-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-augusto-slate">{f.body}</p>
                <div className="mt-5 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="block h-px w-6 bg-augusto-gold/60 transition-all duration-200 group-hover:w-10 group-hover:bg-augusto-gold"
                  />
                  <span className="font-serif italic text-augusto-gold text-[13px] tracking-wide">
                    {f.latim}
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;