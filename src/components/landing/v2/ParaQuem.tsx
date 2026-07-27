import { Icon } from "@iconify/react";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { ArcoAugusto } from "@/components/landing/ArcoAugusto";

const PERFIS = [
  {
    icon: "ph:house-line",
    titulo: "Síndicos moradores",
    texto:
      "Você preside seu prédio sem ter formação jurídica. O Augusto responde com a segurança de um advogado à mão, na linguagem do dia a dia.",
  },
  {
    icon: "ph:briefcase",
    titulo: "Síndicos profissionais e advogados",
    texto:
      "Você toma dezenas de decisões por semana em múltiplos condomínios. O Augusto acelera consultas com fundamentação, precedentes e minutas prontas.",
  },
  {
    icon: "ph:buildings",
    titulo: "Administradoras",
    texto:
      "Sua equipe atende dezenas de condomínios. O Augusto padroniza a resposta jurídica e libera tempo para o que exige julgamento humano.",
  },
];

export function ParaQuem() {
  return (
    <section
      id="para-quem"
      className="relative w-full bg-bege px-6"
      style={{ paddingTop: "clamp(80px, 10vw, 120px)", paddingBottom: "clamp(80px, 10vw, 120px)" }}
    >
      <div className="mx-auto w-full max-w-[var(--container-container)]">
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <SectionLabel tone="dark">Para quem é</SectionLabel>
          <h2 className="t-h2 mt-5 text-verde">
            Feito para quem responde pelas decisões do condomínio.
          </h2>
          <ArcoAugusto width={52} color="hsl(33 40% 54%)" opacity={0.55} className="mt-6" />
          <p className="t-lead mt-5 text-ardosia">
            Três perfis, uma mesma exigência: decisões fundamentadas, rápidas e defensáveis.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PERFIS.map((p) => (
            <article
              key={p.titulo}
              className="flex flex-col rounded-2xl border border-borda bg-papel p-7 transition-colors duration-200 hover:border-dourado/60"
            >
              <span className="inline-grid h-11 w-11 place-items-center rounded-xl border border-dourado/40 bg-dourado/10 text-verde">
                <Icon icon={p.icon} width={22} />
              </span>
              <h3 className="t-h4 mt-5 text-verde">{p.titulo}</h3>
              <p className="t-body mt-3 text-ardosia">{p.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ParaQuem;