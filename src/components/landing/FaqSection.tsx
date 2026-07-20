import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./Reveal";

const FAQ: { q: string; a: string }[] = [
  {
    q: "O Augusto substitui o advogado do condomínio?",
    a: "Não. Augusto organiza e acelera a consulta jurídica condominial, com fundamentação e orientação prática. Casos estratégicos, litigiosos ou de alta complexidade devem ser conduzidos por advogado habilitado.",
  },
  {
    q: "As respostas consideram as regras do meu condomínio?",
    a: "Sim. Você pode enviar a convenção, o regimento interno, as atas e os contratos para a base privada do seu condomínio. As respostas passam a cruzar a legislação e a jurisprudência com as regras específicas da sua gestão.",
  },
  {
    q: "As respostas têm base legal e jurisprudência?",
    a: "Sim. Quando aplicável, Augusto estrutura a resposta com fundamentação legal, precedentes e orientação prática, a partir de um repositório de legislação, jurisprudência e doutrina curado por profissionais jurídicos da área. Você recebe uma base técnica que pode consultar, conferir e aplicar.",
  },
  {
    q: "Meus documentos ficam protegidos?",
    a: "Sim. Os documentos enviados permanecem em uma base privada, vinculada ao condomínio cadastrado, em ambiente seguro com acesso via HTTPS e dados armazenados no Brasil.",
  },
  {
    q: "Preciso saber usar inteligência artificial?",
    a: "Não. Você pergunta como perguntaria a um especialista: \u201Cqual é o quórum?\u201D, \u201Cesse contrato tem risco?\u201D, \u201Ccomo notificar este morador?\u201D.",
  },
  {
    q: "O teste gratuito exige cartão de crédito?",
    a: "Não. O teste de 7 dias começa sem cartão de crédito.",
  },
  {
    q: "O que acontece depois dos 7 dias?",
    a: "Você escolhe se deseja continuar em um dos planos. Se não escolher, não há cobrança automática.",
  },
  {
    q: "Qual plano é mais indicado para mim?",
    a: "O Essencial atende síndicos moradores. O Profissional é indicado para síndicos profissionais e advogados. Para carteiras maiores, os planos Gestão e Administradora oferecem mais condomínios, usuários e capacidade. Em dúvida, comece pelo teste gratuito.",
  },
];

export function FaqSection() {
  const scrollToHeroChat = () => {
    const el = document.getElementById("hero-chat");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="faq" className="landing-cream-bg landing-section border-t border-landing-rule">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Perguntas frequentes"
          title="As dúvidas que separam você da primeira consulta."
        />

        <Reveal delay={0.05} className="mx-auto mt-16 max-w-3xl">
          <Accordion
            type="single"
            collapsible
            defaultValue="faq-0"
            className="overflow-hidden rounded-[1.5rem] border border-landing-rule bg-landing-panel shadow-[var(--landing-shadow-card)]"
          >
            {FAQ.map((item, i) => (
              <AccordionItem
                key={item.q}
                value={`faq-${i}`}
                className="border-b border-landing-rule last:border-b-0"
              >
                <AccordionTrigger className="items-start gap-6 px-6 py-5 text-left font-serif text-augusto-green text-[17px] leading-[1.35] tracking-[-0.005em] transition-colors duration-200 hover:bg-augusto-cream/40 hover:no-underline focus-visible:ring-2 focus-visible:ring-augusto-gold focus-visible:ring-offset-0 md:px-8 md:py-6 md:text-[19px] [&>svg]:mt-1 [&>svg]:text-augusto-gold">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 text-[15.5px] leading-[1.7] text-augusto-slate md:px-8 md:pb-7">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>

        <Reveal delay={0.1} className="mt-14 flex flex-col items-center text-center">
          <p className="max-w-[560px] font-serif italic text-augusto-slate text-[17px] leading-[1.7]">
            Ainda tem uma dúvida? Pergunte ao Augusto.
          </p>
          <button
            type="button"
            onClick={scrollToHeroChat}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-augusto-green/25 bg-transparent px-6 py-3 text-[13.5px] font-semibold uppercase tracking-[0.14em] text-augusto-green transition-all duration-200 hover:border-augusto-green hover:bg-augusto-green/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold focus-visible:ring-offset-2 focus-visible:ring-offset-landing-surface active:scale-[0.98]"
          >
            Perguntar ao Augusto
            <span aria-hidden="true">↑</span>
          </button>
        </Reveal>
      </div>
    </section>
  );
}

export default FaqSection;