import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { DPO_EMAIL } from "@/config/legal";

export const Route = createFileRoute("/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança e privacidade — Augusto.IJ" },
      {
        name: "description",
        content:
          "Como a Augusto.IJ protege dados de condomínios, síndicos e administradoras: RLS, criptografia em trânsito, LGPD, controle de acesso e DPO.",
      },
      { property: "og:title", content: "Segurança e privacidade — Augusto.IJ" },
      {
        property: "og:description",
        content: "Controles de segurança da informação, LGPD e boas práticas aplicadas na Augusto.IJ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SegurancaPage,
});

function SegurancaPage() {
  const h2 = "text-xl md:text-2xl font-semibold tracking-tight text-foreground mt-10 mb-3";
  const h3 = "text-base font-semibold text-foreground mt-6 mb-2";
  const p = "text-sm md:text-base leading-relaxed text-foreground/90 text-pretty";
  const ul = "list-disc pl-6 space-y-2 marker:text-muted-foreground text-sm md:text-base text-foreground/90";

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
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary">
          Segurança e privacidade
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Página mantida pela Augusto.IJ Tecnologia LTDA. Descreve controles atualmente ativos na
          plataforma e não constitui certificação independente.
        </p>

        <section>
          <h2 className={h2}>Nosso compromisso</h2>
          <p className={p}>
            Tratamos dados de condomínios, contratos e comunicações jurídicas com o mesmo rigor
            que esperamos de qualquer parceiro do seu escritório ou administradora. A engenharia da
            Augusto.IJ segue boas práticas amplamente adotadas de segurança da informação —
            inspiradas em referências como <strong>ISO/IEC 27001</strong>, <strong>ISO/IEC 27002</strong>,
            <strong> ISO/IEC 27017</strong> (nuvem), <strong>OWASP Top 10</strong> e
            <strong> NIST Cybersecurity Framework</strong> — combinadas com as exigências da
            <strong> LGPD (Lei nº 13.709/2018)</strong>.
          </p>
          <p className={`${p} mt-3`}>
            Segurança é responsabilidade compartilhada: nós operamos a plataforma dentro dos
            controles abaixo; você mantém suas credenciais protegidas, escolhe quem acessa cada
            condomínio e revisa periodicamente os membros da sua equipe.
          </p>
        </section>

        <section>
          <h2 className={h2}>Controle de acesso</h2>
          <ul className={ul}>
            <li>
              Autenticação por e-mail e senha ou Google, com confirmação obrigatória de e-mail
              antes de qualquer uso.
            </li>
            <li>
              Limite de tentativas de login por IP com bloqueio automático de 15 minutos após
              excesso de erros.
            </li>
            <li>
              <strong>Row-Level Security (RLS)</strong> ativa em todas as tabelas do banco de
              dados. Cada consulta é filtrada, no servidor, pelo identificador do usuário
              autenticado — nunca pelo front-end.
            </li>
            <li>
              Papéis distintos (super admin, admin operacional, cliente PF, dono PJ, operador PJ)
              com privilégio mínimo. Trigger de banco impede que um usuário eleve o próprio papel.
            </li>
            <li>
              Módulos sensíveis (administração de imóveis, base de conhecimento) exigem papel
              super admin, validado no servidor a cada requisição.
            </li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>Proteção dos dados</h2>
          <ul className={ul}>
            <li>
              <strong>Criptografia em trânsito</strong> por TLS 1.2+ em todas as conexões, com
              HSTS habilitado (<code>max-age=31536000; includeSubDomains</code>).
            </li>
            <li>
              <strong>Criptografia em repouso</strong> no banco Postgres gerenciado e no
              armazenamento de arquivos.
            </li>
            <li>
              Segredos (chaves de API, tokens de webhook) armazenados em cofre gerenciado e lidos
              exclusivamente por funções de servidor — nunca embarcados no navegador.
            </li>
            <li>
              Headers de segurança em todas as respostas: <code>X-Content-Type-Options</code>,
              <code> X-Frame-Options: DENY</code>, <code>Referrer-Policy</code>,
              <code> Permissions-Policy</code>, <code>Cross-Origin-Opener-Policy</code> e{" "}
              <code>Content-Security-Policy</code> em modo report-only.
            </li>
            <li>
              Validação de entrada com Zod em todos os formulários e endpoints públicos; consultas
              parametrizadas via SDK oficial impedem SQL Injection (OWASP A03).
            </li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>Ciclo de desenvolvimento seguro (SSDLC)</h2>
          <ul className={ul}>
            <li>
              Análise contínua de vulnerabilidades em dependências (SCA) e política de correção de
              itens críticos/altos antes de publicar novas versões.
            </li>
            <li>
              Scanner automático de configurações de banco (RLS, funções, políticas) a cada
              alteração, com correção antes do deploy.
            </li>
            <li>
              Revisão manual das mudanças em rotas autenticadas, integrações financeiras e fluxos
              de dados pessoais.
            </li>
            <li>
              Ambientes separados de desenvolvimento e produção. Chaves de pagamento (Asaas) em
              produção nunca são expostas fora do servidor.
            </li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>LGPD e privacidade</h2>
          <p className={p}>
            Aplicamos <strong>Privacy by Design</strong>: coletamos apenas o necessário para
            operar o serviço contratado e não usamos seus dados para treinar modelos externos de IA
            sem autorização expressa.
          </p>
          <ul className={`${ul} mt-3`}>
            <li>
              <strong>Titular pode</strong> acessar, corrigir, exportar e solicitar exclusão dos
              seus dados diretamente pela tela de conta.
            </li>
            <li>
              <strong>Encarregado (DPO):</strong>{" "}
              <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">
                {DPO_EMAIL}
              </a>
              .
            </li>
            <li>
              Consentimento registrado com data e versão dos Termos e da Política de Privacidade.
            </li>
            <li>
              Banner de cookies com opção de recusar rastreamento não essencial.
            </li>
            <li>
              Retenção proporcional: dados de contratos e comunicações são mantidos enquanto a
              conta estiver ativa; após exclusão, são removidos em até 30 dias, ressalvadas
              obrigações legais (art. 16, LGPD).
            </li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>Fornecedores (subprocessadores)</h2>
          <p className={p}>
            Utilizamos parceiros de infraestrutura em nuvem para hospedar a aplicação, o banco de
            dados, o processamento de IA e o envio de e-mails/pagamentos. Todos operam sob
            contratos que exigem confidencialidade e boas práticas de segurança compatíveis com a
            LGPD.
          </p>
        </section>

        <section>
          <h2 className={h2}>Resposta a incidentes</h2>
          <p className={p}>
            Em caso de incidente de segurança com risco a titulares, seguimos o procedimento
            previsto no art. 48 da LGPD: comunicação à ANPD e aos titulares afetados em prazo
            razoável, com descrição da natureza dos dados, medidas de mitigação adotadas e canais
            de contato.
          </p>
          <p className={`${p} mt-3`}>
            <strong>Comunicação de vulnerabilidades:</strong> se você identificou uma potencial
            falha, escreva para{" "}
            <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">
              {DPO_EMAIL}
            </a>{" "}
            com o máximo de detalhes técnicos. Pedimos que não explore a falha nem divulgue
            publicamente antes da correção.
          </p>
        </section>

        <section>
          <h2 className={h2}>Sua parte da responsabilidade</h2>
          <ul className={ul}>
            <li>Use senhas fortes, únicas por serviço, e ative gerenciador de senhas.</li>
            <li>Revise periodicamente os membros vinculados a cada condomínio.</li>
            <li>
              Nunca compartilhe seu login. Convide colaboradores como membros do condomínio ou
              operadores da conta PJ.
            </li>
            <li>
              Ao encerrar vínculo com um colaborador, remova o acesso imediatamente na tela do
              condomínio.
            </li>
          </ul>
        </section>

        <p className="mt-12 text-xs text-muted-foreground">
          Este documento é atualizado sempre que introduzimos controles novos ou revisamos
          práticas existentes. Última atualização: julho de 2026.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link to="/termos" className="text-primary underline">Termos de uso</Link>
          <Link to="/privacidade" className="text-primary underline">Política de privacidade</Link>
          <Link to="/contato" className="text-primary underline">Contato</Link>
        </div>
      </main>
    </div>
  );
}