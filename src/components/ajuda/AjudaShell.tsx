import { Link, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import type { ReactNode } from "react";

type SecaoLink = { to: string; label: string };

const SECOES: { titulo: string; links: SecaoLink[] }[] = [
  {
    titulo: "Primeiros passos",
    links: [
      { to: "/app/ajuda", label: "Visão geral" },
      { to: "/app/ajuda/cadastro-condominio", label: "Cadastrar condomínio" },
      { to: "/app/ajuda/carregar-documentos", label: "Carregar documentos" },
      { to: "/app/ajuda/primeira-conversa", label: "Primeira conversa com a IA" },
      { to: "/app/ajuda/onboarding", label: "Tour guiado e onboarding" },
    ],
  },
  {
    titulo: "Usando o sistema",
    links: [
      { to: "/app/ajuda/inicio", label: "Tela Início" },
      { to: "/app/ajuda/chat-ia", label: "Interação com a IA" },
      { to: "/app/ajuda/historico", label: "Histórico de conversas" },
      { to: "/app/ajuda/documentos", label: "Documentos" },
      { to: "/app/ajuda/unidades", label: "Unidades do condomínio" },
      { to: "/app/ajuda/configuracoes", label: "Configurações do condomínio" },
      { to: "/app/ajuda/operadores", label: "Operadores (contas PJ)" },
    ],
  },
  {
    titulo: "Sua conta",
    links: [
      { to: "/app/ajuda/conta-dados", label: "Dados pessoais e segurança" },
      { to: "/app/ajuda/conta-plano", label: "Plano e limites" },
      { to: "/app/ajuda/privacidade", label: "Privacidade e LGPD" },
    ],
  },
  {
    titulo: "Por perfil",
    links: [
      { to: "/app/ajuda/perfil/sindico-morador", label: "Síndico morador" },
      { to: "/app/ajuda/perfil/sindico-profissional", label: "Síndico profissional" },
      { to: "/app/ajuda/perfil/administradora", label: "Administradora" },
      { to: "/app/ajuda/perfil/advogado", label: "Advogado" },
      { to: "/app/ajuda/perfil/conselheiro", label: "Conselheiro" },
    ],
  },
  {
    titulo: "IA e FAQ",
    links: [
      { to: "/app/ajuda/dicas-ia", label: "Dicas de interação com a IA" },
      { to: "/app/ajuda/faq", label: "Perguntas frequentes" },
    ],
  },
];

export function AjudaShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell>
      <div className="app-card max-w-6xl mx-auto text-foreground overflow-hidden">
        <div className="grid md:grid-cols-[260px_1fr]">
          <aside className="bg-muted/40 border-r border-[var(--landing-rule)] p-5 text-sm">
            <h2 className="app-section-title mb-4">Manual do Augusto.IJ</h2>
            <nav className="space-y-5">
              {SECOES.map((sec) => (
                <div key={sec.titulo}>
                  <p className="app-eyebrow mb-2">{sec.titulo}</p>
                  <ul className="space-y-1">
                    {sec.links.map((l) => {
                      const active = pathname === l.to;
                      return (
                        <li key={l.to}>
                          <Link
                            to={l.to as never}
                            className={`relative block rounded-[var(--app-radius-sm)] px-3 py-1.5 transition-colors duration-[var(--dur-fast)] ${
                              active
                                ? "bg-[color-mix(in_hsl,var(--augusto-gold)_14%,transparent)] text-augusto-green font-medium before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-[var(--augusto-gold)]"
                                : "text-foreground/80 hover:bg-muted"
                            }`}
                          >
                            {l.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
          <article className="p-8 prose prose-slate max-w-none leading-relaxed">{children}</article>
        </div>
      </div>
    </AppShell>
  );
}