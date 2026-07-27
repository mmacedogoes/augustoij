import { Icon } from "@iconify/react";
import { Link } from "@tanstack/react-router";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";
import { Reveal } from "@/components/landing/Reveal";

const CONFIANCA = [
  {
    icon: "ph:scales",
    titulo: "Repositório curado por juristas",
    texto:
      "A base de legislação, jurisprudência e doutrina é alimentada e revisada por profissionais especializados em Direito Condominial.",
  },
  {
    icon: "ph:lock-simple",
    titulo: "Sigilo dos documentos",
    texto:
      "Ambiente seguro, acesso via HTTPS, dados armazenados no Brasil e base privada por condomínio.",
  },
];

export function Credibilidade() {
  return (
    <section
      id="credibilidade"
      className="relative w-full bg-papel px-6"
      style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
    >
      <div className="mx-auto w-full max-w-[var(--container-container)]">
        {/* Cabeçalho */}
        <Reveal className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <SectionLabel tone="dark">QUEM JÁ USA</SectionLabel>
          <h2 className="t-h2 mt-5 text-verde">
            Não é promessa nossa. É a rotina de quem administra condomínio.
          </h2>
          <ArcoAugusto width={52} color="hsl(33 40% 54%)" opacity={0.55} className="mt-6" />
        </Reveal>

        {/* Card depoimento */}
        <Reveal delay={80} className="mx-auto mt-12 rounded-2xl border border-borda bg-papel p-7 md:mt-14 md:p-[30px]" style={{ maxWidth: 640, boxShadow: "0 12px 40px -24px hsl(150 100% 16% / 0.18)" }}>
          <div aria-hidden className="font-heading text-[44px] leading-none text-dourado">
            &ldquo;
          </div>
          <p className="t-quote mt-2 text-verde">
            Ela não encontrou a cláusula de barulho rapidamente. O Augusto.IJ encontrou na hora.
          </p>
          <p className="t-body-sm mt-5 text-ardosia">
            A administradora ficou de fazer a parte dela, e eu já estava com o meu resumo pronto. Ela disse que só tinha encontrado a cláusula de reincidência, não encontrou a de barulho rapidamente. O Augusto.IJ encontrou na hora. Só copiei e colei e disse: a cláusula é essa aqui. É uma inteligência bem atualizada, mais específica, mais direcionada. A margem de erro é bem pequena.
          </p>

          <div className="mt-6 flex items-center gap-4 border-t border-borda pt-5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-verde font-heading text-[15px] font-medium text-off"
              style={{ boxShadow: "0 0 0 2px hsl(33 40% 54%)" }}
              aria-label="depoimento-lucilene-melo.jpg"
              title="depoimento-lucilene-melo.jpg"
            >
              LM
            </div>
            <div className="min-w-0">
              <div className="font-body text-[14px] font-medium text-grafite">Lucilene Melo</div>
              <div className="font-body text-[12px] text-ardosia">
                Síndica profissional e gerente condominial · Campina Grande, PB
              </div>
            </div>
          </div>
        </Reveal>

        <p className="mx-auto mt-6 max-w-[560px] text-center t-micro text-ardosia">
          Quem responde de memória demora. Quem consulta a base encontra na hora. O Augusto.IJ existe para dar essa velocidade à equipe também.
        </p>

        {/* Confiança */}
        <Reveal delay={120} className="mx-auto mt-14 grid max-w-[880px] gap-8 md:mt-16 md:grid-cols-2 md:gap-12">
          {CONFIANCA.map((c) => (
            <div key={c.titulo} className="flex gap-4">
              <Icon icon={c.icon} className="mt-0.5 h-6 w-6 shrink-0 text-verde" />
              <div>
                <h3 className="t-h4 text-verde">{c.titulo}</h3>
                <p className="t-body-sm mt-2 text-ardosia">{c.texto}</p>
              </div>
            </div>
          ))}
        </Reveal>

        {/* Fundador */}
        <Reveal delay={160} className="mt-16 flex flex-col items-center gap-3 text-center md:mt-20">
          <p className="font-heading text-[16px] italic text-ardosia">
            &ldquo;Faltava alguém entre o Direito e o cotidiano do condomínio.&rdquo;
          </p>
          <Link
            to="/historia"
            className="group inline-flex items-center gap-2 font-body text-[11px] font-medium uppercase text-verde transition-colors duration-200 hover:text-verde-profundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-papel"
            style={{ letterSpacing: "0.2em" }}
          >
            Ler a história completa
            <Icon icon="ph:arrow-right" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export default Credibilidade;
