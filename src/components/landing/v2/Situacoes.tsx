import { Icon } from "@iconify/react";
import { Link } from "@tanstack/react-router";
import { SectionLabel } from "@/components/landing/SectionLabel";

type Situacao = { titulo: string; maxima: string; entrega: string };

const SITUACOES: Situacao[] = [
  {
    titulo: "Assembleia sensível",
    maxima: "Audi alteram partem.",
    entrega:
      "Quórum, procedimento, minuta de edital e de ata, e o que assembleias anteriores já deliberaram",
  },
  {
    titulo: "Multa ou conflito com morador",
    maxima: "Verba volant, scripta manent.",
    entrega:
      "Orientação fundamentada e minuta de notificação com base na convenção e no regimento",
  },
  {
    titulo: "Contrato para assinar",
    maxima: "Pacta sunt servanda.",
    entrega:
      "Análise cláusula a cláusula, com pontos positivos, de atenção e negativos",
  },
  {
    titulo: "Tema que a convenção não previu",
    maxima: "Iuris prudentia.",
    entrega:
      "Locação por temporada, carro elétrico, pet, obra em unidade: jurisprudência recente cruzada com as suas regras",
  },
  {
    titulo: "Dúvida sobre regra do condomínio",
    maxima: "Suum cuique.",
    entrega:
      "Resposta cruzando a lei com a convenção, o regimento e as atas do próprio condomínio",
  },
  {
    titulo: "Documento sensível na base",
    maxima: "Sub rosa.",
    entrega:
      "Dados de condomínios, partes e documentos jamais são divulgados. Apenas fundamentação jurídica",
  },
];

const SINTESE = [
  "Mais clareza para decidir antes de responder, assinar ou convocar assembleia",
  "Menos tempo procurando referências genéricas em fontes dispersas",
  "Mais consistência em notificações, atas, editais e orientações",
  "Respostas que consideram a legislação, a jurisprudência, a doutrina e os documentos do próprio condomínio, inclusive o que já foi decidido em assembleia",
];

function ImagePlaceholder({
  filename,
  aspect,
  rotate,
  className,
}: {
  filename: string;
  aspect: string;
  rotate: number;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-borda bg-bege ${className ?? ""}`}
      style={{ aspectRatio: aspect, transform: `rotate(${rotate}deg)` }}
    >
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <span className="font-body text-[12px] text-ardosia opacity-70">{filename}</span>
      </div>
    </div>
  );
}

export function Situacoes() {
  return (
    <section id="situacoes" className="relative w-full bg-off px-6 py-[var(--spacing-section-mobile)] md:py-[var(--spacing-section)]">
      <div className="mx-auto w-full max-w-[var(--container-container)]">
        {/* Cabeçalho */}
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <SectionLabel tone="dark">O AUGUSTO.IJ NA PRÁTICA</SectionLabel>
          <h2
            className="mt-4 font-heading font-medium text-verde"
            style={{ fontSize: "clamp(26px, 2.4vw, 38px)", lineHeight: 1.15 }}
          >
            Quando a dúvida exige resposta, improviso não é uma opção.
          </h2>
          <p className="mt-5 font-body text-[15px] leading-relaxed text-ardosia" style={{ maxWidth: "52ch" }}>
            Situações que chegam todos os dias à mesa de síndicos, administradoras e advogados, e o que o Augusto.IJ entrega em cada uma.
          </p>
        </div>

        {/* Corpo: 60/40 */}
        <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-[60%_40%] md:gap-10">
          {/* Tabela desktop */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_1fr] gap-6 border-b border-borda pb-3 font-body text-[11px] font-medium uppercase text-ardosia" style={{ letterSpacing: "0.18em" }}>
              <div>Situação</div>
              <div>O que o Augusto.IJ entrega</div>
            </div>
            <div className="flex flex-col">
              {SITUACOES.map((s) => (
                <div key={s.titulo} className="grid grid-cols-[1fr_1fr] gap-6 border-b border-borda py-5">
                  <div>
                    <h3 className="font-heading text-[17px] font-medium text-verde">{s.titulo}</h3>
                    <p className="mt-1 font-heading text-[12px] italic text-ardosia">{s.maxima}</p>
                  </div>
                  <p className="font-body text-[13.5px] leading-relaxed text-grafite">{s.entrega}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela mobile: cartões */}
          <div className="flex flex-col gap-3 md:hidden">
            {SITUACOES.map((s) => (
              <div key={s.titulo} className="rounded-md border border-borda bg-papel p-4">
                <h3 className="font-heading text-[17px] font-medium text-verde">{s.titulo}</h3>
                <p className="mt-1 font-heading text-[12px] italic text-ardosia">{s.maxima}</p>
                <p className="mt-3 font-body text-[13.5px] leading-relaxed text-grafite">{s.entrega}</p>
              </div>
            ))}
          </div>

          {/* Coluna de imagens */}
          <div className="flex flex-col gap-4 md:gap-0">
            <ImagePlaceholder
              filename="produto-screenshot-analise-semaforo.png"
              aspect="4/3"
              rotate={0}
              className="md:!rotate-[1deg]"
            />
            <ImagePlaceholder
              filename="documento-notificacao-timbrada.png"
              aspect="4/5"
              rotate={0}
              className="md:!-rotate-[1.5deg] md:-mt-6 md:ml-8"
            />
          </div>
        </div>

        {/* Em síntese */}
        <div className="mt-12 rounded-md border border-borda bg-papel p-6 md:mt-16 md:p-8">
          <div className="mb-4 font-body text-[11px] font-medium uppercase text-verde" style={{ letterSpacing: "0.18em" }}>
            Em síntese
          </div>
          <ul className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-4">
            {SINTESE.map((item) => (
              <li key={item} className="flex gap-3 font-body text-[13.5px] leading-relaxed text-grafite">
                <span className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-dourado" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end">
            <Link
              to="/cadastro"
              className="group inline-flex items-center gap-2 font-body text-[11px] font-medium uppercase text-verde transition-colors duration-200 hover:text-verde-profundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-off"
              style={{ letterSpacing: "0.2em" }}
            >
              Começar 7 dias grátis
              <Icon icon="ph:arrow-right" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Situacoes;
