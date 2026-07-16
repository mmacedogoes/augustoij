import { createFileRoute } from "@tanstack/react-router";
import { AjudaShell } from "@/components/ajuda/AjudaShell";

export const Route = createFileRoute("/_authenticated/app/ajuda/")({
  component: AjudaHome,
});

function AjudaHome() {
  return (
    <AjudaShell>
      <h1 className="text-2xl font-semibold mb-3">Bem-vindo ao Manual do Augusto.IJ</h1>
      <p>
        O Augusto.IJ é um assistente jurídico condominial com Inteligência Artificial. Ele
        combina uma base de <strong>legislação federal e estadual</strong>, <strong>jurisprudência</strong> e os
        documentos do <em>seu</em> condomínio (Convenção, Regimento Interno, atas, contratos)
        para responder dúvidas, gerar notificações, atas, pareceres e análises contratuais em
        linguagem clara.
      </p>
      <p className="mt-3">
        Este manual reúne tudo que você precisa para usar o sistema no dia a dia — dos
        primeiros passos aos recursos avançados. Use o menu à esquerda para navegar.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Os três pilares do sistema</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Condomínios</strong> — cadastre cada condomínio que você administra ou representa. Todo o contexto (documentos, conversas, unidades) fica organizado por condomínio.</li>
        <li><strong>Documentos</strong> — envie Convenção, Regimento Interno, atas, contratos e outros arquivos. A IA usa esse acervo como referência ao responder.</li>
        <li><strong>Interação com a IA</strong> — converse com o Augusto na tela <strong>Início</strong> ou dentro do condomínio. Peça notificações, atas, pareceres, análises e explicações de dispositivos legais.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">Roteiro sugerido para começar</h2>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Cadastre seu primeiro condomínio em <strong>Condomínios → Novo</strong> (informe nome, CNPJ opcional, cidade, UF e nº de unidades).</li>
        <li>Abra o condomínio recém-criado e vá na aba <strong>Documentos</strong>. Envie a Convenção, o Regimento Interno e as últimas 3 atas de assembleia.</li>
        <li>Aguarde os documentos ficarem com status <strong>Pronto</strong>.</li>
        <li>Vá para a tela <strong>Início</strong>, selecione o condomínio e faça sua primeira pergunta.</li>
      </ol>

      <h2 className="text-lg font-semibold mt-6 mb-2">Dica de ouro</h2>
      <p className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded">
        Quanto mais documentos relevantes você carregar, melhor a IA responde. Priorize
        Convenção, Regimento Interno, atas das últimas 3 assembleias e contratos vigentes.
        Documentos escaneados também funcionam — o sistema lê o texto automaticamente.
      </p>

      <p className="mt-6 text-sm text-slate-500">
        As respostas da IA são informativas e não substituem parecer de profissional
        habilitado. Sempre revise antes de enviar, assinar ou publicar.
      </p>
    </AjudaShell>
  );
}