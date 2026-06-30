import { createFileRoute } from "@tanstack/react-router";
import { AjudaShell } from "@/components/ajuda/AjudaShell";

export const Route = createFileRoute("/_authenticated/app/ajuda/faq")({
  component: FAQ,
});

const PERGUNTAS = [
  {
    q: "Quais tipos de arquivo posso carregar?",
    a: "PDF, DOCX, TXT e imagens (JPG/PNG). Documentos escaneados são lidos automaticamente.",
  },
  {
    q: "Qual o limite de tamanho por arquivo?",
    a: "15 MB por arquivo para usuários comuns. Administradores têm limite estendido.",
  },
  {
    q: "Meus documentos ficam protegidos?",
    a: "Sim. Apenas membros do condomínio acessam — controle por papel e auditoria de ações.",
  },
  {
    q: "A IA pode gerar atas oficiais?",
    a: "Sim, mas qualquer documento gerado deve ser revisado e assinado pelo responsável legal.",
  },
  {
    q: "Posso reabrir uma conversa antiga?",
    a: "Sim — vá no condomínio, aba Histórico, e clique em Abrir conversa.",
  },
];

function FAQ() {
  return (
    <AjudaShell>
      <h1 className="text-2xl font-semibold mb-3">Perguntas frequentes</h1>
      <div className="space-y-5 mt-4">
        {PERGUNTAS.map((p) => (
          <div key={p.q}>
            <h3 className="font-semibold text-slate-900">{p.q}</h3>
            <p className="text-slate-600 mt-1">{p.a}</p>
          </div>
        ))}
      </div>
    </AjudaShell>
  );
}