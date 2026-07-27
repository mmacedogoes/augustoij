import { useEffect, useRef, useState, type ReactElement } from "react";
import { Icon } from "@iconify/react";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";

type CardItem = { titulo: string; texto: string; destaque?: boolean };

const LEI: CardItem[] = [
  {
    titulo: "Legislação",
    texto:
      "Código Civil, Lei 4.591/64 e a legislação estadual e municipal quando aplicável. O texto que vale para todos os condomínios do país.",
  },
  {
    titulo: "Jurisprudência",
    texto:
      "O entendimento atual dos tribunais, com julgados identificados para você conferir na fonte. A lei escrita em 2002 já foi interpretada milhares de vezes desde então.",
  },
  {
    titulo: "Doutrina",
    texto:
      "A leitura dos juristas especializados em Direito Condominial, curada e revisada por profissionais da área. Não conteúdo genérico da internet.",
  },
];

const CONDOMINIO: CardItem[] = [
  {
    titulo: "Convenção",
    texto:
      "A norma interna que rege o seu prédio. É ela que define quórum, sanções, uso de áreas comuns e o que a lei deixou em aberto.",
  },
  {
    titulo: "Regimento interno",
    texto:
      "As regras do cotidiano. Horários, obras, mudanças, animais, uso de garagem. O detalhe onde nasce a maior parte dos conflitos.",
  },
  {
    titulo: "Atas de assembleia",
    texto:
      "Aqui estão as decisões que o seu condomínio já tomou. Uma deliberação anterior pode responder à dúvida de hoje, criar precedente na gestão ou impedir uma decisão contraditória. É a camada que quase toda ferramenta ignora, e a que mais evita retrabalho.",
    destaque: true,
  },
];

type Bloco = {
  numero: string;
  rotulo: string;
  render: () => ReactElement;
};

const BLOCOS: Bloco[] = [
  {
    numero: "01",
    rotulo: "RESPOSTA DIRETA",
    render: () => (
      <p className="font-body text-[14px] leading-relaxed text-grafite">
        <span className="font-medium">Não, como regra.</span> A pintura externa é despesa ordinária de manutenção predial. O fundo de reserva destina-se a despesas extraordinárias.
      </p>
    ),
  },
  {
    numero: "02",
    rotulo: "FUNDAMENTAÇÃO",
    render: () => (
      <p className="font-body text-[14px] leading-relaxed text-grafite">
        Conforme a Lei 4.591/64, art. 22, §1º, "g", o fundo de reserva visa cobrir gastos extraordinários do condomínio. Pintura periódica é despesa ordinária, prevista no orçamento anual.
      </p>
    ),
  },
  {
    numero: "03",
    rotulo: "JURISPRUDÊNCIA",
    render: () => (
      <div className="border-l-[3px] border-dourado bg-cream px-4 py-3">
        <p className="font-body text-[14px] leading-relaxed text-grafite">
          STJ, REsp 1.704.498/SP, Rel. Min. Nancy Andrighi, Terceira Turma, julgado em 17/04/2018.
        </p>
      </div>
    ),
  },
  {
    numero: "04",
    rotulo: "NA PRÁTICA",
    render: () => (
      <p className="font-body text-[14px] leading-relaxed text-grafite">
        Inclua a pintura no orçamento ordinário do próximo exercício. Se for restauração urgente decorrente de evento extraordinário, aí sim cabe o fundo de reserva.
      </p>
    ),
  },
  {
    numero: "05",
    rotulo: "ATENÇÃO A",
    render: () => (
      <p className="font-body text-[14px] leading-relaxed text-grafite">
        A assembleia pode autorizar uso excepcional do fundo, desde que ratificado pelo quórum exigido na convenção. Quando os documentos do seu condomínio estão na base privada, o Augusto.IJ verifica se a convenção prevê regra própria e se alguma assembleia já deliberou sobre o assunto.
      </p>
    ),
  },
];

function CardLei({ item, align = "left" }: { item: CardItem; align?: "left" | "right" }) {
  return (
    <div
      className={`relative rounded-sm border bg-papel p-[14px] transition-shadow duration-200 hover:shadow-[0_2px_16px_-8px_hsl(150_100%_16%/0.18)] ${
        item.destaque ? "border-dourado" : "border-borda"
      }`}
    >
      {item.destaque && (
        <span
          className="absolute right-3 top-3 rounded-full border border-dourado/60 px-2 py-[2px] font-body text-[10px] font-medium text-dourado-texto"
          style={{ letterSpacing: "0.14em" }}
        >
          DECISÕES
        </span>
      )}
      <h4
        className={`font-body text-[15px] font-medium text-grafite ${align === "right" ? "text-left md:text-right" : ""}`}
      >
        {item.titulo}
      </h4>
      <p
        className={`mt-1.5 font-body text-[13px] leading-relaxed text-ardosia ${
          align === "right" ? "text-left md:text-right" : ""
        }`}
      >
        {item.texto}
      </p>
    </div>
  );
}

