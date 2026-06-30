import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Augusto.IJ" },
      { name: "description", content: "Termos de uso da plataforma Augusto.IJ." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link to="/" className="inline-flex items-center">
            <Logo variant="principal" height={24} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-primary">Termos de uso</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        <section className="mt-8 space-y-4 text-sm text-foreground leading-relaxed">
          <p><strong>1. Aceitação.</strong> Ao criar uma conta no Augusto.IJ você concorda com estes Termos. Caso não concorde, não utilize a plataforma.</p>
          <p><strong>2. O que o Augusto.IJ é.</strong> Uma ferramenta de inteligência artificial que auxilia síndicos e administradoras a interpretar documentos e operar condomínios. As respostas têm <em>caráter de apoio</em> e não substituem consulta jurídica ou contábil formal.</p>
          <p><strong>3. Conta e responsabilidades.</strong> Você é responsável pelas credenciais, pelas pessoas que adiciona ao seu condomínio e pelo conteúdo enviado à plataforma.</p>
          <p><strong>4. Conteúdo e propriedade.</strong> Você mantém a titularidade dos documentos enviados. Concede licença limitada ao Augusto.IJ apenas para processá-los e gerar respostas.</p>
          <p><strong>5. Limitação de responsabilidade.</strong> Não nos responsabilizamos por decisões tomadas com base exclusiva nas respostas da IA. Sempre valide com profissional habilitado.</p>
          <p><strong>6. Planos, pagamento e cancelamento.</strong> Os planos são cobrados mensalmente. Você pode cancelar a qualquer momento; o acesso permanece até o fim do ciclo pago.</p>
          <p><strong>7. Alterações.</strong> Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas por e-mail com antecedência razoável.</p>
          <p className="text-xs text-muted-foreground italic">Este texto é uma versão inicial e deve ser revisado por seu departamento jurídico.</p>
        </section>
      </main>
    </div>
  );
}