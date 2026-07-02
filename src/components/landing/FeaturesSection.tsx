import { SectionHeader } from "./SectionHeader";
import { AugustoLogo } from "@/components/brand/AugustoLogo";

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
    <section id="features" className="bg-augusto-cream border-t border-augusto-gold/15 py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="O que Augusto faz"
          title="Seis capacidades. Uma especialidade."
          subtitle="Direito Condominial brasileiro, nada mais. Faz uma coisa só e faz com excelência."
        />

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-lg bg-white border-t-2 border-augusto-gold/60 shadow-sm p-8 hover:shadow-md transition-shadow"
            >
              <AugustoLogo variant="icon-only" size={28} />
              <h3 className="mt-4 font-serif text-augusto-green text-[22px] leading-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-augusto-slate">{f.body}</p>
              <div className="mt-5 font-serif italic text-augusto-gold text-[13px] tracking-wide">
                {f.latim}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;