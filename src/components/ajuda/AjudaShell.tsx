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
      <div className="max-w-6xl mx-auto bg-white text-slate-900 rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="grid md:grid-cols-[260px_1fr]">
          <aside className="bg-slate-50 border-r border-border p-5 text-sm">
            <h2 className="text-base font-semibold mb-4 text-slate-900">Manual do Augusto.IJ</h2>
            <nav className="space-y-5">
              {SECOES.map((sec) => (
                <div key={sec.titulo}>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{sec.titulo}</p>
                  <ul className="space-y-1">
                    {sec.links.map((l) => {
                      const active = pathname === l.to;
                      return (
                        <li key={l.to}>
                          <Link
                            to={l.to as never}
                            className={`block rounded px-2 py-1.5 ${
                              active
                                ? "bg-emerald-50 text-emerald-700 font-medium"
                                : "text-slate-700 hover:bg-slate-100"
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