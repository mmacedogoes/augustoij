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
  const h2 = "text-xl md:text-2xl font-semibold tracking-tight text-foreground mt-10 mb-3";
  const p = "text-sm md:text-base leading-relaxed text-foreground/90 text-pretty";
  const ul = "list-disc pl-6 space-y-2 marker:text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link to="/" className="inline-flex items-center">
            <Logo variant="principal" height={24} />
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Atualizado em: julho de 2026 · Versão 1.0</p>

        <section>
          <h2 className={h2}>1. Aceitação dos Termos</h2>
          <p className={p}>
            Ao criar uma conta ou utilizar a plataforma Augusto.IJ, o usuário declara ter lido, compreendido e aceito integralmente
            os presentes Termos de Uso e a Política de Privacidade da Augusto.IJ Tecnologia LTDA.
          </p>
          <p className={`${p} mt-3`}>
            O uso da plataforma por pessoa menor de 18 anos somente é permitido sob responsabilidade dos pais ou responsáveis legais.
          </p>
        </section>

        <section>
          <h2 className={h2}>2. Descrição do Serviço</h2>
          <p className={p}>
            O Augusto.IJ é uma plataforma de inteligência artificial jurídica especializada em direito condominial, que oferece:
          </p>
          <ul className={`${ul} mt-3`}>
            <li>Consultas jurídicas automatizadas com base em legislação, doutrina e jurisprudência.</li>
            <li>Análise de documentos condominiais (atas, convenções, regimentos, contratos).</li>
            <li>Geração de modelos de notificações, minutas e documentos.</li>
            <li>Gestão de múltiplos condomínios em um único ambiente.</li>
          </ul>
          <p className={`${p} mt-3`}>
            O serviço tem natureza meramente informativa e orientativa. As respostas da IA <strong>não constituem parecer jurídico</strong>,
            consultoria advocatícia ou assessoria legal formal, não substituindo a orientação de advogado habilitado para casos concretos.
          </p>
        </section>

        <section>
          <h2 className={h2}>3. Cadastro e Conta</h2>
          <p className={p}>Para utilizar a plataforma, o usuário deve:</p>
          <ul className={`${ul} mt-3`}>
            <li>Fornecer informações verdadeiras, precisas e atualizadas no cadastro.</li>
            <li>Manter a confidencialidade de suas credenciais de acesso.</li>
            <li>Notificar imediatamente a Controladora em caso de acesso não autorizado à sua conta.</li>
            <li>Ser o único responsável por todas as atividades realizadas em sua conta.</li>
          </ul>
          <p className={`${p} mt-3`}>
            A Controladora reserva-se o direito de suspender ou encerrar contas que contenham informações falsas ou que violem estes Termos.
          </p>
        </section>

        <section>
          <h2 className={h2}>4. Planos e Pagamento</h2>
          <p className={p}>
            A plataforma oferece planos gratuito e pagos, com funcionalidades e limites distintos conforme descritos na página de planos.
          </p>
          <ul className={`${ul} mt-3`}>
            <li><strong>Plano Gratuito:</strong> válido por 30 dias a partir do cadastro, limitado a 10 mensagens por dia e 1 condomínio.</li>
            <li><strong>Planos pagos:</strong> cobrados mensalmente ou anualmente, conforme escolha do usuário no momento da contratação.</li>
            <li>O cancelamento pode ser realizado a qualquer tempo, sem multa, com efeito ao final do período já pago.</li>
            <li>Não há reembolso proporcional por dias não utilizados, salvo disposição legal em contrário.</li>
            <li>A Controladora reserva-se o direito de alterar os preços dos planos, com aviso prévio de 30 dias.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>5. Uso Aceitável</h2>
          <p className={p}>
            O usuário compromete-se a utilizar a plataforma exclusivamente para finalidades lícitas e condizentes com a gestão condominial.
            É expressamente <strong>vedado</strong>:
          </p>
          <ul className={`${ul} mt-3`}>
            <li>Utilizar a plataforma para fins ilegais, fraudulentos ou que violem direitos de terceiros.</li>
            <li>Fazer engenharia reversa, descompilar ou tentar extrair o código-fonte da plataforma.</li>
            <li>Compartilhar credenciais de acesso com terceiros não autorizados.</li>
            <li>Enviar documentos que contenham vírus, malware ou código malicioso.</li>
            <li>Utilizar a plataforma para coletar ou processar dados pessoais sem base legal adequada.</li>
            <li>Tentar sobrecarregar os sistemas da plataforma com requisições automatizadas (scraping, bots).</li>
            <li>Reproduzir, distribuir ou comercializar os conteúdos gerados pela IA sem autorização.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>6. Documentos e Conteúdo do Usuário</h2>
          <p className={p}>
            O usuário mantém a titularidade dos documentos que envia à plataforma. Ao fazer o upload, o usuário concede à Controladora
            licença limitada, não exclusiva e revogável para processar os documentos exclusivamente para prestação do serviço contratado.
          </p>
          <p className={`${p} mt-3`}>O usuário declara e garante que:</p>
          <ul className={`${ul} mt-3`}>
            <li>Possui autorização legal para compartilhar os documentos enviados.</li>
            <li>Os documentos não violam direitos autorais, segredo de negócio ou privacidade de terceiros.</li>
            <li>Documentos contendo dados pessoais de terceiros foram coletados com base legal adequada.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>7. Propriedade Intelectual</h2>
          <p className={p}>
            Todos os elementos da plataforma Augusto.IJ — incluindo marca, logotipo, interface, modelos de documentos gerados pela IA,
            base jurídica proprietária, código e conteúdos — são de propriedade exclusiva da Augusto.IJ Tecnologia LTDA ou de seus
            licenciantes, protegidos pela legislação de propriedade intelectual brasileira.
          </p>
          <p className={`${p} mt-3`}>
            Os modelos e documentos gerados pela IA para o usuário podem ser utilizados pelo usuário para as finalidades condominiais
            contratadas. É vedada a revenda ou sublicenciamento desses conteúdos.
          </p>
        </section>

        <section>
          <h2 className={h2}>8. Limitação de Responsabilidade</h2>
          <p className={p}>
            O Augusto.IJ é uma ferramenta de apoio jurídico informativo. A Controladora não se responsabiliza por:
          </p>
          <ul className={`${ul} mt-3`}>
            <li>Decisões tomadas pelo usuário com base nas respostas da IA.</li>
            <li>Imprecisões, desatualizações ou interpretações divergentes geradas pela IA.</li>
            <li>Prejuízos decorrentes do uso indevido da plataforma ou de informações nela contidas.</li>
            <li>Indisponibilidade temporária da plataforma por manutenção, falhas técnicas ou casos fortuitos.</li>
            <li>Conteúdo de documentos enviados pelo próprio usuário.</li>
          </ul>
          <p className={`${p} mt-3`}>
            A responsabilidade total da Controladora, em qualquer hipótese, fica limitada ao valor pago pelo usuário nos últimos 3 meses de assinatura.
          </p>
        </section>

        <section>
          <h2 className={h2}>9. Disponibilidade e Manutenção</h2>
          <p className={p}>
            A Controladora envidará esforços razoáveis para manter a plataforma disponível continuamente, mas não garante disponibilidade
            ininterrupta. Manutenções programadas serão comunicadas com antecedência mínima de 24 horas. Interrupções por causas de força
            maior, falhas de terceiros ou ataques cibernéticos não geram direito a indenização ou créditos.
          </p>
        </section>

        <section>
          <h2 className={h2}>10. Suspensão e Cancelamento</h2>
          <p className={p}>A Controladora poderá suspender ou cancelar o acesso do usuário, sem aviso prévio, nos casos de:</p>
          <ul className={`${ul} mt-3`}>
            <li>Violação de qualquer disposição destes Termos.</li>
            <li>Inadimplência no pagamento do plano.</li>
            <li>Uso da plataforma para fins ilícitos ou lesivos a terceiros.</li>
            <li>Solicitação do próprio usuário.</li>
          </ul>
          <p className={`${p} mt-3`}>
            Em caso de cancelamento por iniciativa do usuário, os dados serão retidos pelos prazos previstos na Política de Privacidade e
            eliminados mediante solicitação formal.
          </p>
        </section>

        <section>
          <h2 className={h2}>11. Alterações nos Termos</h2>
          <p className={p}>
            A Controladora poderá alterar estes Termos a qualquer momento, comunicando o usuário por e-mail ou aviso na plataforma com
            antecedência mínima de 15 dias para alterações relevantes. O uso continuado após o prazo implica aceitação das novas condições.
          </p>
        </section>

        <section>
          <h2 className={h2}>12. Disposições Gerais</h2>
          <p className={p}>
            Estes Termos constituem o acordo integral entre as partes quanto ao uso da plataforma. Caso qualquer disposição seja considerada
            inválida, as demais permanecerão em pleno vigor. A tolerância quanto ao descumprimento de qualquer cláusula não implica renúncia
            ao direito de exigi-la futuramente.
          </p>
          <p className={`${p} mt-3`}>
            Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca da sede da Controladora para dirimir quaisquer litígios.
          </p>
        </section>

        <p className="mt-12 text-xs text-muted-foreground">Atualizado em: julho de 2026 · Versão 1.0</p>
      </main>
    </div>
  );
}