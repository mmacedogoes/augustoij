import { createFileRoute } from "@tanstack/react-router";
import { AjudaShell } from "@/components/ajuda/AjudaShell";

export const Route = createFileRoute("/_authenticated/app/ajuda/")({
  component: AjudaHome,
});

function AjudaHome() {
  return (
    <AjudaShell>
      <h1 className="text-2xl font-semibold mb-3">Bem-vindo ao Manual do CondoIA</h1>
      <p>
        Este manual reúne tudo o que você precisa para tirar o máximo do CondoIA: desde os
        primeiros passos até como interagir com a IA para gerar notificações, atas, pareceres e
        análises contratuais.
      </p>
      <h2 className="text-lg font-semibold mt-6 mb-2">Por onde começar</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Cadastre seu primeiro condomínio em <strong>Condomínios</strong>.</li>
        <li>Carregue a Convenção e o Regimento Interno em <strong>Documentos</strong>.</li>
        <li>Volte ao <strong>Dashboard</strong> e converse com a IA.</li>
      </ul>
      <h2 className="text-lg font-semibold mt-6 mb-2">Dica de ouro</h2>
      <p className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded">
        Quanto mais documentos relevantes você carregar, melhor a IA responde. Comece com
        Convenção, Regimento Interno e atas das últimas 3 assembleias.
      </p>
    </AjudaShell>
  );
}