/**
 * Conector SVG: 3 linhas tracejadas convergindo dos cards ao centro.
 * side="left" desenha da direita p/ esquerda (para os cards à esquerda),
 * side="right" desenha da esquerda p/ direita.
 */
function Conector({ side, active }: { side: "left" | "right"; active: boolean }) {
  const stroke = side === "left" ? "hsl(150 100% 16% / 0.45)" : "hsl(34 42% 38% / 0.5)";
  // paths: start at card side (top/mid/bottom), converge to center-right/left
  const paths =
    side === "left"
      ? ["M 0 24 C 60 24, 60 100, 120 100", "M 0 100 L 120 100", "M 0 176 C 60 176, 60 100, 120 100"]
      : ["M 120 24 C 60 24, 60 100, 0 100", "M 120 100 L 0 100", "M 120 176 C 60 176, 60 100, 0 100"];

  return (
    <svg
      viewBox="0 0 120 200"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          strokeDasharray="4 4"
          strokeLinecap="round"
          style={{
            strokeDashoffset: active ? 0 : 400,
            transition: `stroke-dashoffset 600ms ease-out ${i * 80}ms`,
          }}
        />
      ))}
    </svg>
  );
}

export function Metodo() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="metodo"
      className="relative w-full bg-off px-6 py-[var(--spacing-section-mobile)] md:py-[var(--spacing-section)]"
    >
      <div className="mx-auto w-full max-w-[var(--container-container)]">
        {/* CABEÇALHO */}
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <SectionLabel tone="dark">O MÉTODO AUGUSTO.IJ</SectionLabel>
          <h2
            className="mt-4 font-heading font-medium text-verde"
            style={{ fontSize: "clamp(26px, 2.4vw, 38px)", lineHeight: 1.15, maxWidth: "30ch" }}
          >
            Nenhuma resposta serve ao seu condomínio se ignorar o que ele já decidiu.
          </h2>
          <ArcoAugusto width={44} color="hsl(33 40% 54%)" opacity={0.55} className="mt-6" />
          <p
            className="mt-5 font-body text-[15px] leading-relaxed text-ardosia"
            style={{ maxWidth: "52ch" }}
          >
            A maioria das ferramentas para em um lado só. Ou a lei, ou o documento. O Augusto.IJ cruza os dois, e é desse cruzamento que nasce uma resposta que você pode usar de verdade.
          </p>
        </div>

        {/* PARTE A · DIAGRAMA */}
        <div className="mt-14 md:mt-20">
          {/* Desktop grid */}
          <div className="hidden md:grid" style={{ gridTemplateColumns: "1fr 96px 160px 96px 1fr", alignItems: "center", gap: "16px" }}>
            {/* Coluna Lei */}
            <div
              style={{
                transform: active ? "translateX(0)" : "translateX(-24px)",
                opacity: active ? 1 : 0,
                transition: "transform 600ms ease-out, opacity 600ms ease-out",
              }}
            >
              <div className="mb-3 font-body text-[11px] font-medium uppercase text-verde" style={{ letterSpacing: "0.18em" }}>
                O que a lei diz
              </div>
              <div className="flex flex-col gap-3">
                {LEI.map((c) => <CardLei key={c.titulo} item={c} />)}
              </div>
            </div>

            {/* Conector esquerdo */}
            <div className="h-[220px]">
              <Conector side="left" active={active} />
            </div>

            {/* Selo central */}
            <div className="flex justify-center">
              <div
                className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-full border-[1.5px] border-dourado bg-papel"
                style={{
                  boxShadow: "0 8px 32px -12px hsl(150 100% 16% / 0.18)",
                  opacity: active ? 1 : 0,
                  transform: active ? "scale(1)" : "scale(0.9)",
                  transition: "opacity 500ms ease-out 700ms, transform 500ms ease-out 700ms",
                }}
              >
                <ArcoAugusto width={32} color="hsl(150 100% 16%)" />
                <span className="mt-1 font-heading text-[20px] font-medium leading-none text-verde">Resposta</span>
                <span className="mt-1.5 font-body text-[10px] font-medium text-dourado-texto" style={{ letterSpacing: "0.16em" }}>
                  FUNDAMENTADA
                </span>
              </div>
            </div>

            {/* Conector direito */}
            <div className="h-[220px]">
              <Conector side="right" active={active} />
            </div>

            {/* Coluna Condomínio */}
            <div
              style={{
                transform: active ? "translateX(0)" : "translateX(24px)",
                opacity: active ? 1 : 0,
                transition: "transform 600ms ease-out, opacity 600ms ease-out",
              }}
            >
              <div className="mb-3 text-right font-body text-[11px] font-medium uppercase text-verde" style={{ letterSpacing: "0.18em" }}>
                O que o seu condomínio diz
              </div>
              <div className="flex flex-col gap-3">
                {CONDOMINIO.map((c) => <CardLei key={c.titulo} item={c} align="right" />)}
              </div>
            </div>
          </div>

          {/* Mobile: coluna única */}
          <div className="flex flex-col gap-6 md:hidden">
            <div>
              <div className="mb-3 font-body text-[11px] font-medium uppercase text-verde" style={{ letterSpacing: "0.18em" }}>
                O que a lei diz
              </div>
              <div className="flex flex-col gap-3">
                {LEI.map((c) => <CardLei key={c.titulo} item={c} />)}
              </div>
            </div>
            <div className="flex justify-center">
              <Icon icon="ph:arrow-down" className="h-6 w-6 text-verde" />
            </div>
            <div className="flex justify-center">
              <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full border-[1.5px] border-dourado bg-papel">
                <ArcoAugusto width={28} color="hsl(150 100% 16%)" />
                <span className="mt-1 font-heading text-[18px] font-medium leading-none text-verde">Resposta</span>
                <span className="mt-1 font-body text-[10px] font-medium text-dourado-texto" style={{ letterSpacing: "0.16em" }}>
                  FUNDAMENTADA
                </span>
              </div>
            </div>
            <div className="flex justify-center">
              <Icon icon="ph:arrow-down" className="h-6 w-6 text-dourado-texto" />
            </div>
            <div>
              <div className="mb-3 font-body text-[11px] font-medium uppercase text-verde" style={{ letterSpacing: "0.18em" }}>
                O que o seu condomínio diz
              </div>
              <div className="flex flex-col gap-3">
                {CONDOMINIO.map((c) => <CardLei key={c.titulo} item={c} />)}
              </div>
            </div>
          </div>

          {/* Bloco de exemplo */}
          <div
            className="mt-10 border-l-[3px] border-verde bg-verde-claro px-[18px] py-[14px] md:mt-14"
            style={{ borderRadius: 0 }}
          >
            <p className="font-body text-[14px] leading-relaxed text-grafite">
              Um exemplo do dia a dia: a lei permite. A convenção silencia. Mas a assembleia de 2023 já deliberou sobre o assunto, e ninguém lembra. Sem as atas na base, a resposta parece certa e está incompleta. Com as atas, o Augusto.IJ aponta a deliberação, indica se ela continua válida e mostra o que precisa de nova assembleia.
            </p>
          </div>
        </div>

        {/* PARTE B · ANATOMIA */}
        <div className="mt-20 md:mt-28">
          <p className="text-center font-heading text-[18px] italic text-ardosia">
            E a resposta sai assim:
          </p>

          <div
            className="mx-auto mt-8 rounded-md border border-borda bg-papel px-6 py-5 md:px-[26px] md:py-[20px]"
            style={{
              maxWidth: 640,
              boxShadow: "0 12px 40px -20px hsl(150 100% 16% / 0.15)",
            }}
          >
            <p className="font-body text-[14px] leading-relaxed text-ardosia">
              <span className="font-medium text-grafite">Pergunta:</span> O fundo de reserva pode ser usado para pintura externa do prédio?
            </p>

            <div className="mt-5 flex flex-col">
              {BLOCOS.map((b, i) => (
                <div
                  key={b.numero}
                  className="flex gap-3 border-t py-4 first:border-t-0 md:gap-4"
                  style={{
                    borderColor: "hsl(46 20% 92%)",
                    opacity: active ? 1 : 0,
                    transform: active ? "translateY(0)" : "translateY(8px)",
                    transition: `opacity 400ms ease-out ${900 + i * 80}ms, transform 400ms ease-out ${900 + i * 80}ms`,
                  }}
                >
                  <div className="shrink-0" style={{ width: 28 }}>
                    <span className="font-heading text-[20px] leading-none text-dourado md:text-[22px]">
                      {b.numero}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="mb-1.5 font-body text-[11px] font-medium uppercase text-verde"
                      style={{ letterSpacing: "0.2em" }}
                    >
                      {b.rotulo}
                    </div>
                    {b.render()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-12 text-center font-heading text-[16px] italic text-ardosia">
            A lei é a mesma para todo mundo. O seu condomínio, não.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Metodo;
