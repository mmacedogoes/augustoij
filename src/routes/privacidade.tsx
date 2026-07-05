import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Augusto.IJ" },
      { name: "description", content: "Como o Augusto.IJ trata seus dados pessoais conforme a LGPD." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  const h2 = "text-xl md:text-2xl font-semibold tracking-tight text-foreground mt-10 mb-3";
  const h3 = "text-base font-semibold text-foreground mt-6 mb-2";
  const p = "text-sm md:text-base leading-relaxed text-foreground/90 text-pretty";
  const ul = "list-disc pl-6 space-y-2 marker:text-muted-foreground";
  const link =
    "text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors duration-150";

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
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Atualizado em: julho de 2026 · Versão 1.0</p>

        <section>
          <h2 className={h2}>1. Identificação do Controlador</h2>
          <p className={p}>
            A Augusto.IJ Tecnologia LTDA, pessoa jurídica em constituição, com nome fantasia Augusto.IJ, doravante denominada
            &quot;Controladora&quot;, é responsável pelo tratamento dos dados pessoais coletados por meio da plataforma Augusto.IJ,
            acessível em{" "}
            <a
              href="https://augustoij.lovable.app"
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              https://augustoij.lovable.app
            </a>
            .
          </p>
          <p className={`${p} mt-3`}>
            Canal de contato:{" "}
            <a href="mailto:contato@augusto.ij" className={link}>
              contato@augusto.ij
            </a>
          </p>
          <p className={`${p} mt-1`}>
            Encarregado de Proteção de Dados (DPO):{" "}
            <a href="mailto:privacidade@augusto.ij" className={link}>
              privacidade@augusto.ij
            </a>
          </p>
        </section>

        <section>
          <h2 className={h2}>2. Dados Coletados</h2>

          <h3 className={h3}>2.1 Dados fornecidos diretamente pelo usuário</h3>
          <ul className={ul}>
            <li>Nome completo e endereço de e-mail (cadastro e autenticação).</li>
            <li>Perfil profissional: síndico morador, síndico profissional, administradora, advogado, funcionário ou membro do conselho.</li>
            <li>Dados dos condomínios cadastrados: nome, endereço e CNPJ (quando aplicável).</li>
            <li>Documentos enviados para análise: atas, convenções, regimentos internos, contratos e demais arquivos.</li>
            <li>Histórico de conversas e consultas realizadas na plataforma.</li>
          </ul>

          <h3 className={h3}>2.2 Dados coletados automaticamente</h3>
          <ul className={ul}>
            <li>Endereço IP e dados de geolocalização aproximada.</li>
            <li>Tipo de dispositivo, sistema operacional e navegador.</li>
            <li>Logs de acesso, data, hora e duração das sessões.</li>
            <li>Plano contratado e histórico de uso da plataforma.</li>
          </ul>

          <h3 className={h3}>2.3 Dados de terceiros</h3>
          <p className={p}>
            Documentos enviados pelos usuários podem conter dados pessoais de terceiros (condôminos, funcionários, fornecedores).
            O usuário, ao realizar o upload, declara possuir autorização ou base legal adequada para compartilhar tais dados com a plataforma.
          </p>

          <h3 className={h3}>2.4 Dados de menores de idade</h3>
          <p className={p}>
            A plataforma é destinada a usuários maiores de 18 anos. Eventualmente, documentos condominiais podem conter dados de menores
            na qualidade de proprietários ou condôminos. Nesses casos, o tratamento ocorre com base no legítimo interesse condominial e em
            cumprimento à legislação aplicável, com adoção de salvaguardas reforçadas.
          </p>
        </section>

        <section>
          <h2 className={h2}>3. Finalidades do Tratamento</h2>
          <p className={p}>Os dados pessoais são tratados para as seguintes finalidades:</p>
          <ul className={`${ul} mt-3`}>
            <li>Execução do contrato de prestação de serviços e acesso à plataforma.</li>
            <li>Autenticação, controle de acesso e segurança da conta.</li>
            <li>Fornecimento de respostas jurídicas, modelos de documentos e análises pela IA.</li>
            <li>Gestão de planos, limites de uso e controle de mensagens.</li>
            <li>Cumprimento de obrigações legais e regulatórias.</li>
            <li>Melhoria contínua dos serviços, treinamento e aperfeiçoamento dos modelos de IA.</li>
            <li>Comunicações sobre atualizações, novidades e eventuais ofertas (com opt-out disponível).</li>
            <li>Prevenção a fraudes e garantia da integridade da plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>4. Bases Legais (art. 7º e 11 da LGPD)</h2>
          <p className={p}>O tratamento de dados pessoais pela Controladora fundamenta-se nas seguintes bases legais:</p>
          <ul className={`${ul} mt-3`}>
            <li><strong>Execução de contrato</strong> (art. 7º, V): para prestação dos serviços contratados.</li>
            <li><strong>Legítimo interesse</strong> (art. 7º, IX): para segurança, prevenção a fraudes e melhoria dos serviços.</li>
            <li><strong>Cumprimento de obrigação legal</strong> (art. 7º, II): para atender exigências fiscais e regulatórias.</li>
            <li><strong>Consentimento</strong> (art. 7º, I): para comunicações de marketing e uso de dados para treinamento de IA — sempre com possibilidade de revogação.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>5. Compartilhamento de Dados</h2>
          <p className={p}>
            A Controladora poderá compartilhar dados pessoais com os seguintes operadores e terceiros, exclusivamente para as finalidades
            descritas nesta Política:
          </p>

          <h3 className={h3}>5.1 Lovable (infraestrutura e IA)</h3>
          <p className={p}>
            A plataforma é desenvolvida e hospedada na infraestrutura da Lovable, com servidores localizados nos Estados Unidos e/ou
            Europa. O compartilhamento ocorre com base em cláusulas contratuais padrão (Standard Contractual Clauses — SCCs) aprovadas
            pela Comissão Europeia, garantindo nível de proteção adequado à LGPD.
          </p>

          <h3 className={h3}>5.2 Autoridades públicas</h3>
          <p className={p}>
            Dados poderão ser compartilhados com autoridades judiciais, administrativas ou governamentais quando exigido por lei, ordem
            judicial ou para defesa de direitos da Controladora.
          </p>

          <h3 className={h3}>5.3 Vedações</h3>
          <p className={p}>
            A Controladora <strong>não vende, aluga, cede ou comercializa</strong> dados pessoais a terceiros para fins de marketing ou
            quaisquer outras finalidades não descritas nesta Política.
          </p>
        </section>

        <section>
          <h2 className={h2}>6. Transferência Internacional de Dados</h2>
          <p className={p}>
            Os dados poderão ser transferidos para servidores localizados nos Estados Unidos e na Europa, em razão da infraestrutura da
            Lovable. A Controladora adota as seguintes salvaguardas:
          </p>
          <ul className={`${ul} mt-3`}>
            <li>Cláusulas contratuais padrão (SCCs) com o operador Lovable.</li>
            <li>Verificação periódica das certificações e políticas de privacidade dos operadores.</li>
            <li>Minimização de dados transferidos ao estritamente necessário para a prestação do serviço.</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>7. Retenção e Eliminação de Dados</h2>
          <p className={p}>Os dados pessoais são retidos pelos seguintes prazos:</p>
          <ul className={`${ul} mt-3`}>
            <li><strong>Dados de conta e perfil:</strong> durante a vigência do contrato e por até 5 anos após o encerramento, para cumprimento de obrigações legais.</li>
            <li><strong>Histórico de conversas:</strong> conforme o plano contratado pelo usuário (7 dias a ilimitado) e por até 90 dias após o cancelamento.</li>
            <li><strong>Documentos enviados:</strong> pelo período de vigência do plano e excluídos em até 30 dias após solicitação ou cancelamento.</li>
            <li><strong>Logs de acesso:</strong> 6 meses, nos termos do Marco Civil da Internet (Lei 12.965/2014).</li>
            <li><strong>Dados fiscais e contábeis:</strong> 5 anos, conforme legislação tributária.</li>
          </ul>
          <p className={`${p} mt-3`}>Após o término dos prazos, os dados são eliminados de forma segura ou anonimizados.</p>
        </section>

        <section>
          <h2 className={h2}>8. Direitos dos Titulares (art. 18 da LGPD)</h2>
          <p className={p}>O titular de dados pessoais possui os seguintes direitos, exercíveis a qualquer momento:</p>
          <ul className={`${ul} mt-3`}>
            <li>Confirmação da existência de tratamento.</li>
            <li>Acesso aos dados pessoais tratados.</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
            <li>Portabilidade dos dados a outro fornecedor de serviço.</li>
            <li>Eliminação dos dados tratados com base no consentimento.</li>
            <li>Informação sobre os operadores com quem a Controladora compartilha dados.</li>
            <li>Revogação do consentimento a qualquer momento.</li>
            <li>Oposição ao tratamento baseado em legítimo interesse.</li>
          </ul>
          <p className={`${p} mt-3`}>
            Solicitações devem ser encaminhadas para{" "}
            <a href="mailto:privacidade@augusto.ij" className={link}>privacidade@augusto.ij</a>. O prazo de resposta é de até 15 dias corridos.
          </p>
        </section>

        <section>
          <h2 className={h2}>9. Segurança dos Dados</h2>
          <p className={p}>
            A Controladora adota medidas técnicas e organizacionais para proteger os dados pessoais, incluindo:
          </p>
          <ul className={`${ul} mt-3`}>
            <li>Transmissão de dados via HTTPS/TLS 1.2 ou superior.</li>
            <li>Criptografia de dados sensíveis em repouso (AES-256).</li>
            <li>Controle de acesso baseado em perfil (RBAC).</li>
            <li>Autenticação segura com política de senhas fortes.</li>
            <li>Monitoramento de acessos e logs de auditoria.</li>
            <li>Revisão periódica de permissões e acessos de usuários internos.</li>
          </ul>
          <p className={`${p} mt-3`}>
            Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a Controladora notificará a
            Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados no prazo de até 72 horas após a ciência do incidente.
          </p>
        </section>

        <section>
          <h2 className={h2}>10. Encarregado de Proteção de Dados (DPO)</h2>
          <p className={p}>
            Nos termos do art. 41 da LGPD, a Controladora designa como Encarregado de Proteção de Dados o próprio sócio responsável da
            Augusto.IJ Tecnologia LTDA, cujo contato público é:
          </p>
          <p className={`${p} mt-3`}>
            E-mail:{" "}
            <a href="mailto:privacidade@augusto.ij" className={link}>privacidade@augusto.ij</a>
          </p>
          <p className={`${p} mt-3`}>
            O DPO é responsável por receber comunicações dos titulares e da ANPD, orientar os colaboradores sobre práticas de proteção de
            dados e executar as demais atribuições previstas na LGPD.
          </p>
        </section>

        <section>
          <h2 className={h2}>11. Cookies e Tecnologias de Rastreamento</h2>
          <p className={p}>
            A plataforma poderá utilizar cookies essenciais para funcionamento da autenticação e sessão do usuário. Não são utilizados, no
            momento, cookies de rastreamento para fins publicitários ou analíticos de terceiros. Caso isso seja alterado, esta Política será
            atualizada e os usuários notificados.
          </p>
        </section>

        <section>
          <h2 className={h2}>12. Alterações nesta Política</h2>
          <p className={p}>
            Esta Política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas por e-mail ou por aviso destacado na
            plataforma com antecedência mínima de 15 dias. O uso continuado da plataforma após a comunicação implica aceite das novas condições.
          </p>
        </section>

        <section>
          <h2 className={h2}>13. Lei Aplicável e Foro</h2>
          <p className={p}>
            Esta Política é regida pela legislação brasileira, em especial pela Lei 13.709/2018 (LGPD) e pelo Marco Civil da Internet
            (Lei 12.965/2014). Fica eleito o foro da comarca da sede da Controladora para dirimir quaisquer controvérsias.
          </p>
        </section>

        <p className="mt-12 text-xs text-muted-foreground">Atualizado em: julho de 2026 · Versão 1.0</p>
      </main>
    </div>
  );
}