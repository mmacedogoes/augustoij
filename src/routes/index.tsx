import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Brain, ShieldCheck, FileText, Scale, MessagesSquare, Gavel, Calculator, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CondoIA — IA para síndicos e administradoras de condomínios" },
      { name: "description", content: "Plataforma de IA com apoio jurídico, gestão de documentos e respostas instantâneas para o dia a dia do seu condomínio. Teste grátis por 7 dias." },
      { property: "og:title", content: "CondoIA — IA para condomínios" },
      { property: "og:description", content: "Apoio inteligente para síndicos e administradoras." },
    ],
  }),
  component: Landing,
});

const skills = [
  { icon: Scale, title: "Apoio Jurídico", desc: "Interprete a convenção e o regimento com base na legislação brasileira." },
  { icon: Gavel, title: "Assembleias", desc: "Monte pautas, redija atas e analise quóruns automaticamente." },
  { icon: FileText, title: "Documentos", desc: "Resuma contratos, atas e laudos em segundos." },
  { icon: Calculator, title: "Finanças", desc: "Tire dúvidas sobre rateios, inadimplência e prestação de contas." },
  { icon: MessagesSquare, title: "Comunicação", desc: "Gere comunicados, circulares e respostas a condôminos." },
  { icon: ShieldCheck, title: "Compliance & LGPD", desc: "Orientações sobre obrigações legais e proteção de dados." },
];

const planos = [
  { nome: "Solo", preco: "297", desc: "Para síndicos de 1 condomínio", features: ["1 condomínio", "200 mensagens/mês", "50 MB de documentos", "Exportar respostas em PDF"] },
  { nome: "Pro", preco: "597", desc: "Para síndicos profissionais", features: ["Até 5 condomínios", "1.000 mensagens/mês", "500 MB de documentos", "Histórico ilimitado", "Suporte prioritário"], destaque: true },
  { nome: "Administradora", preco: "1.997", desc: "Para administradoras", features: ["Condomínios ilimitados", "Mensagens ilimitadas", "5 GB de documentos", "Multiusuário", "Onboarding dedicado"] },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <Building2 className="h-6 w-6 text-accent" />
            <span className="text-lg">CondoIA</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">Entrar</Link>
            <Link to="/signup"><Button>Começar grátis</Button></Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          <Brain className="h-3.5 w-3.5" /> Inteligência artificial para condomínios
        </div>
        <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight text-primary">
          O copiloto jurídico e operacional<br/>do seu condomínio
        </h1>
        <p className="mt-6 mx-auto max-w-2xl text-lg text-muted-foreground">
          O CondoIA lê a convenção, o regimento e as atas do seu condomínio e responde dúvidas em segundos — com base na legislação brasileira.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/signup"><Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">Começar teste grátis de 7 dias <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <a href="#planos"><Button size="lg" variant="outline">Ver planos</Button></a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito • Cancele quando quiser</p>
      </section>

      {/* Benefícios */}
      <section className="bg-secondary/40 py-16">
        <div className="mx-auto max-w-6xl px-4 grid md:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, title: "Confiável e seguro", desc: "Dados isolados por condomínio, criptografia em repouso e conformidade com a LGPD." },
            { icon: Brain, title: "Treinado no seu acervo", desc: "Envie a convenção, regimento e atas — o assistente responde com base nesses documentos." },
            { icon: FileText, title: "Pronto para usar", desc: "Pergunte, exporte respostas em PDF e leve a fundamentação para a próxima assembleia." },
          ].map((b) => (
            <Card key={b.title} className="p-6">
              <b.icon className="h-8 w-8 text-accent" />
              <h3 className="mt-4 text-lg font-semibold text-primary">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary">6 habilidades. Um único assistente.</h2>
        <p className="mt-3 text-center text-muted-foreground max-w-2xl mx-auto">Tudo o que um síndico precisa em um chat só.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((s) => (
            <Card key={s.title} className="p-6 hover:border-accent transition-colors">
              <s.icon className="h-7 w-7 text-accent" />
              <h3 className="mt-3 font-semibold text-primary">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="bg-secondary/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-primary">Planos para todo tamanho de gestão</h2>
          <p className="mt-3 text-center text-muted-foreground">7 dias grátis em qualquer plano.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {planos.map((p) => (
              <Card key={p.nome} className={`p-6 flex flex-col ${p.destaque ? "border-accent border-2 shadow-lg" : ""}`}>
                {p.destaque && <span className="self-start mb-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Mais escolhido</span>}
                <h3 className="text-xl font-bold text-primary">{p.nome}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className="text-4xl font-extrabold text-primary">{p.preco}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <ul className="mt-6 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm"><Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" /> {f}</li>
                  ))}
                </ul>
                <Link to="/signup" className="mt-6"><Button className="w-full" variant={p.destaque ? "default" : "outline"}>Começar 7 dias grátis</Button></Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-primary">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="mt-8">
          <AccordionItem value="1">
            <AccordionTrigger>O CondoIA substitui o advogado do condomínio?</AccordionTrigger>
            <AccordionContent>Não. As respostas são apoio técnico e devem ser validadas por um profissional habilitado antes de qualquer decisão formal.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="2">
            <AccordionTrigger>Meus documentos ficam seguros?</AccordionTrigger>
            <AccordionContent>Sim. Cada condomínio tem seu acervo isolado, com criptografia em repouso e acesso controlado em conformidade com a LGPD.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="3">
            <AccordionTrigger>Posso cancelar quando quiser?</AccordionTrigger>
            <AccordionContent>Sim. Sem multas, sem fidelidade. O cancelamento é feito em 1 clique na sua conta.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="4">
            <AccordionTrigger>Preciso instalar algo?</AccordionTrigger>
            <AccordionContent>Não. O CondoIA roda no navegador, no computador ou no celular.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* CTA final */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Pronto para deixar a IA cuidar da parte chata?</h2>
          <p className="mt-3 text-primary-foreground/80">7 dias grátis. Sem cartão. Sem compromisso.</p>
          <Link to="/signup" className="inline-block mt-6"><Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">Começar agora</Button></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CondoIA. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/termos" className="hover:text-foreground">Termos de uso</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
