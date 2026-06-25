import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — CondoIA" },
      { name: "description", content: "Como o CondoIA trata seus dados pessoais conforme a LGPD." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <Building2 className="h-5 w-5 text-accent" /> CondoIA
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-primary">Política de privacidade</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        <section className="mt-8 space-y-4 text-sm text-foreground leading-relaxed">
          <p><strong>1. Dados coletados.</strong> Cadastro (nome, e-mail, telefone, OAB opcional), dados de uso e os documentos que você opta por enviar ao seu condomínio.</p>
          <p><strong>2. Finalidades.</strong> Operar a plataforma, gerar respostas com IA, faturar a assinatura, cumprir obrigações legais e melhorar o serviço.</p>
          <p><strong>3. Base legal (LGPD).</strong> Execução de contrato, consentimento (LGPD aceito no cadastro), legítimo interesse e cumprimento de obrigação legal.</p>
          <p><strong>4. Compartilhamento.</strong> Provedores estritamente necessários (hospedagem, IA, pagamentos), sob obrigação contratual de confidencialidade. Nunca vendemos dados.</p>
          <p><strong>5. Segurança.</strong> Criptografia em repouso e em trânsito, isolamento de dados por condomínio e controle de acesso por perfil.</p>
          <p><strong>6. Seus direitos.</strong> Acesso, correção, portabilidade, exclusão, revogação de consentimento e oposição. Solicite pelo e-mail abaixo.</p>
          <p><strong>7. Retenção.</strong> Mantemos seus dados enquanto a conta estiver ativa e pelo prazo legal após o encerramento. Exclusão sob demanda em até 15 dias.</p>
          <p><strong>8. Contato do encarregado (DPO).</strong> dpo@condoia.com.br</p>
          <p className="text-xs text-muted-foreground italic">Este texto é uma versão inicial e deve ser revisado por seu departamento jurídico.</p>
        </section>
      </main>
    </div>
  );
}