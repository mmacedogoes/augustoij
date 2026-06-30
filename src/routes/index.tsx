import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, ShieldCheck, FileText, Scale, MessagesSquare, Gavel, Calculator, Check, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Augusto.IJ — IA para síndicos e administradoras de condomínios" },
      { name: "description", content: "Plataforma de IA com apoio jurídico, gestão de documentos e respostas instantâneas para o dia a dia do seu condomínio. Teste grátis por 7 dias." },
      { property: "og:title", content: "Augusto.IJ — IA para condomínios" },
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Link to="/" className="flex items-center">
            <Logo variant="default" size="md" />
          </Link>
          <nav className="flex items-center gap-6">
            <a href="#planos" className="hidden sm:inline text-sm text-muted-foreground hover:text-primary transition-colors">Planos</a>
            <Link to="/blog" className="hidden sm:inline text-sm text-muted-foreground hover:text-primary transition-colors">Blog</Link>
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Entrar</Link>
            <Link to="/signup"><Button>Começar grátis</Button></Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 md:py-24 text-center">
        <div className="mx-auto max-w-[800px] flex flex-col items-center">
          <Logo variant="default" height={300} className="mb-10" />
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground tracking-wide uppercase">
            <Brain className="h-3.5 w-3.5" strokeWidth={1.5} /> Inteligência Jurídica para Condomínios
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-primary leading-[1.1]">
          Inteligência Jurídica para Condomínios
        </h1>
          <p className="mt-6 max-w-[600px] text-lg text-muted-foreground leading-relaxed">
          Assistente de IA treinado em direito condominial brasileiro. Atas, notificações, contratos e pareceres em minutos.
        </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/signup"><Button size="lg">Começar teste grátis de 7 dias <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <a href="#planos"><Button size="lg" variant="ghost">Ver planos</Button></a>
        </div>
          <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito • Cancele quando quiser</p>
        </div>
      </section>

      {/* Benefícios */}
      <section className="bg-card border-y border-border py-16">
        <div className="mx-auto max-w-6xl px-4 grid md:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, title: "Confiável e seguro", desc: "Dados isolados por condomínio, criptografia em repouso e conformidade com a LGPD." },
            { icon: Brain, title: "Treinado no seu acervo", desc: "Envie a convenção, regimento e atas — o assistente responde com base nesses documentos." },
            { icon: FileText, title: "Pronto para usar", desc: "Pergunte, exporte respostas em PDF e leve a fundamentação para a próxima assembleia." },
          ].map((b) => (
            <Card key={b.title} className="p-6">
              <b.icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
              <h3 className="mt-4 text-lg font-semibold text-primary">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary tracking-tight">6 habilidades. Um único assistente.</h2>
        <p className="mt-3 text-center text-muted-foreground max-w-2xl mx-auto">Tudo o que um síndico precisa em um chat só.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((s) => (
            <Card key={s.title} className="p-6 hover:border-primary/40 transition-colors">
              <s.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
              <h3 className="mt-3 font-semibold text-primary">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="bg-card border-y border-border py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-primary tracking-tight">Planos para todo tamanho de gestão</h2>
          <p className="mt-3 text-center text-muted-foreground">7 dias grátis em qualquer plano.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {planos.map((p) => (
              <Card key={p.nome} className={`p-6 flex flex-col bg-background ${p.destaque ? "border-primary border-2" : ""}`}>
                {p.destaque && <span className="self-start mb-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground tracking-wide uppercase">Mais escolhido</span>}
                <h3 className="text-xl font-bold text-primary">{p.nome}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className="text-4xl font-bold text-primary tracking-tight">{p.preco}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <ul className="mt-6 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={2} /> {f}</li>
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
            <AccordionTrigger>O Augusto.IJ substitui o advogado do condomínio?</AccordionTrigger>
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
            <AccordionContent>Não. O Augusto.IJ roda no navegador, no computador ou no celular.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* CTA final */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Pronto para deixar a IA cuidar da parte chata?</h2>
          <p className="mt-3 text-primary-foreground/80">7 dias grátis. Sem cartão. Sem compromisso.</p>
          <Link to="/signup" className="inline-block mt-6"><Button size="lg" variant="secondary">Começar agora</Button></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 bg-background">
        <div className="mx-auto max-w-6xl px-4 flex flex-col gap-4 text-sm text-muted-foreground">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Logo variant="icon" size="sm" />
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Augusto.IJ · Inteligência Jurídica para Condomínios</span>
          </div>
          <div className="flex gap-4">
            <Link to="/termos" className="hover:text-primary transition-colors">Termos de uso</Link>
            <Link to="/privacidade" className="hover:text-primary transition-colors">Privacidade</Link>
            <Link to="/blog" className="hover:text-primary transition-colors">Blog</Link>
          </div>
          </div>
          <p className="text-[11px] italic leading-relaxed text-muted-foreground/80 max-w-3xl">
            As respostas geradas pelo Augusto.IJ têm caráter informativo e não substituem a orientação
            de profissional habilitado. Valide decisões formais com seu advogado e/ou contador.
          </p>
        </div>
      </footer>
    </div>
  );
}
