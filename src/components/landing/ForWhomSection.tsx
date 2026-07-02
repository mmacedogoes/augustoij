import { Link } from "@tanstack/react-router";
import { SectionHeader } from "./SectionHeader";

const CARDS = [
  {
    label: "Síndicos",
    title: "Para quem decide sozinho às 22h.",
    body:
      "Você assumiu a responsabilidade de administrar. Não a obrigação de ser advogado. Augusto responde com clareza, traduz o juridiquês, antecipa riscos, sem que você precise ligar para alguém no fim de semana.",
    bullets: [
      "Respostas fundamentadas em minutos",
      "Modelos de notificação prontos",
      "Orientação para assembleias",
    ],
    href: "/signup?public=sindico",
  },
  {
    label: "Administradoras",
    title: "Escala sem perder qualidade.",
    body:
      "Dezenas de condomínios na carteira. Dúvidas repetitivas todos os dias. Augusto absorve a primeira camada de consulta, sua equipe foca no que exige raciocínio humano. Um diferencial real no contrato de administração.",
    bullets: [
      "Padronização de documentos",
      "Respaldo técnico para orientações",
      "Diferencial competitivo no contrato",
    ],
    href: "/signup?public=administradora",
  },
  {
    label: "Advogados",
    title: "O parecerista que cabe no seu dia.",
    body:
      "Gasta suas melhores horas respondendo dúvidas repetitivas? Augusto trabalha como estagiário sênior, cita acórdãos, fundamenta com doutrina, prepara minutas. Você foca na estratégia. Augusto faz o resto.",
    bullets: [
      "Citação completa de jurisprudência",
      "Comparação contratual automatizada",
      "Atualização legislativa contínua",
    ],
    href: "/signup?public=advogado",
  },
];

export function ForWhomSection() {
  return (
    <section className="bg-augusto-cream border-t border-augusto-gold/15 py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Para quem Augusto existe"
          title="Três públicos. Três realidades. Uma inteligência."
          subtitle="Augusto adapta o tom e a profundidade técnica ao seu interlocutor, síndico, administrador ou advogado."
        />

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <div
              key={c.label}
              className="rounded-lg bg-white border-t-2 border-augusto-gold shadow-md p-10 transition-transform hover:-translate-y-1"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-augusto-gold">
                {c.label}
              </div>
              <h3 className="mt-3 font-serif text-augusto-green text-[28px] leading-tight">
                {c.title}
              </h3>
              <p className="mt-4 text-[16px] leading-[1.6] text-augusto-slate">{c.body}</p>
              <ul className="mt-6 space-y-2.5">
                {c.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-[15px] text-augusto-slate">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-augusto-gold flex-shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                to={c.href}
                className="mt-6 inline-block text-[14px] font-medium text-augusto-green hover:underline"
              >
                Ver casos de uso →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ForWhomSection;